// WooCommerce REST API Functions
// Uses WooCommerce REST API v3 with consumer key/secret authentication
//
// Product/category/tag/variation/review data now comes from the CoCart SDK
// (see lib/cocart.ts). This file only covers what CoCart doesn't do:
// My Account (customers/orders) and checkout order creation - CoCart's SDK
// has no Checkout API yet.

import type {
  Order,
  CreateOrderInput,
  Customer,
  Coupon,
  ShippingZone,
  ShippingMethod,
  PaymentGateway,
} from "./woocommerce.d";

// Configuration
const baseUrl = process.env.WORDPRESS_URL;
const consumerKey = process.env.WC_CONSUMER_KEY;
const consumerSecret = process.env.WC_CONSUMER_SECRET;

const isConfigured = Boolean(baseUrl && consumerKey && consumerSecret);

if (!isConfigured) {
  console.warn(
    "WooCommerce environment variables are not fully configured - WooCommerce features will be unavailable"
  );
}

// Error class for WooCommerce API errors
export class WooCommerceAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public code?: string
  ) {
    super(message);
    this.name = "WooCommerceAPIError";
  }
}

// Pagination types
export interface WooCommercePaginationHeaders {
  total: number;
  totalPages: number;
}

export interface WooCommerceResponse<T> {
  data: T;
  headers: WooCommercePaginationHeaders;
}

const USER_AGENT = "Next.js WooCommerce Client";

