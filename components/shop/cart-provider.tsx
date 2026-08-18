"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";

import { AuthenticationError, ValidationError } from "@cocartheadless/sdk";
import type {
  CartItem as SDKCartItem,
  CartTotals,
  CurrencyInfo,
  Response as CoCartHttpResponse,
} from "@cocartheadless/sdk";
import { getClient } from "@/lib/cocart-client";

// The SDK's typed CartItem.meta doesn't include `variation`, but CoCart's
// actual response does - a friendly label map for variation selections,
// e.g. { Color: "Green" } (verified live).
//
// `regular_price`/`on_sale` are present directly on cart items on CoCart
// Starter (added after this session started); the community CoCart plugin
// doesn't return them, so they're optional here and the productPrices
// lookup below covers that case as a fallback.
//
// `quantity` is also mistyped upstream (claims min_purchase/max_purchase;
// the real fields are minimum/maximum/multiple_of/editable, verified
// against CoCart_Utilities_Quantity_Limits and a live cart response) -
// overridden here until the installed SDK build picks up the fix. Built via
// an explicit Pick (not Omit<SDKCartItem, "quantity">) because SDKCartItem
// has a string index signature, which widens `keyof` to `string | number`
// and makes Omit silently collapse every other property's type to
// `unknown` too (the same trap hit earlier with CartTax in the SDK itself).
export interface CartItem
  extends Pick<
    SDKCartItem,
    | "item_key"
    | "id"
    | "name"
    | "title"
    | "price"
    | "totals"
    | "slug"
    | "backorders"
    | "cart_item_data"
    | "featured_image"
  > {
  meta: SDKCartItem["meta"] & {
    variation?: Record<string, string>;
  };
  quantity: {
    value: number;
    minimum: number;
    maximum: number;
    multiple_of: number;
    editable: boolean;
  };
  regular_price?: string;
  on_sale?: boolean;
  [key: string]: unknown;
}

// The SDK's typed `getShippingMethods()`/`ShippingPackage[]` shape doesn't
// match the real wire format - verified against the actual CoCart Plus
// source (class-cocart-plus-rest-set-shipping-method-v2-controller.php) and
// a live request/response on a local dev install. `shipping` is an object
// keyed by total_packages/packages, not an array, and each rate's `cost` is
// a pre-formatted, localized string (e.g. "10,00 €"), not a minor-unit number.
export interface ShippingRate {
  key: string;
  method_id: string;
  instance_id: number;
  label: string;
  cost: string;
  html: string;
  taxes: string;
  chosen_method: boolean;
  meta_data: Record<string, unknown>;
}

export interface ShippingPackageData {
  package_name: string;
  rates: Record<string, ShippingRate>;
  package_details: string;
  index: number;
  chosen_method: string;
  formatted_destination: string;
}

export interface CartShipping {
  total_packages: number;
  show_package_details: boolean;
  has_calculated_shipping: boolean;
  packages: Record<string, ShippingPackageData>;
}

/**
 * The customer's currently-selected shipping rate, or null if shipping
 * hasn't been calculated yet. `cart.totals.shipping_total` stays "0" even
 * once a rate is calculated/chosen (verified live) - the real cost only
 * lives on the rate itself, already formatted (e.g. "$5.00"), not a
 * minor-unit value to run through formatPrice().
 */
export function getChosenShippingRate(
  shipping: CartShipping | null
): ShippingRate | null {
  if (!shipping?.has_calculated_shipping) return null;

  const pkg = Object.values(shipping.packages)[0];
  return pkg?.rates[pkg.chosen_method] ?? null;
}

export interface CheckoutAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

// Fallback for the community CoCart plugin, whose cart response only
// carries each item's current unit `price` - no regular/sale price or
// on-sale flag, unlike the products endpoint's `prices` object. CoCart
// Starter includes regular_price/on_sale directly on cart items instead
// (see CartItem), so this lookup is only populated for items missing that.
export interface ProductPriceInfo {
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
}

/** Regular price to show struck through for an on-sale cart item, or null if not on sale. */
export function getItemRegularPrice(
  item: CartItem,
  productPrices: Record<number, ProductPriceInfo>
): string | null {
  if (item.on_sale !== undefined) {
    return item.on_sale && item.regular_price ? item.regular_price : null;
  }

  const info = productPrices[item.id];
  return info?.on_sale ? info.regular_price : null;
}

