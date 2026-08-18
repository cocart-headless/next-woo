// CoCart Plus headless checkout API client.
//
// Thin typed wrapper over `cocart/v2/checkout*`, `cocart/v2/address/*` and
// `cocart/v2/order-received/*`, built on the shared CoCart SDK client
// (see lib/cocart-client.ts) so every call carries the same cart-key/auth
// headers the cart already uses. Response shapes below are verified against
// a live install, not just the controllers' source or `OPTIONS` schema -
// notably: GET/PUT/PATCH `checkout`'s `currency` field has its own shape,
// distinct from the SDK's `CurrencyInfo` (cart/product endpoints); and its
// `customer.billing_address`/`shipping_address` use WooCommerce's
// `billing_`/`shipping_`-prefixed field names (e.g. `billing_first_name`),
// while POST `checkout`'s top-level `billing_address`/`shipping_address` in
// both the *request* and *response* use unprefixed names (`first_name`) -
// these are genuinely different shapes, not a documentation inconsistency.

import { getClient } from "@/lib/cocart-client";

// Request/response shape for POST `checkout` (and PUT/PATCH's *request*
// body) - unprefixed field names.
export interface CheckoutAddressFields {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

// GET/PUT/PATCH `checkout` response shape for `customer.billing_address` -
// WooCommerce's own `billing_`-prefixed field names.
export interface CheckoutCustomerBillingAddress {
  billing_first_name: string;
  billing_last_name: string;
  billing_company: string;
  billing_country: string;
  billing_address_1: string;
  billing_address_2: string;
  billing_city: string;
  billing_state: string;
  billing_postcode: string;
  billing_phone: string;
  billing_email: string;
}

// GET/PUT/PATCH `checkout` response shape for `customer.shipping_address` -
// WooCommerce's own `shipping_`-prefixed field names (no email/phone).
export interface CheckoutCustomerShippingAddress {
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_company: string;
  shipping_country: string;
  shipping_address_1: string;
  shipping_address_2: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postcode: string;
  shipping_phone: string;
}

export interface CheckoutCustomer {
  customer_id: number;
  billing_address: CheckoutCustomerBillingAddress;
  shipping_address: CheckoutCustomerShippingAddress;
}

// GET/PUT/PATCH `checkout` response's `currency` field - distinct from the
// SDK's `CurrencyInfo` (used by cart/product endpoints).
export interface CheckoutCurrency {
  code: string;
  symbol: string;
  default_currency: string;
  exchange_rate: number;
}

export interface CheckoutCartTotals {
  subtotal: string;
  subtotal_tax: string;
  fee_total: string;
  fee_tax: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_contents_total: string;
  cart_contents_tax: string;
  total: string;
  total_tax: string;
}

export interface CheckoutShippingMethodOption {
  id: string;
  label: string;
  cost: string;
  method_id: string;
  instance_id: number;
}

// GET/PUT/PATCH `checkout` response - abstract-cocart-checkout-controller.php get_checkout_data().
export interface CheckoutData {
  cart_hash: string;
  cart_key: string;
  currency: CheckoutCurrency;
  customer: CheckoutCustomer;
  items: unknown[];
  coupons: unknown[];
  needs_payment: boolean;
  needs_shipping: boolean;
  shipping_methods: Record<string, CheckoutShippingMethodOption>;
  payment_method: string;
  fees: unknown[];
  cart_totals: CheckoutCartTotals;
  message: string;
}

export interface CheckoutUpdateInput {
  billing_address?: CheckoutAddressFields;
  shipping_address?: CheckoutAddressFields;
  use_different_billing?: boolean;
  payment_method?: string;
  shipping_method?: string;
  currency?: string;
  coupon_code?: string;
  coupon_action?: "apply" | "remove";
}

export interface CheckoutPaymentDataEntry {
  key: string;
  value: string | boolean | number;
}

export interface CheckoutProcessInput extends CheckoutUpdateInput {
  payment_data?: CheckoutPaymentDataEntry[];
  create_account?: boolean;
  customer_password?: string;
  customer_note?: string;
}

// PaymentResult.payment_status is a discriminated union - narrow on it
// before reading action_type/action_data/redirect_url/message.
export type PaymentResult =
  | { payment_status: "success"; redirect_url: string }
  | { payment_status: "no_payment_required"; redirect_url: string }
  | {
      payment_status: "on_hold";
      redirect_url: string;
      action_type?: string;
      action_data?: Record<string, unknown>;
    }
  | {
      payment_status: "requires_action";
      action_type: string;
      action_data: Record<string, unknown>;
    }
  | { payment_status: "failed"; message: string };

// POST `checkout` response - class-cocart-plus-rest-checkout-process-v2-controller.php.
export interface CheckoutProcessResponse {
  order_id: number;
  status: string;
  order_key: string;
  order_number: string;
  payment_result: PaymentResult;
  customer_id: number;
  billing_address: CheckoutAddressFields;
  shipping_address: CheckoutAddressFields;
}

export interface PaymentMethodConfig {
  test_mode: boolean;
  is_connected: boolean;
  supports_tokenization: boolean;
  supports_refunds: boolean;
  supports_subscriptions: boolean;
  requires_billing_address: boolean;
}

export interface SavedPaymentToken {
  id: number;
  token: string;
  type: string;
  gateway_id: string;
  is_default: boolean;
  expires: string | null;
}

export interface PaymentMethod {
  id: string;
  title: string;
  description: string;
  supports: string[];
  has_fields: boolean;
  order_button_text: string;
  method_title: string;
  method_description: string;
  config: PaymentMethodConfig;
  saved_tokens: SavedPaymentToken[];
  supports_save_payment: boolean;
}

export type PaymentMethodsResponse = Record<string, PaymentMethod>;

export interface CheckoutFieldDefinition {
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  class?: string[];
  autocomplete?: string;
  priority?: number;
  options?: Record<string, string>;
  default?: string;
  country_field?: string;
  maxlength?: number;
}

export interface CheckoutConfigResponse {
  fields: {
    billing: Record<string, CheckoutFieldDefinition>;
    shipping: Record<string, CheckoutFieldDefinition>;
    account: Record<string, CheckoutFieldDefinition>;
    order: Record<string, CheckoutFieldDefinition>;
  };
  locale_settings: Record<string, unknown>;
  countries: {
    allowed_countries: Record<string, string>;
    shipping_countries: Record<string, string>;
    states: Record<string, Record<string, string>>;
    default_country: string;
    eu_countries: string[];
  };
  shipping: {
    enabled: boolean;
    calc_shipping: boolean;
    ship_to_countries: string;
    ship_to_billing_address: boolean;
    shipping_cost_requires_address: boolean;
  };
  account: {
    allow_registration: boolean;
    registration_generate_username: boolean;
    registration_generate_password: boolean;
    guest_checkout_enabled: boolean;
    must_create_account: boolean;
  };
  store: {
    currency: string;
    currency_symbol: string;
    currency_position: string;
    price_decimal_sep: string;
    price_thousand_sep: string;
    price_decimals: number;
    tax_enabled: boolean;
    tax_display_cart: string;
    prices_include_tax: boolean;
    coupons_enabled: boolean;
    terms_page_id: number;
    privacy_page_id: number;
    store_address: CheckoutAddressFields;
    terms_text?: string;
  };
  validation: {
    postcode: { patterns: Record<string, string> };
    phone: { enabled: boolean };
    email: { enabled: boolean };
  };
}

export interface AddressSuggestion {
  id: string;
  label: string;
  matched_substrings?: { offset: number; length: number }[];
}

export interface AddressSearchParams {
  query: string;
  country?: string;
  type?: "billing" | "shipping";
  provider?: string;
}

export interface AddressSearchResult {
  suggestions: AddressSuggestion[];
  count: number;
  provider: { id: string; name: string };
  search_country: string;
  query: string;
}

export interface AddressDetailsParams {
  address_id: string;
  provider: string;
}

export interface AddressDetailsResult {
  address: CheckoutAddressFields;
  provider: { id: string; name: string };
}

export interface OrderLineItemMeta {
  id: number;
  key: string;
  display_key: string;
  display_value: string;
}

export interface OrderLineItem {
  item_id: number;
  product_id: number;
  variation_id: number;
  product_name: string;
  product_image: string | null;
  quantity: number;
  // Verified live: unlike every other total/subtotal field here (formatted
  // strings), this one comes back as a raw number.
  subtotal: number;
  total: string;
  meta_data: OrderLineItemMeta[];
}

export interface OrderTotalLine {
  key: string;
  label: string;
  value: string;
}

export interface AvailablePaymentMethod {
  id: string;
  title: string;
  description: string;
  has_fields: boolean;
}

// GET `order-received/{id}` response - class-cocart-plus-rest-order-received-v2-controller.php.
export interface OrderReceived {
  order_id: number;
  order_number: string;
  order_key: string;
  status: string;
  status_name: string;
  date_created: string;
  date_paid: string | null;
  currency: string;
  total: string;
  // Verified live: unlike total/tax_total/shipping_total/discount_total
  // (formatted strings), this one comes back as a raw number.
  subtotal: number;
  tax_total: string;
  shipping_total: string;
  discount_total: string;
  payment_method: string;
  payment_method_title: string;
  customer_id: number;
  customer_note: string;
  billing_address: CheckoutAddressFields;
  shipping_address: CheckoutAddressFields;
  items: OrderLineItem[];
  totals: OrderTotalLine[];
  needs_payment: boolean;
  needs_shipping: boolean;
  has_downloads: boolean;
  download_url: string | null;
  available_payment_methods?: AvailablePaymentMethod[];
}

export interface PayForOrderInput {
  payment_method: string;
  payment_data?: CheckoutPaymentDataEntry[];
}

// POST `order-received/{id}/pay` response. Note: unlike POST /checkout,
// this endpoint has no `requires_action` envelope - a gateway needing
// further customer action here surfaces as a thrown CoCartError instead.
export interface PayForOrderResponse {
  success: true;
  order_id: number;
  order_status: string;
  redirect_url: string;
}

export class CoCartCheckoutError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "CoCartCheckoutError";
  }
}

