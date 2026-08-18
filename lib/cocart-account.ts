// CoCart Plus "my account" API client.
//
// Thin typed wrapper over `cocart/v2/my-account*`, built on the shared CoCart
// SDK client (see lib/cocart-client.ts) so requests carry the same JWT the
// rest of the app already authenticates with. Response shapes below are
// verified against the controllers' actual `rest_ensure_response()` calls in
// includes/rest-api/controllers/v2/myaccount/ - NOT their `get_*_schema()`
// methods, which are wrong in places (see
// docs/my-account-api-gaps.md in the CoCart Plus plugin repo):
// `GET my-account/orders/{id}` really returns `order_note`/`order_notes`
// (not `note`/`notes`), and `items` is a plain array (the schema claims an
// object).
//
// Known gaps (same doc): `order_actions.pay`/`.cancel` on the orders
// endpoints point at routes with no backing controller, and order detail
// has no `order_key`, so paying/cancelling an order isn't wired up from
// this API yet - order detail is read-only here.

import { getClient } from "@/lib/cocart-client";

export interface AccountAddress {
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

export interface AccountUser {
  id: number;
  date_registered: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  addresses: {
    billing?: AccountAddress;
    shipping?: AccountAddress;
  };
  orders_count: number;
  // Pre-formatted price string (cocart_price_no_html) - unlike product/cart
  // prices elsewhere in this app, this is NOT a minor-unit integer, so
  // don't run it through formatPrice().
  total_spent: string;
  is_paying_customer: boolean;
  avatar_url: string;
}

export interface AccountRecentOrder {
  order_id: number | null;
  order_date: string | null;
  order_data: string;
}

export interface MyAccountResponse {
  user: AccountUser;
  recent_order: AccountRecentOrder;
  meta: {
    is_customer_outside_base: boolean;
    is_vat_exempt: boolean;
  };
  extensions: Record<string, unknown>;
}

export interface EditAccountInput {
  account_first_name: string;
  account_last_name: string;
  account_display_name: string;
  account_email: string;
  password_current?: string;
  password_1?: string;
  password_2?: string;
}

export interface EditAccountResponse {
  success: boolean;
  email_verification_pending: boolean;
}

export interface OrderAction {
  url: string;
  label: string;
}

export interface OrderListItem {
  order_id: number;
  order_status: string;
  order_date: string;
  item_count: number;
  // Pre-formatted price string, same caveat as AccountUser.total_spent.
  order_total: string;
  order_actions: {
    view?: OrderAction;
    pay?: OrderAction;
    cancel?: OrderAction;
  };
}

export interface OrdersPagination {
  previous?: string;
  next?: string;
}

export interface MyOrdersResponse {
  orders: OrderListItem[];
  pagination: OrdersPagination;
}

export interface OrderLineItemMeta {
  [metaId: string]: string;
}

export interface OrderDetailItem {
  item_id: number;
  product_id: number | string;
  variation_id: number | string;
  product_image: string;
  product_name: string;
  product_title: string;
  product_type: string;
  sku: string;
  quantity: string;
  subtotal: string;
  purchase_note: string;
  refunded_qty: string;
  meta: OrderLineItemMeta;
  link: string;
}

export interface OrderDetailTotal {
  label: string;
  value: string;
}

export interface OrderNote {
  date: string;
  note: string;
}

export interface OrderDownload {
  product_name: string;
  download_name: string;
  file: string;
  downloads_remaining: string;
  download_expires: string;
}

export interface MyOrderDetail {
  order_id: number;
  order_number: string;
  order_parent: number;
  order_date: string;
  order_status: string;
  order_currency: string;
  billing_address: string;
  shipping_address: string;
  phone: string;
  email: string;
  ship_to_billing: boolean;
  items: OrderDetailItem[];
  totals: Record<string, OrderDetailTotal>;
  // Actual response keys - the controller's own schema wrongly calls these
  // `note`/`notes` (see docs/my-account-api-gaps.md).
  order_note: string;
  order_notes: OrderNote[];
  downloads: OrderDownload[];
  order_actions: {
    pay?: OrderAction;
    cancel?: OrderAction;
  };
}

export interface VerifyEmailResponse {
  success: boolean;
  email: string;
}

export class CoCartAccountError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "CoCartAccountError";
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
      throw new CoCartAccountError(error.message, errorCode ?? undefined);
    }
    throw error;
  }
}

export function getMyAccount(): Promise<MyAccountResponse> {
  return toTypedObject(getClient().get("my-account"));
}

export function editMyAccount(
  input: EditAccountInput
): Promise<EditAccountResponse> {
  return toTypedObject(
    getClient().post("my-account", input as unknown as Record<string, unknown>)
  );
}

export function getMyOrders(params?: {
  page?: number;
  per_page?: number;
  order?: "ASC" | "DESC";
}): Promise<MyOrdersResponse> {
  const query: Record<string, string> = {};
  if (params?.page) query.page = String(params.page);
  if (params?.per_page) query.per_page = String(params.per_page);
  if (params?.order) query.order = params.order;
  return toTypedObject(getClient().get("my-account/orders", query));
}

export function getMyOrder(
  id: number | string,
  email?: string
): Promise<MyOrderDetail> {
  return toTypedObject(
    getClient().get(`my-account/orders/${id}`, email ? { email } : undefined)
  );
}

export async function getMyDownloads(): Promise<OrderDownload[]> {
  const data = await toTypedObject<OrderDownload[] | string>(
    getClient().get("my-account/downloads")
  );
  return Array.isArray(data) ? data : [];
}

export function verifyEmailChange(
  key: string,
  userId: number | string
): Promise<VerifyEmailResponse> {
  return toTypedObject(
    getClient().get("my-account/verify-email", { key, user_id: String(userId) })
  );
}