// CoCart's `notices` field, keyed by type ("success", "error", "notice",
// "warning") with already-HTML-decoded message strings as values (verified
// live - e.g. `{ "success": ["“Hat” has been added to your cart."] }`).
export type CartNotices = Partial<
  Record<"success" | "error" | "notice" | "warning", string[]>
>;

interface CartState {
  items: CartItem[];
  totals: CartTotals;
  currency: CurrencyInfo;
  shipping: CartShipping | null;
  needsShipping: boolean;
  productPrices: Record<number, ProductPriceInfo>;
  notices: CartNotices;
}

const EMPTY_TOTALS: CartTotals = {
  subtotal: "0",
  subtotal_tax: "0",
  fee_total: "0",
  fee_tax: "0",
  discount_total: "0",
  discount_tax: "0",
  shipping_total: "0",
  shipping_tax: "0",
  total: "0",
  total_tax: "0",
};

const EMPTY_CURRENCY: CurrencyInfo = {
  currency_code: "USD",
  currency_symbol: "$",
  currency_minor_unit: 2,
  currency_decimal_separator: ".",
  currency_thousand_separator: ",",
  currency_prefix: "$",
  currency_suffix: "",
};

export interface AddItemInput {
  productId: number;
  quantity?: number;
  variationId?: number;
  attributes?: Record<string, string>;
}

