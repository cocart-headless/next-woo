"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useCart, getChosenShippingRate } from "@/components/shop/cart-provider";
import type { CheckoutAddress } from "@/components/shop/cart-provider";
import { useAuth } from "@/components/shop";
import { CartNotices } from "@/components/shop/cart-notices";
import { StripeCardSection } from "@/components/shop/stripe-card-section";
import { getStripe } from "@/lib/stripe-client";
import { formatPrice } from "@/lib/cocart";
import {
  getCheckoutConfig,
  getPaymentMethods,
  processCheckout,
  type CheckoutConfigResponse,
  type PaymentMethod,
  type CheckoutPaymentDataEntry,
  type PaymentResult,
} from "@/lib/cocart-checkout";
import { getMyAccount, type AccountAddress } from "@/lib/cocart-account";
import { Section, Container } from "@/components/craft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddressFields {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

interface CheckoutFormData {
  email: string;
  phone: string;
  // The primary address collected up front. Doubles as the sole/billing
  // address when the cart doesn't need shipping.
  shipping: AddressFields;
  // Only meaningful when the cart needs shipping - false means billing
  // mirrors the shipping address (the common case), matching CoCart's own
  // `use_different_billing` flag.
  billingIsDifferent: boolean;
  billing: AddressFields;
  notes: string;
}

const emptyAddress = (country: string): AddressFields => ({
  firstName: "",
  lastName: "",
  company: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postcode: "",
  country,
});

function addressFromAccount(
  addr: AccountAddress | undefined,
  fallback: AddressFields
): AddressFields {
  if (!addr) return fallback;
  return {
    firstName: addr.first_name || fallback.firstName,
    lastName: addr.last_name || fallback.lastName,
    company: addr.company || fallback.company,
    address1: addr.address_1 || fallback.address1,
    address2: addr.address_2 || fallback.address2,
    city: addr.city || fallback.city,
    state: addr.state || fallback.state,
    postcode: addr.postcode || fallback.postcode,
    country: addr.country || fallback.country,
  };
}

// Maps this page's camelCase field names onto CoCart's unprefixed
// first_name/address_1/etc. shape - satisfies both CheckoutAddressFields
// (all-optional, for POST /checkout) and CheckoutAddress (a few fields
// required, for the shipping-rate-calc call) since every field here is
// always a populated string.
function toAddressPayload(fields: AddressFields) {
  return {
    first_name: fields.firstName,
    last_name: fields.lastName,
    company: fields.company,
    address_1: fields.address1,
    address_2: fields.address2,
    city: fields.city,
    state: fields.state,
    postcode: fields.postcode,
    country: fields.country,
  };
}