async function toTypedObject<T>(
  request: Promise<{ toObject(): unknown }>
): Promise<T> {
  try {
    const response = await request;
    return response.toObject() as T;
  } catch (error) {
    if (error instanceof Error) {
      // The SDK's CoCartError exposes the WP_Error code as `errorCode`, not
      // `code` (verified against @cocartheadless/sdk's compiled output).
      const errorCode = (error as { errorCode?: string | null }).errorCode;
      throw new CoCartCheckoutError(error.message, errorCode ?? undefined);
    }
    throw error;
  }
}

export function getCheckoutConfig(): Promise<CheckoutConfigResponse> {
  return toTypedObject(getClient().get("checkout/config"));
}

export function getCheckout(currency?: string): Promise<CheckoutData> {
  return toTypedObject(
    getClient().get("checkout", currency ? { currency } : undefined)
  );
}

export function updateCheckout(data: CheckoutUpdateInput): Promise<CheckoutData> {
  return toTypedObject(
    getClient().request("PUT", "checkout", undefined, data as Record<string, unknown>)
  );
}

export function processCheckout(
  data: CheckoutProcessInput
): Promise<CheckoutProcessResponse> {
  return toTypedObject(getClient().post("checkout", data as Record<string, unknown>));
}

export function getPaymentMethods(): Promise<PaymentMethodsResponse> {
  return toTypedObject(getClient().get("checkout/payment-methods"));
}

export function searchAddresses(
  params: AddressSearchParams
): Promise<AddressSearchResult> {
  const query: Record<string, string> = { query: params.query };
  if (params.country) query.country = params.country;
  if (params.type) query.type = params.type;
  if (params.provider) query.provider = params.provider;
  return toTypedObject(getClient().get("address/search", query));
}

export function getAddressDetails(
  params: AddressDetailsParams
): Promise<AddressDetailsResult> {
  return toTypedObject(
    getClient().get("address/details", {
      address_id: params.address_id,
      provider: params.provider,
    })
  );
}

export function getOrderReceived(
  orderId: number | string,
  orderKey: string
): Promise<OrderReceived> {
  return toTypedObject(
    getClient().get(`order-received/${orderId}`, { order_key: orderKey })
  );
}

export function payForOrder(
  orderId: number | string,
  orderKey: string,
  data: PayForOrderInput
): Promise<PayForOrderResponse> {
  return toTypedObject(
    getClient().post(`order-received/${orderId}/pay`, {
      order_key: orderKey,
      ...data,
    })
  );
}