interface CartContextType {
  cart: CartState;
  isOpen: boolean;
  isLoading: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: AddItemInput) => Promise<void>;
  removeItem: (itemKey: string) => Promise<void>;
  /**
   * Set an item's quantity, clamped to its min/max/step. Debounced - rapid
   * calls for the same or different items are coalesced into one request
   * (a bulk `updateItems()` call when more than one item changed) fired
   * shortly after the last one stops.
   */
  updateQuantity: (itemKey: string, quantity: number) => void;
  /** Increment an item's quantity by its step, clamped to its maximum. Debounced/batched like updateQuantity. */
  incrementQuantity: (itemKey: string) => void;
  /** Decrement an item's quantity by its step, clamped to its minimum (or removes it, if minimum is 1). Debounced/batched like updateQuantity. */
  decrementQuantity: (itemKey: string) => void;
  /** The quantity to display for an item - its pending (not-yet-sent) value if one is scheduled, otherwise its server-confirmed value. */
  getDisplayQuantity: (item: CartItem) => number;
  /** Whether a quantity update request is currently in flight for this item key. */
  isItemPending: (itemKey: string) => boolean;
  clearCart: () => Promise<void>;
  getItemCount: () => number;
  getCartKey: () => string | null;
  /** Re-fetch the cart from the server. Used after login/logout (via AuthProvider) since the customer identity behind the shared client changes. */
  refreshCart: () => Promise<void>;
  /**
   * Push billing (and optionally a different shipping) address to the cart
   * via CoCart Plus's `update-customer` callback on POST /cart/update. Always
   * sends the full `s_`-prefixed shipping field set mirroring billing (Plus
   * requires them whenever a country's address schema marks a field
   * required, regardless of ship_to_different_address) - verified against
   * CoCart Plus source. Recalculates and returns shipping packages/rates
   * when the address is complete enough.
   */
  updateCustomerAddress: (
    billing: CheckoutAddress,
    shipping?: CheckoutAddress
  ) => Promise<void>;
  /** Select a shipping rate for a package (CoCart Plus's set-shipping-method). */
  selectShippingMethod: (rateId: string, packageId?: string) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [cart, setCart] = useState<CartState>({
    items: [],
    totals: EMPTY_TOTALS,
    currency: EMPTY_CURRENCY,
    shipping: null,
    needsShipping: false,
    productPrices: {},
    notices: {},
  });
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingItemKeys, setPendingItemKeys] = useState<Set<string>>(new Set());

  // Optimistic, not-yet-sent quantities keyed by item_key. The ref is the
  // source of truth read synchronously by increment/decrement (so rapid
  // clicks stack correctly without waiting for a render); the state copy
  // exists only to trigger re-renders so getDisplayQuantity reflects it.
  const pendingQuantitiesRef = useRef<Record<string, number>>({});
  const [pendingQuantities, setPendingQuantities] = useState<Record<string, number>>({});
  const quantityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyResponse = useCallback((response: CoCartHttpResponse) => {
    const raw = response.toObject() as {
      shipping?: CartShipping;
      needs_shipping?: boolean;
      notices?: CartNotices | [];
    };

    setCart((prev) => ({
      // getItems() is typed against the SDK's own (incorrect) CartItem -
      // see the note above CartItem for why quantity's fields are wrong
      // there; the real wire data matches our local CartItem.
      items: response.getItems() as unknown as CartItem[],
      totals: response.getTotals(),
      currency: response.getCurrency(),
      shipping: raw.shipping ?? null,
      needsShipping: raw.needs_shipping ?? false,
      productPrices: prev.productPrices,
      // An empty cart's `notices` comes back as `[]`, not `{}`.
      notices: Array.isArray(raw.notices) ? {} : (raw.notices ?? {}),
    }));
  }, []);

  // CoCart Starter includes regular_price/on_sale directly on cart items,
  // so nothing needs fetching there. The community plugin doesn't, so for
  // those items fetch it separately, once per product id, whenever the
  // cart's items change and introduce ids we haven't seen yet.
  useEffect(() => {
    const missingIds = [
      ...new Set(
        cart.items
          .filter((item) => item.on_sale === undefined)
          .map((item) => item.id)
          .filter((id) => !(id in cart.productPrices))
      ),
    ];

    if (missingIds.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const client = getClient();
        const response = await client.products().all({
          include: missingIds.join(","),
          _fields: "id,prices",
        });
        const products = response.get<
          { id: number; prices: ProductPriceInfo }[]
        >("products", []);

        if (cancelled) return;

        setCart((prev) => ({
          ...prev,
          productPrices: products.reduce(
            (acc, product) => {
              acc[product.id] = product.prices;
              return acc;
            },
            { ...prev.productPrices }
          ),
        }));
      } catch (error) {
        console.error("Failed to load product prices for cart items:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cart.items, cart.productPrices]);

  // Loads (or re-loads) the cart from CoCart's server-side session. Used on
  // mount, and exposed as refreshCart() for AuthProvider to call after
  // login/logout, since the customer identity behind the shared client
  // changes at those points.
  const loadCart = useCallback(async () => {
    try {
      const client = getClient();
      await client.restoreSession();
      let response;
      try {
        response = await client.cart().get();
      } catch (error) {
        // A previously logged-in customer's cart_key (their user ID, not a
        // "t_..." guest token) can be left over in storage from before -
        // Basic Auth itself is deliberately not persisted across reloads
        // (see AuthProvider), but the SDK's cart-key storage doesn't know
        // that, so a fresh unauthenticated load can restore an
        // authenticated cart_key it now has no permission to access
        // (`cocart_must_authenticate_user`). Clear it and fall back to a
        // fresh guest cart instead of failing outright.
        //
        // A guest cart_key whose server-side WooCommerce session has
        // expired/been pruned hits the same dead end, just via
        // `cocart_invalid_cart` instead - the fix is identical.
        const isStaleCartKey =
          error instanceof AuthenticationError ||
          (error instanceof ValidationError &&
            error.errorCode === "cocart_invalid_cart");
        if (isStaleCartKey) {
          await client.clearSession();
          response = await client.cart().get();
        } else {
          throw error;
        }
      }
      applyResponse(response);
    } catch (error) {
      console.error("Failed to load cart from CoCart:", error);
    } finally {
      setIsLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    // loadCart() only calls setState after its first await (fetching the
    // session cart from CoCart), not synchronously — this is the textbook
    // fetch-on-mount effect the rule's own linked guidance endorses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCart();
  }, [loadCart]);

  const refreshCart = useCallback(() => loadCart(), [loadCart]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

  const addItem = useCallback(
    async (item: AddItemInput) => {
      const client = getClient();
      const quantity = item.quantity ?? 1;

      const response = item.variationId
        ? await client.cart().addVariation(item.variationId, quantity, item.attributes ?? {})
        : await client.cart().add(item.productId, quantity);

      applyResponse(response);
      setIsOpen(true);
    },
    [applyResponse]
  );

  const removeItem = useCallback(
    async (itemKey: string) => {
      // Drop any debounced quantity change for this item - it's about to
      // stop existing, so a stale scheduled update would otherwise land
      // afterward and fail with "item not in cart".
      if (itemKey in pendingQuantitiesRef.current) {
        const next = { ...pendingQuantitiesRef.current };
        delete next[itemKey];
        pendingQuantitiesRef.current = next;
        setPendingQuantities((prev) => {
          const copy = { ...prev };
          delete copy[itemKey];
          return copy;
        });
      }

      const client = getClient();
      const response = await client.cart().removeItem(itemKey);
      applyResponse(response);
    },
    [applyResponse]
  );

  // Fires once no quantity button has been pressed for QUANTITY_DEBOUNCE_MS.
  // Everything accumulated in pendingQuantitiesRef since the last flush goes
  // out together - one updateItem() call if only one item changed, one
  // bulk updateItems() call (sequential requests under the hood - see the
  // SDK CHANGELOG, there's no real bulk endpoint) if several did.
  const flushQuantityUpdates = useCallback(async () => {
    const updates = pendingQuantitiesRef.current;
    pendingQuantitiesRef.current = {};
    quantityDebounceRef.current = null;

    const itemKeys = Object.keys(updates);
    if (itemKeys.length === 0) return;

    setPendingItemKeys((prev) => {
      const next = new Set(prev);
      itemKeys.forEach((key) => next.add(key));
      return next;
    });

    try {
      const client = getClient();
      const response =
        itemKeys.length === 1
          ? await client.cart().updateItem(itemKeys[0], updates[itemKeys[0]])
          : await client.cart().updateItems(
              itemKeys.reduce<Record<string, number>>((acc, key) => {
                acc[key] = updates[key];
                return acc;
              }, {})
            );
      applyResponse(response);
    } catch (error) {
      console.error("Failed to update cart item quantities:", error);
    } finally {
      setPendingItemKeys((prev) => {
        const next = new Set(prev);
        itemKeys.forEach((key) => next.delete(key));
        return next;
      });
      setPendingQuantities((prev) => {
        const next = { ...prev };
        itemKeys.forEach((key) => delete next[key]);
        return next;
      });
    }
  }, [applyResponse]);

  const QUANTITY_DEBOUNCE_MS = 500;

  const scheduleQuantityUpdate = useCallback(
    (itemKey: string, quantity: number) => {
      pendingQuantitiesRef.current = { ...pendingQuantitiesRef.current, [itemKey]: quantity };
      setPendingQuantities((prev) => ({ ...prev, [itemKey]: quantity }));

      if (quantityDebounceRef.current) clearTimeout(quantityDebounceRef.current);
      quantityDebounceRef.current = setTimeout(flushQuantityUpdates, QUANTITY_DEBOUNCE_MS);
    },
    [flushQuantityUpdates]
  );

  const updateQuantity = useCallback(
    (itemKey: string, quantity: number) => {
      const item = cart.items.find((i) => i.item_key === itemKey);
      const min = item?.quantity.minimum ?? 1;
      const max = item?.quantity.maximum;

      if (quantity <= 0) {
        scheduleQuantityUpdate(itemKey, 0);
        return;
      }

      let clamped = Math.max(quantity, min);
      if (typeof max === "number" && max > 0) clamped = Math.min(clamped, max);
      scheduleQuantityUpdate(itemKey, clamped);
    },
    [cart.items, scheduleQuantityUpdate]
  );

  const incrementQuantity = useCallback(
    (itemKey: string) => {
      const item = cart.items.find((i) => i.item_key === itemKey);
      if (!item) return;

      const step = item.quantity.multiple_of || 1;
      const max = item.quantity.maximum;
      const current = pendingQuantitiesRef.current[itemKey] ?? item.quantity.value;
      const next = current + step;
      scheduleQuantityUpdate(itemKey, typeof max === "number" && max > 0 ? Math.min(next, max) : next);
    },
    [cart.items, scheduleQuantityUpdate]
  );

  const decrementQuantity = useCallback(
    (itemKey: string) => {
      const item = cart.items.find((i) => i.item_key === itemKey);
      if (!item) return;

      const step = item.quantity.multiple_of || 1;
      const min = item.quantity.minimum || 1;
      const current = pendingQuantitiesRef.current[itemKey] ?? item.quantity.value;
      const next = current - step;
      // Below the minimum purchase quantity: if that minimum is 1 (the
      // common case), let decrementing to 0 remove the item, same as
      // before; otherwise (e.g. sold in packs of 2+) clamp at the minimum
      // instead, since dropping below it isn't a valid quantity to send.
      scheduleQuantityUpdate(itemKey, next < min ? (min <= 1 ? 0 : min) : next);
    },
    [cart.items, scheduleQuantityUpdate]
  );

  const getDisplayQuantity = useCallback(
    (item: CartItem) => pendingQuantities[item.item_key] ?? item.quantity.value,
    [pendingQuantities]
  );

  const isItemPending = useCallback(
    (itemKey: string) => pendingItemKeys.has(itemKey),
    [pendingItemKeys]
  );

  const clearCart = useCallback(async () => {
    const client = getClient();
    const response = await client.cart().clear();
    applyResponse(response);
  }, [applyResponse]);

  const getItemCount = useCallback(() => {
    return cart.items.reduce((sum, item) => sum + item.quantity.value, 0);
  }, [cart.items]);

  const getCartKey = useCallback(() => {
    return getClient().getCartKey();
  }, []);

  const updateCustomerAddress = useCallback(
    async (billing: CheckoutAddress, shipping?: CheckoutAddress) => {
      const client = getClient();
      const shipTo = shipping ?? billing;

      // The update-customer callback only throws a "field is required" error
      // when a field is explicitly present in the request AND empty - it's
      // designed to support incremental/partial updates as a form is filled
      // in. So only include fields that actually have a value; sending
      // company: "" (etc.) before the user has typed anything would count
      // as "explicitly cleared" and trigger that validation prematurely for
      // any field this store's WooCommerce locale marks as required.
      const set = (target: Record<string, unknown>, key: string, value?: string) => {
        if (value) target[key] = value;
      };

      const data: Record<string, unknown> = { namespace: "update-customer" };
      set(data, "first_name", billing.first_name);
      set(data, "last_name", billing.last_name);
      set(data, "company", billing.company);
      set(data, "address_1", billing.address_1);
      set(data, "address_2", billing.address_2);
      set(data, "city", billing.city);
      set(data, "state", billing.state);
      set(data, "postcode", billing.postcode);
      set(data, "country", billing.country);
      set(data, "email", billing.email);
      set(data, "phone", billing.phone);

      // CoCart Plus's update-customer callback requires these s_-prefixed
      // fields whenever the country's address schema marks them required,
      // even when shipping mirrors billing - so always send whichever ones
      // have a value.
      set(data, "s_first_name", shipTo.first_name);
      set(data, "s_last_name", shipTo.last_name);
      set(data, "s_company", shipTo.company);
      set(data, "s_address_1", shipTo.address_1);
      set(data, "s_address_2", shipTo.address_2);
      set(data, "s_city", shipTo.city);
      set(data, "s_state", shipTo.state);
      set(data, "s_postcode", shipTo.postcode);
      set(data, "s_country", shipTo.country);

      if (shipping) data.ship_to_different_address = true;

      const response = await client.post("cart/update", data);
      applyResponse(response);
    },
    [applyResponse]
  );

  const selectShippingMethod = useCallback(
    async (rateId: string, packageId?: string) => {
      const client = getClient();
      const data: Record<string, unknown> = { rate_id: rateId };
      if (packageId) data.package_id = packageId;

      const response = await client.post("cart/set-shipping-method", data);
      applyResponse(response);
    },
    [applyResponse]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        isOpen,
        isLoading,
        openCart,
        closeCart,
        toggleCart,
        addItem,
        removeItem,
        updateQuantity,
        incrementQuantity,
        decrementQuantity,
        getDisplayQuantity,
        isItemPending,
        clearCart,
        getItemCount,
        getCartKey,
        refreshCart,
        updateCustomerAddress,
        selectShippingMethod,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