// Renders one address's field set. `prefix` sets both the id/name
// (`shipping_address_1`, `billing_address_1`, ...) and the autocomplete
// section token (`shipping address-line1`, `billing address-line1`) so
// browser/password-manager autofill can tell the two forms apart when both
// are visible at once - omit it for the single-address (no shipping needed)
// case, where bare tokens are the spec-correct choice.
function AddressFieldset({
  prefix,
  values,
  onChange,
  countries,
}: {
  prefix?: "shipping" | "billing";
  values: AddressFields;
  onChange: (field: keyof AddressFields, value: string) => void;
  countries: CheckoutConfigResponse["countries"]["allowed_countries"] | null;
}) {
  const idPrefix = prefix ? `${prefix}_` : "";
  const ac = prefix ? `${prefix} ` : "";

  const bind = (field: keyof AddressFields) => ({
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(field, e.target.value),
  });

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}first_name`}>First Name *</Label>
          <Input
            id={`${idPrefix}first_name`}
            name={`${idPrefix}first_name`}
            autoComplete={`${ac}given-name`}
            required
            {...bind("firstName")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}last_name`}>Last Name *</Label>
          <Input
            id={`${idPrefix}last_name`}
            name={`${idPrefix}last_name`}
            autoComplete={`${ac}family-name`}
            required
            {...bind("lastName")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}company`}>Company (optional)</Label>
        <Input
          id={`${idPrefix}company`}
          name={`${idPrefix}company`}
          autoComplete={`${ac}organization`}
          {...bind("company")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}address_1`}>Street Address *</Label>
        <Input
          id={`${idPrefix}address_1`}
          name={`${idPrefix}address_1`}
          autoComplete={`${ac}address-line1`}
          required
          placeholder="House number and street name"
          {...bind("address1")}
        />
        <Input
          id={`${idPrefix}address_2`}
          name={`${idPrefix}address_2`}
          autoComplete={`${ac}address-line2`}
          placeholder="Apartment, suite, unit, etc. (optional)"
          {...bind("address2")}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}city`}>City *</Label>
          <Input
            id={`${idPrefix}city`}
            name={`${idPrefix}city`}
            autoComplete={`${ac}address-level2`}
            required
            {...bind("city")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}state`}>State / Province *</Label>
          <Input
            id={`${idPrefix}state`}
            name={`${idPrefix}state`}
            autoComplete={`${ac}address-level1`}
            required
            {...bind("state")}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}postcode`}>ZIP / Postal Code *</Label>
          <Input
            id={`${idPrefix}postcode`}
            name={`${idPrefix}postcode`}
            autoComplete={`${ac}postal-code`}
            required
            {...bind("postcode")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}country`}>Country *</Label>
          {countries ? (
            <Select
              value={values.country}
              onValueChange={(value) => onChange("country", value)}
            >
              <SelectTrigger id={`${idPrefix}country`}>
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(countries).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`${idPrefix}country`}
              name={`${idPrefix}country`}
              autoComplete={`${ac}country`}
              required
              {...bind("country")}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  const { cart, isLoading, clearCart, refreshCart, updateCustomerAddress, selectShippingMethod } =
    useCart();
  const { isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  // True once the address has been saved to the cart at least once,
  // regardless of whether shipping rates came back - distinguishes "still
  // typing" from "saved, but this store can't calculate shipping rates"
  // (e.g. CoCart Plus isn't installed/active, so cart.shipping never
  // populates no matter how complete the address is).
  const [addressSaved, setAddressSaved] = useState(false);

  const [countries, setCountries] = useState<
    CheckoutConfigResponse["countries"]["allowed_countries"] | null
  >(null);
  const [paymentMethods, setPaymentMethods] = useState<
    Record<string, PaymentMethod>
  >({});
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentMethodsError, setPaymentMethodsError] = useState<
    string | null
  >(null);
  // Set by StripeCardSection once Stripe.js/the card element are ready;
  // cleared (null) while unmounted or loading. Only relevant when
  // paymentMethod === "stripe".
  const stripeCreatePaymentMethodRef = useRef<(() => Promise<string>) | null>(
    null
  );

  const [formData, setFormData] = useState<CheckoutFormData>({
    email: "",
    phone: "",
    shipping: emptyAddress("US"),
    billingIsDifferent: false,
    billing: emptyAddress("US"),
    notes: "",
  });

  const needsShipping = cart.needsShipping;
  // The address that actually applies as billing: the separate billing form
  // when the cart needs shipping and the customer said it differs, the
  // single address form when the cart doesn't need shipping at all,
  // otherwise a mirror of the shipping address.
  const billingSource =
    !needsShipping || formData.billingIsDifferent ? formData.billing : formData.shipping;

  // Fetch static checkout config (for the country select) once on mount -
  // it's public, store-level metadata that doesn't depend on the cart.
  useEffect(() => {
    getCheckoutConfig()
      .then((config) => setCountries(config.countries.allowed_countries))
      .catch((err) => console.error("Failed to load checkout config:", err));
  }, []);

  // Prefill address details from the logged-in customer's account so they
  // don't have to retype an address (and especially their email) they've
  // already given us. Prefers the account's saved shipping address for the
  // primary (shipping) form, falling back to billing/account name - and if
  // the account has both a billing and a shipping address on file and they
  // differ, pre-checks "billing is different" and prefills the billing form
  // too. Never overwrites once typed, since this only runs when
  // `isAuthenticated` changes (login/mount), not on every keystroke.
  useEffect(() => {
    if (!isAuthenticated) return;

    getMyAccount()
      .then((account) => {
        const billing = account.user.addresses.billing;
        const shipping = account.user.addresses.shipping;

        setFormData((prev) => {
          const nextShipping = addressFromAccount(shipping ?? billing, {
            ...prev.shipping,
            firstName: prev.shipping.firstName || account.user.first_name,
            lastName: prev.shipping.lastName || account.user.last_name,
          });

          const isDifferent = Boolean(
            billing &&
              shipping &&
              (billing.address_1 !== shipping.address_1 ||
                billing.city !== shipping.city ||
                billing.postcode !== shipping.postcode ||
                billing.country !== shipping.country)
          );

          return {
            ...prev,
            email: billing?.email || account.user.email || prev.email,
            phone: billing?.phone || prev.phone,
            shipping: nextShipping,
            billingIsDifferent: isDifferent || prev.billingIsDifferent,
            billing: isDifferent ? addressFromAccount(billing, prev.billing) : prev.billing,
          };
        });
      })
      .catch((err) =>
        console.error("Failed to load account details for checkout:", err)
      );
  }, [isAuthenticated]);

  // Fetch available payment gateways once the cart has items.
  useEffect(() => {
    if (cart.items.length === 0) return;

    getPaymentMethods()
      .then((methods) => {
        setPaymentMethods(methods);
        const ids = Object.keys(methods);
        setPaymentMethod((prev) => (prev && ids.includes(prev) ? prev : (ids[0] ?? "")));
      })
      .catch((err) => {
        setPaymentMethodsError(
          err instanceof Error ? err.message : "Failed to load payment methods"
        );
      });
  }, [cart.items.length]);

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, notes: e.target.value }));
  };

  const handleShippingFieldChange = (field: keyof AddressFields, value: string) => {
    setFormData((prev) => ({ ...prev, shipping: { ...prev.shipping, [field]: value } }));
  };

  const handleBillingFieldChange = (field: keyof AddressFields, value: string) => {
    setFormData((prev) => ({ ...prev, billing: { ...prev.billing, [field]: value } }));
  };

  // Push the address to CoCart's cart (via the update-customer callback)
  // whenever the shipping address fields settle, so shipping rates get
  // calculated before the user reaches payment. Debounced to avoid a
  // request per keystroke. Both saving the address and calculating/
  // returning shipping rates work on CoCart Basic alone - only *selecting*
  // a non-default rate (selectShippingMethod, below) requires CoCart Plus.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!needsShipping || cart.items.length === 0) return;

    const hasEnoughAddress =
      formData.shipping.address1.trim() &&
      formData.shipping.city.trim() &&
      formData.shipping.postcode.trim() &&
      formData.shipping.country.trim();

    if (!hasEnoughAddress) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsCalculatingShipping(true);
      setShippingError(null);

      const billing: CheckoutAddress = {
        ...toAddressPayload(billingSource),
        email: formData.email,
        phone: formData.phone,
      };
      const shipping: CheckoutAddress = toAddressPayload(formData.shipping);

      try {
        await updateCustomerAddress(billing, shipping);
        setAddressSaved(true);
      } catch (err) {
        setShippingError(
          err instanceof Error ? err.message : "Failed to calculate shipping"
        );
      } finally {
        setIsCalculatingShipping(false);
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, needsShipping, cart.items.length]);

  const handleSelectShippingMethod = async (rateId: string, packageId: string) => {
    setShippingError(null);
    try {
      await selectShippingMethod(rateId, packageId);
    } catch (err) {
      // Most likely CoCart Plus isn't installed/active - selecting a
      // non-default rate requires it, even though rates themselves are
      // calculated and displayed by CoCart Basic alone.
      setShippingError(
        err instanceof Error ? err.message : "Failed to change shipping method"
      );
    }
  };

  const submitCheckout = (paymentData: CheckoutPaymentDataEntry[]) => {
    const billingAddress = {
      ...toAddressPayload(billingSource),
      email: formData.email,
      phone: formData.phone,
    };

    return processCheckout({
      billing_address: billingAddress,
      shipping_address: needsShipping ? toAddressPayload(formData.shipping) : undefined,
      use_different_billing: needsShipping ? formData.billingIsDifferent : false,
      payment_method: paymentMethod,
      payment_data: paymentData,
      customer_note: formData.notes,
    });
  };

  // Confirms a Stripe PaymentIntent/SetupIntent client-side (3DS/SCA), then
  // retries the checkout once - no payment_data needed on retry, the
  // gateway looks up the PaymentIntent it already attached to the order.
  // Attempted exactly once: whatever comes back (even another
  // requires_action) is handled by handlePaymentResult as normal, rather
  // than looping.
  const confirmStripeAction = async (
    actionData: Record<string, unknown>
  ): Promise<PaymentResult> => {
    const stripe = await getStripe();
    if (!stripe) {
      return { payment_status: "failed", message: "Stripe is not configured." };
    }

    const clientSecret = actionData.client_secret;
    if (typeof clientSecret !== "string") {
      return { payment_status: "failed", message: "Missing Stripe client secret." };
    }

    const { error } =
      actionData.intent_type === "setup_intent"
        ? await stripe.confirmCardSetup(clientSecret)
        : await stripe.confirmCardPayment(clientSecret);

    if (error) {
      return {
        payment_status: "failed",
        message: error.message ?? "Payment confirmation failed.",
      };
    }

    const { payment_result } = await submitCheckout([]);
    return payment_result;
  };

  const handlePaymentResult = async (payment_result: PaymentResult) => {
    switch (payment_result.payment_status) {
      case "success":
      case "no_payment_required":
      case "on_hold":
        await clearCart();
        window.location.href = payment_result.redirect_url;
        break;

      case "requires_action":
        if (
          payment_result.action_type === "gateway_redirect_required" &&
          typeof payment_result.action_data.redirect === "string"
        ) {
          window.location.href = payment_result.action_data.redirect;
        } else {
          setError(
            "This payment method isn't supported yet. Please choose a different one."
          );
        }
        break;

      case "failed":
        // The API clears the cart/draft order even on a plain `failed`
        // result (only `requires_action` keeps it alive for retry) - if
        // we don't refresh here, the UI is left showing a cart that no
        // longer exists server-side, and resubmitting fails with
        // "Cannot checkout with empty cart" instead of the real error.
        setError(payment_result.message);
        await refreshCart();
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let paymentData: CheckoutPaymentDataEntry[] = [];

      if (paymentMethod === "stripe") {
        if (!stripeCreatePaymentMethodRef.current) {
          throw new Error(
            "Card details aren't ready yet - please wait a moment and try again."
          );
        }
        const paymentMethodId = await stripeCreatePaymentMethodRef.current();
        paymentData = [{ key: "wc-stripe-payment-method", value: paymentMethodId }];
      }

      let { payment_result } = await submitCheckout(paymentData);

      if (
        payment_result.payment_status === "requires_action" &&
        payment_result.action_type === "stripe_confirm_payment"
      ) {
        payment_result = await confirmStripeAction(payment_result.action_data);
      }

      await handlePaymentResult(payment_result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Section>
        <Container>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </Container>
      </Section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <Section>
        <Container>
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">Your cart is empty</h1>
              <p className="text-muted-foreground">
                Add some items to your cart before checking out.
              </p>
            </div>
            <Button asChild>
              <Link href="/shop">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Continue Shopping
              </Link>
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  const shippingRate = getChosenShippingRate(cart.shipping);

  return (
    <Section>
      <Container>
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/cart">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Checkout</h1>
          </div>

          <CartNotices />

          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="border rounded-lg p-6 space-y-4">
                  <h2 className="text-xl font-bold">Contact Information</h2>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={formData.email}
                      onChange={handleContactChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      required
                      value={formData.phone}
                      onChange={handleContactChange}
                    />
                  </div>
                </div>

                {needsShipping && (
                  <div className="border rounded-lg p-6 space-y-4">
                    <h2 className="text-xl font-bold">Shipping Address</h2>
                    <AddressFieldset
                      prefix="shipping"
                      values={formData.shipping}
                      onChange={handleShippingFieldChange}
                      countries={countries}
                    />
                  </div>
                )}

                <div className="border rounded-lg p-6 space-y-4">
                  <h2 className="text-xl font-bold">Billing Address</h2>

                  {needsShipping && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={formData.billingIsDifferent}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            billingIsDifferent: e.target.checked,
                          }))
                        }
                      />
                      Billing address is different from shipping address
                    </label>
                  )}

                  {(!needsShipping || formData.billingIsDifferent) && (
                    <AddressFieldset
                      prefix={needsShipping ? "billing" : undefined}
                      values={formData.billing}
                      onChange={handleBillingFieldChange}
                      countries={countries}
                    />
                  )}
                </div>

                <div className="border rounded-lg p-6 space-y-4">
                  <h2 className="text-xl font-bold">Payment Method</h2>
                  {paymentMethodsError && (
                    <p className="text-sm text-destructive">{paymentMethodsError}</p>
                  )}
                  {Object.keys(paymentMethods).length === 0 && !paymentMethodsError ? (
                    <p className="text-sm text-muted-foreground">
                      Loading payment methods...
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {Object.values(paymentMethods).map((method) => (
                        <label
                          key={method.id}
                          className="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="payment_method"
                            className="mt-1"
                            checked={paymentMethod === method.id}
                            onChange={() => setPaymentMethod(method.id)}
                          />
                          <span>
                            <span className="block text-sm font-medium">
                              {method.title}
                            </span>
                            {method.description && (
                              <span className="block text-xs text-muted-foreground">
                                {method.description}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {paymentMethod === "stripe" && (
                    <div className="pt-2">
                      <Label className="mb-2 block">Card Details</Label>
                      <StripeCardSection
                        onReady={(fn) => {
                          stripeCreatePaymentMethodRef.current = fn;
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-6 space-y-4">
                  <h2 className="text-xl font-bold">Order Notes (optional)</h2>
                  <textarea
                    name="notes"
                    rows={4}
                    className="w-full px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Notes about your order, e.g. special notes for delivery"
                    value={formData.notes}
                    onChange={handleNotesChange}
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="border rounded-lg p-6 space-y-4 sticky top-4">
                  <h2 className="text-xl font-bold">Your Order</h2>

                  <div className="space-y-3">
                    {cart.items.map((item) => (
                      <div key={item.item_key} className="flex gap-3">
                        <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                          {item.featured_image ? (
                            <Image
                              src={item.featured_image}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-muted-foreground text-xs">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">
                            {item.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {item.quantity.value}
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {formatPrice(item.totals.total, cart.currency)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatPrice(cart.totals.subtotal, cart.currency)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>
                        {!cart.needsShipping ? (
                          "Not required"
                        ) : isCalculatingShipping ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : shippingRate ? (
                          shippingRate.cost
                        ) : addressSaved ? (
                          "Calculated at the next step"
                        ) : (
                          "Enter your address to calculate"
                        )}
                      </span>
                    </div>

                    {shippingError && (
                      <p className="text-xs text-destructive">{shippingError}</p>
                    )}

                    {cart.needsShipping &&
                      cart.shipping?.has_calculated_shipping &&
                      Object.entries(cart.shipping.packages).map(([packageId, pkg]) => {
                        const rateEntries = Object.entries(pkg.rates);
                        if (rateEntries.length <= 1) return null;

                        return (
                          <div key={packageId} className="space-y-1.5 pt-1">
                            {rateEntries.map(([rateKey, rate]) => (
                              <label
                                key={rateKey}
                                className="flex items-center justify-between text-sm gap-2 cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`shipping-${packageId}`}
                                    checked={pkg.chosen_method === rateKey}
                                    onChange={() => handleSelectShippingMethod(rateKey, packageId)}
                                  />
                                  {rate.label}
                                </span>
                                <span className="text-muted-foreground">{rate.cost}</span>
                              </label>
                            ))}
                          </div>
                        );
                      })}
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatPrice(cart.totals.total, cart.currency)}</span>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting || !paymentMethod}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Place Order"
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    By placing your order, you agree to our Terms of Service and
                    Privacy Policy.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </Container>
    </Section>
  );
}