// Build authenticated URL for WooCommerce REST API
function buildWooCommerceUrl(
  endpoint: string,
  query?: Record<string, any>
): string {
  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error("WooCommerce not configured");
  }

  const url = new URL(`${baseUrl}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set("consumer_key", consumerKey);
  url.searchParams.set("consumer_secret", consumerSecret);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

// Core fetch - throws on error
async function woocommerceFetch<T>(
  endpoint: string,
  query?: Record<string, any>,
  tags: string[] = ["woocommerce"],
  options?: RequestInit
): Promise<T> {
  if (!isConfigured) {
    throw new Error("WooCommerce not configured");
  }

  const url = buildWooCommerceUrl(endpoint, query);

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
    },
    next: { tags, revalidate: 3600 },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new WooCommerceAPIError(
      errorData.message || `WooCommerce API request failed: ${response.statusText}`,
      response.status,
      endpoint,
      errorData.code
    );
  }

  return response.json();
}

// Graceful fetch - returns fallback when unavailable
async function woocommerceFetchGraceful<T>(
  endpoint: string,
  fallback: T,
  query?: Record<string, any>,
  tags: string[] = ["woocommerce"]
): Promise<T> {
  if (!isConfigured) return fallback;

  try {
    return await woocommerceFetch<T>(endpoint, query, tags);
  } catch {
    console.warn(`WooCommerce fetch failed for ${endpoint}`);
    return fallback;
  }
}

// Paginated fetch - returns response with headers
async function woocommerceFetchPaginated<T>(
  endpoint: string,
  query?: Record<string, any>,
  tags: string[] = ["woocommerce"]
): Promise<WooCommerceResponse<T>> {
  if (!isConfigured) {
    throw new Error("WooCommerce not configured");
  }

  const url = buildWooCommerceUrl(endpoint, query);

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
    },
    next: { tags, revalidate: 3600 },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new WooCommerceAPIError(
      errorData.message || `WooCommerce API request failed: ${response.statusText}`,
      response.status,
      endpoint,
      errorData.code
    );
  }

  return {
    data: await response.json(),
    headers: {
      total: parseInt(response.headers.get("X-WP-Total") || "0", 10),
      totalPages: parseInt(response.headers.get("X-WP-TotalPages") || "0", 10),
    },
  };
}

// POST/PUT/DELETE fetch for mutations (no caching)
async function woocommerceMutate<T>(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  body?: object
): Promise<T> {
  if (!isConfigured) {
    throw new Error("WooCommerce not configured");
  }

  const url = buildWooCommerceUrl(endpoint);

  const response = await fetch(url, {
    method,
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new WooCommerceAPIError(
      errorData.message || `WooCommerce API request failed: ${response.statusText}`,
      response.status,
      endpoint,
      errorData.code
    );
  }

  return response.json();
}

// ============================================================================
// Orders
// ============================================================================

export async function createOrder(orderData: CreateOrderInput): Promise<Order> {
  return woocommerceMutate<Order>("orders", "POST", orderData);
}

export async function getOrder(orderId: number): Promise<Order> {
  return woocommerceFetch<Order>(`orders/${orderId}`, undefined, [
    "woocommerce",
    "orders",
    `order-${orderId}`,
  ]);
}

export async function getOrderByKey(orderKey: string): Promise<Order | undefined> {
  // WooCommerce doesn't support direct lookup by order_key
  // This would typically be handled through a custom endpoint or auth
  throw new Error("Order lookup by key requires custom implementation or authentication");
}

export async function updateOrderStatus(
  orderId: number,
  status: Order["status"]
): Promise<Order> {
  return woocommerceMutate<Order>(`orders/${orderId}`, "PUT", { status });
}

// Note: Customer orders require authentication
export async function getCustomerOrders(
  customerId: number,
  page: number = 1,
  perPage: number = 10
): Promise<WooCommerceResponse<Order[]>> {
  return woocommerceFetchPaginated<Order[]>(
    "orders",
    { customer: customerId, per_page: perPage, page },
    ["woocommerce", "orders", `customer-${customerId}`]
  );
}

// ============================================================================
// Customers
// ============================================================================

export async function getCustomer(customerId: number): Promise<Customer> {
  return woocommerceFetch<Customer>(`customers/${customerId}`, undefined, [
    "woocommerce",
    "customers",
    `customer-${customerId}`,
  ]);
}

export async function createCustomer(customerData: {
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  password?: string;
  billing?: Partial<Customer["billing"]>;
  shipping?: Partial<Customer["shipping"]>;
}): Promise<Customer> {
  return woocommerceMutate<Customer>("customers", "POST", customerData);
}

export async function updateCustomer(
  customerId: number,
  customerData: Partial<Customer>
): Promise<Customer> {
  return woocommerceMutate<Customer>(`customers/${customerId}`, "PUT", customerData);
}

// ============================================================================
// Coupons
// ============================================================================

export async function getCouponByCode(code: string): Promise<Coupon | undefined> {
  const coupons = await woocommerceFetchGraceful<Coupon[]>(
    "coupons",
    [],
    { code },
    ["woocommerce", "coupons"]
  );
  return coupons[0];
}

export async function validateCoupon(
  code: string,
  cartTotal: number,
  productIds: number[]
): Promise<{ valid: boolean; discount: number; message?: string }> {
  const coupon = await getCouponByCode(code);

  if (!coupon) {
    return { valid: false, discount: 0, message: "Coupon not found" };
  }

  // Check expiry
  if (coupon.date_expires) {
    const expiryDate = new Date(coupon.date_expires);
    if (expiryDate < new Date()) {
      return { valid: false, discount: 0, message: "Coupon has expired" };
    }
  }

  // Check usage limit
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, discount: 0, message: "Coupon usage limit reached" };
  }

  // Check minimum amount
  if (coupon.minimum_amount && cartTotal < parseFloat(coupon.minimum_amount)) {
    return {
      valid: false,
      discount: 0,
      message: `Minimum order amount is ${coupon.minimum_amount}`,
    };
  }

  // Check maximum amount
  if (coupon.maximum_amount && cartTotal > parseFloat(coupon.maximum_amount)) {
    return {
      valid: false,
      discount: 0,
      message: `Maximum order amount is ${coupon.maximum_amount}`,
    };
  }

  // Calculate discount
  let discount = 0;
  const amount = parseFloat(coupon.amount);

  switch (coupon.discount_type) {
    case "percent":
      discount = (cartTotal * amount) / 100;
      break;
    case "fixed_cart":
      discount = Math.min(amount, cartTotal);
      break;
    case "fixed_product":
      // Would need to check applicable products
      discount = amount * productIds.length;
      break;
  }

  return { valid: true, discount };
}

// ============================================================================
// Shipping
// ============================================================================

export async function getShippingZones(): Promise<ShippingZone[]> {
  return woocommerceFetchGraceful<ShippingZone[]>(
    "shipping/zones",
    [],
    undefined,
    ["woocommerce", "shipping"]
  );
}

export async function getShippingMethods(zoneId: number): Promise<ShippingMethod[]> {
  return woocommerceFetchGraceful<ShippingMethod[]>(
    `shipping/zones/${zoneId}/methods`,
    [],
    undefined,
    ["woocommerce", "shipping", `zone-${zoneId}`]
  );
}

// ============================================================================
// Payment Gateways
// ============================================================================

export async function getPaymentGateways(): Promise<PaymentGateway[]> {
  return woocommerceFetchGraceful<PaymentGateway[]>(
    "payment_gateways",
    [],
    undefined,
    ["woocommerce", "payment"]
  );
}

export async function getEnabledPaymentGateways(): Promise<PaymentGateway[]> {
  const gateways = await getPaymentGateways();
  return gateways.filter((gateway) => gateway.enabled);
}
