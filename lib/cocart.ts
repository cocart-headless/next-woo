// CoCart SDK-backed product/category/tag/variation/review functions
// Replaces the equivalent WooCommerce REST functions in lib/woocommerce.ts.
//
// The CoCart SDK's internal fetch() call does not forward Next.js's
// `next: { tags, revalidate }` fetch options, so tag-based ISR revalidation
// (driven by app/api/revalidate/route.ts) is reproduced here explicitly via
// unstable_cache, using the exact same cache tag strings the webhook already
// invalidates.
//
// The @cocartheadless/sdk npm package's TypeScript types for Product/
// ProductVariation/ProductAttribute/ProductImage are significantly
// simplified/inaccurate relative to the real CoCart v2 REST API response
// (verified against the CoCart plugin's actual PHP controllers:
// includes/classes/rest-api/controllers/v2/products/*.php and
// includes/classes/utilities/class-cocart-utilities-product-helpers.php in
// https://github.com/co-cart/co-cart). The SDK is a thin fetch wrapper -
// `Response.toObject()` is just `JSON.parse(body)`, no reshaping - so the
// real wire shape is exactly what those PHP files construct. The types below
// are written against that verified shape, not the SDK's `.d.ts`.

import { unstable_cache } from "next/cache";
import { CoCart, CurrencyFormatter } from "@cocartheadless/sdk";
import type {
  ProductCategory as SDKProductCategory,
  ProductTag as SDKProductTag,
  ProductReview,
  CurrencyInfo,
} from "@cocartheadless/sdk";

export type { ProductReview };

// CoCart's typed ProductCategory only covers id/name/slug; the underlying
// WooCommerce-sourced response includes the rest of these fields too
// (verified against class-cocart-product-categories-controller.php).
export interface ProductCategory extends SDKProductCategory {
  description?: string;
  image?: { id: number; src: string; name: string; alt: string } | null;
  count?: number;
  display?: "default" | "products" | "subcategories" | "both";
  parent?: number;
}

// Same story as ProductCategory - the typed interface only covers id/name/slug.
export interface ProductTag extends SDKProductTag {
  count?: number;
}

// A product image's `src` is a map of registered WP image sizes to URLs
// (e.g. { thumbnail, medium, large, full, custom }), not a single string -
// see CoCart_Utilities_Product_Helpers::get_images().
export interface ProductImageSizes {
  [size: string]: string;
}

export interface ProductImage {
  id: number;
  src: ProductImageSizes;
  name: string;
  alt: string;
  position: number;
  featured: boolean;
}

/** Pick a usable URL out of a product image's multi-size `src` map. */
export function getProductImageUrl(
  image: ProductImage | undefined | null
): string | undefined {
  if (!image) return undefined;
  return (
    image.src.full ??
    image.src.large ??
    image.src.medium ??
    Object.values(image.src)[0]
  );
}

export interface ProductPrices {
  price: string;
  regular_price: string;
  sale_price: string;
  // Empty array when not a range (simple products/variations), an object
  // when it is (verified live: variable products return {from,to} or []).
  price_range: { from: string; to: string } | [];
  on_sale: boolean;
  date_on_sale: {
    from: string | null;
    from_gmt: string | null;
    to: string | null;
    to_gmt: string | null;
  };
  currency: CurrencyInfo;
}

export interface ProductStock {
  is_in_stock: boolean;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  backorders: "no" | "notify" | "yes";
  backorders_allowed: boolean;
  backordered: boolean;
  // Empty string when unset, not null (verified live) - only ever a
  // positive number when actually configured.
  low_stock_amount: number | "";
}

// slug -> label, e.g. { red: "Red", blue: "Blue" }
export interface ProductAttributeOptions {
  [slug: string]: string;
}

// Keyed by "attribute_{name}" (or "attribute_pa_{name}" for taxonomy
// attributes) - NOT an array, despite the SDK's ProductAttribute[] typing.
export interface ProductAttributeEntry {
  id: number;
  name: string;
  position: number;
  is_attribute_visible: boolean;
  used_for_variation: boolean;
  options: ProductAttributeOptions;
}
export type ProductAttributes = Record<string, ProductAttributeEntry>;

// A variation's attributes: same keys as ProductAttributes, but each value
// is a single selected option (empty options map = "any").
export interface VariationAttributeEntry {
  id: number;
  name: string;
  option: ProductAttributeOptions;
}
export type VariationAttributes = Record<string, VariationAttributeEntry>;

export interface ProductTaxonomyRef {
  id: number;
  name: string;
  slug: string;
}

// Connected-product references (related/upsells/cross_sells) are lightweight
// product summaries, not plain IDs (verified live).
export interface ConnectedProductRef {
  id: number;
  name: string;
  permalink: string;
  price: string;
  add_to_cart: { text: string; description: string; rest_url: string };
  rest_url: string;
}

export interface Product {
  id: number;
  parent_id: number;
  name: string;
  type: string;
  slug: string;
  permalink: string;
  sku: string;
  // Only populated (non-empty) when type === "external" (verified against
  // class-cocart-products-controller.php's get_data()).
  external_url: string;
  button_text: string;
  description: string;
  short_description: string;
  featured: boolean;
  prices: ProductPrices;
  average_rating: string;
  review_count: number;
  rating_count: number;
  images: ProductImage[];
  categories: ProductTaxonomyRef[];
  tags: ProductTaxonomyRef[];
  attributes: ProductAttributes;
  default_attributes: Record<string, string>;
  stock: ProductStock;
  related: ConnectedProductRef[];
  upsells: ConnectedProductRef[];
  cross_sells: ConnectedProductRef[];
  [key: string]: unknown;
}

export interface ProductVariation {
  id: number;
  parent_id: number;
  sku: string;
  description: string;
  prices: ProductPrices;
  images: ProductImage[];
  attributes: VariationAttributes;
  stock: ProductStock;
  [key: string]: unknown;
}

const baseUrl = process.env.WORDPRESS_URL;
const isConfigured = Boolean(baseUrl);

if (!isConfigured) {
  console.warn(
    "WORDPRESS_URL is not configured - CoCart product features will be unavailable"
  );
}

// Products API is public - no auth needed. Single shared instance is safe
// since nothing here touches cart/session state.
const client = baseUrl ? new CoCart(baseUrl) : null;

export class CoCartAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string
  ) {
    super(message);
    this.name = "CoCartAPIError";
  }
}

const CACHE_TTL = 3600; // 1 hour, matches lib/woocommerce.ts

export interface PaginationHeaders {
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T;
  headers: PaginationHeaders;
}

function requireClient(endpoint: string): CoCart {
  if (!client) {
    throw new CoCartAPIError("CoCart not configured", 0, endpoint);
  }
  return client;
}

// The /products list endpoint wraps results in { products: [...] } rather
// than returning a bare array (verified live - unlike categories/tags/
// reviews/variations, which are bare arrays). Handles both shapes
// defensively in case that ever changes.
function unwrapProductList(raw: unknown): Product[] {
  if (Array.isArray(raw)) return raw as Product[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { products?: unknown }).products)) {
    return (raw as { products: Product[] }).products;
  }
  return [];
}

// ============================================================================
// Products
// ============================================================================

export async function getProducts(
  page: number = 1,
  perPage: number = 12,
  params?: {
    category?: string;
    tag?: string;
    search?: string;
    orderby?:
      | "date"
      | "id"
      | "title"
      | "slug"
      | "price"
      | "popularity"
      | "rating";
    order?: "asc" | "desc";
    featured?: boolean;
    on_sale?: boolean;
    min_price?: number;
    max_price?: number;
    stock_status?: "instock" | "outofstock" | "onbackorder";
  }
): Promise<PaginatedResult<Product[]>> {
  if (!isConfigured) return { data: [], headers: { total: 0, totalPages: 0 } };

  const query: Record<string, unknown> = {
    per_page: perPage,
    page,
    ...params,
  };

  const cacheTags = ["woocommerce", "products", `products-page-${page}`];
  if (params?.category) cacheTags.push(`products-category-${params.category}`);
  if (params?.tag) cacheTags.push(`products-tag-${params.tag}`);
  if (params?.search) cacheTags.push("products-search");

  try {
    return await unstable_cache(
      async () => {
        const response = await requireClient("products").products().all(query);
        return {
          data: unwrapProductList(response.toObject()),
          headers: {
            total: response.getTotalResults() ?? 0,
            totalPages: response.getTotalPages() ?? 0,
          },
        };
      },
      ["cocart", "products", JSON.stringify(query)],
      { revalidate: CACHE_TTL, tags: cacheTags }
    )();
  } catch {
    console.warn("CoCart products fetch failed");
    return { data: [], headers: { total: 0, totalPages: 0 } };
  }
}

export async function getAllProducts(params?: {
  category?: string;
  tag?: string;
  featured?: boolean;
  on_sale?: boolean;
}): Promise<Product[]> {
  if (!isConfigured) return [];

  const query = { per_page: 100, ...params };

  try {
    return await unstable_cache(
      async () => {
        const response = await requireClient("products").products().all(query);
        return unwrapProductList(response.toObject());
      },
      ["cocart", "products", "all", JSON.stringify(query)],
      { revalidate: CACHE_TTL, tags: ["woocommerce", "products"] }
    )();
  } catch {
    console.warn("CoCart products fetch failed");
    return [];
  }
}

export async function getProductById(id: number): Promise<Product> {
  return unstable_cache(
    async () => {
      const response = await requireClient("products").products().find(id);
      return response.toObject() as Product;
    },
    ["cocart", "product", String(id)],
    { revalidate: CACHE_TTL, tags: ["woocommerce", "products", `product-${id}`] }
  )();
}

export async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  if (!isConfigured) return undefined;

  try {
    return await unstable_cache(
      async () => {
        // Products.findBySlug() requests GET /products/{slug}, but CoCart
        // expects an ID/SKU in that position and 404s on a slug (verified
        // live) - filter the list endpoint by slug instead, which works.
        const response = await requireClient("products")
          .products()
          .all({ slug });
        return unwrapProductList(response.toObject())[0];
      },
      ["cocart", "product-by-slug", slug],
      { revalidate: CACHE_TTL, tags: ["woocommerce", "products"] }
    )();
  } catch {
    console.warn(`CoCart product fetch failed for slug ${slug}`);
    return undefined;
  }
}

export async function getFeaturedProducts(limit: number = 4): Promise<Product[]> {
  if (!isConfigured) return [];

  try {
    return await unstable_cache(
      async () => {
        const response = await requireClient("products")
          .products()
          .featured({ per_page: limit });
        return unwrapProductList(response.toObject());
      },
      ["cocart", "products-featured", String(limit)],
      {
        revalidate: CACHE_TTL,
        tags: ["woocommerce", "products", "products-featured"],
      }
    )();
  } catch {
    console.warn("CoCart featured products fetch failed");
    return [];
  }
}

export async function getOnSaleProducts(limit: number = 8): Promise<Product[]> {
  if (!isConfigured) return [];

  try {
    return await unstable_cache(
      async () => {
        const response = await requireClient("products")
          .products()
          .onSale({ per_page: limit });
        return unwrapProductList(response.toObject());
      },
      ["cocart", "products-sale", String(limit)],
      { revalidate: CACHE_TTL, tags: ["woocommerce", "products", "products-sale"] }
    )();
  } catch {
    console.warn("CoCart on-sale products fetch failed");
    return [];
  }
}

export async function getRelatedProducts(
  productId: number,
  limit: number = 4
): Promise<Product[]> {
  if (!isConfigured) return [];

  try {
    return await unstable_cache(
      async () => {
        const product = await getProductById(productId);
        // product.related is an array of lightweight product summaries
        // ({id, name, price, ...}), not plain IDs (verified live) - the
        // summary lacks images/full prices/categories our UI needs, so
        // fetch the full product records by ID.
        const relatedIds = product.related.map((r) => r.id);

        if (relatedIds.length > 0) {
          const response = await requireClient("products")
            .products()
            .all({ include: relatedIds.slice(0, limit).join(",") });
          return unwrapProductList(response.toObject());
        }

        // Fallback if no related IDs are set - show other products from
        // the same category instead.
        const categorySlug = product.categories?.[0]?.slug;
        if (!categorySlug) return [];

        const response = await requireClient("products")
          .products()
          .byCategory(categorySlug, { per_page: limit + 1 });
        const products = unwrapProductList(response.toObject());
        return products.filter((p) => p.id !== productId).slice(0, limit);
      },
      ["cocart", "related-products", String(productId), String(limit)],
      { revalidate: CACHE_TTL, tags: ["woocommerce", "products", `product-${productId}`] }
    )();
  } catch {
    console.warn("CoCart related products fetch failed");
    return [];
  }
}

// For static generation
export async function getAllProductSlugs(): Promise<{ slug: string }[]> {
  if (!isConfigured) return [];

  try {
    return await unstable_cache(
      async () => {
        const allSlugs: { slug: string }[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const response = await requireClient("products")
            .products()
            .paginate(page, 100);
          const products = unwrapProductList(response.toObject());
          const totalPages = response.getTotalPages() ?? 0;

          allSlugs.push(...products.map((product) => ({ slug: product.slug })));
          hasMore = page < totalPages;
          page++;
        }

        return allSlugs;
      },
      ["cocart", "all-product-slugs"],
      { revalidate: CACHE_TTL, tags: ["woocommerce"] }
    )();
  } catch {
    console.warn("CoCart unavailable, skipping static generation for products");
    return [];
  }
}

// ============================================================================
// Product Variations
// ============================================================================

export async function getProductVariations(
  productId: number
): Promise<ProductVariation[]> {
  if (!isConfigured) return [];

  try {
    return await unstable_cache(
      async () => {
        const response = await requireClient("variations")
          .products()
          .variations(productId, { per_page: "100" });
        return response.toObject() as ProductVariation[];
      },
      ["cocart", "product-variations", String(productId)],
      {
        revalidate: CACHE_TTL,
        tags: ["woocommerce", "products", `product-${productId}`, "variations"],
      }
    )();
  } catch {
    console.warn(`CoCart variations fetch failed for product ${productId}`);
    return [];
  }
}

export async function getProductVariation(
  productId: number,
  variationId: number
): Promise<ProductVariation> {
  return unstable_cache(
    async () => {
      const response = await requireClient("variation")
        .products()
        .variation(productId, variationId);
      return response.toObject() as ProductVariation;
    },
    ["cocart", "product-variation", String(productId), String(variationId)],
    {
      revalidate: CACHE_TTL,
      tags: [
        "woocommerce",
        "products",
        `product-${productId}`,
        `variation-${variationId}`,
      ],
    }
  )();
}

// ============================================================================
// Product Categories
// ============================================================================

export async function getAllProductCategories(): Promise<ProductCategory[]> {
  if (!isConfigured) return [];

  try {
    return await unstable_cache(
      async () => {
        const response = await requireClient("categories")
          .products()
          .categories({ per_page: "100", hide_empty: "true" });
        return response.toObject() as ProductCategory[];
      },
      ["cocart", "categories"],
      { revalidate: CACHE_TTL, tags: ["woocommerce", "categories"] }
    )();
  } catch {
    console.warn("CoCart categories fetch failed");
    return [];
  }
}

export async function getProductCategoryById(
  id: number
): Promise<ProductCategory> {
  return unstable_cache(
    async () => {
      const response = await requireClient("category").products().category(id);
      return response.toObject() as ProductCategory;
    },
    ["cocart", "category", String(id)],
    { revalidate: CACHE_TTL, tags: ["woocommerce", "categories", `category-${id}`] }
  )();
}

export async function getProductCategoryBySlug(
  slug: string
): Promise<ProductCategory | undefined> {
  const categories = await getAllProductCategories();
  return categories.find((category) => category.slug === slug);
}

export async function getAllCategorySlugs(): Promise<{ slug: string }[]> {
  if (!isConfigured) return [];

  try {
    const categories = await getAllProductCategories();
    return categories.map((cat) => ({ slug: cat.slug }));
  } catch {
    console.warn("CoCart unavailable, skipping static generation for categories");
    return [];
  }
}

// ============================================================================
// Product Tags
// ============================================================================

export async function getAllProductTags(): Promise<ProductTag[]> {
  if (!isConfigured) return [];

  try {
    return await unstable_cache(
      async () => {
        const response = await requireClient("tags")
          .products()
          .tags({ per_page: "100", hide_empty: "true" });
        return response.toObject() as ProductTag[];
      },
      ["cocart", "tags"],
      { revalidate: CACHE_TTL, tags: ["woocommerce", "tags"] }
    )();
  } catch {
    console.warn("CoCart tags fetch failed");
    return [];
  }
}

export async function getProductTagBySlug(
  slug: string
): Promise<ProductTag | undefined> {
  const tags = await getAllProductTags();
  return tags.find((tag) => tag.slug === slug);
}

// ============================================================================
// Product Reviews
// ============================================================================

export async function getProductReviews(
  productId: number
): Promise<ProductReview[]> {
  if (!isConfigured) return [];

  try {
    return await unstable_cache(
      async () => {
        const response = await requireClient("reviews")
          .products()
          .productReviews(productId, { status: "approved" });
        return response.toObject() as ProductReview[];
      },
      ["cocart", "product-reviews", String(productId)],
      {
        revalidate: CACHE_TTL,
        tags: ["woocommerce", "reviews", `product-${productId}`],
      }
    )();
  } catch {
    console.warn(`CoCart reviews fetch failed for product ${productId}`);
    return [];
  }
}

// ============================================================================
// Utilities
// ============================================================================

// Fallback only, used if a `prices` object is ever missing its `currency`
// field. In practice CoCart always embeds currency alongside prices (see
// cocart_get_store_currency() in the plugin), so currencyFromPrices() below
// should be preferred wherever a `prices` object is available.
export const STORE_CURRENCY: CurrencyInfo = {
  currency_code: "USD",
  currency_symbol: "$",
  currency_minor_unit: 2,
  currency_decimal_separator: ".",
  currency_thousand_separator: ",",
  currency_prefix: "$",
  currency_suffix: "",
};

/** Get the CurrencyInfo embedded in a product/variation's `prices` object. */
export function currencyFromPrices(prices: ProductPrices): CurrencyInfo {
  return prices.currency ?? STORE_CURRENCY;
}

const currencyFormatter = new CurrencyFormatter();

// CoCart returns most prices as smallest-unit integers (e.g. 4599 = $45.99) -
// see cocart_prepare_money_response() in the plugin, which does
// intval(round(amount * 10^decimals)). This applies to product prices, cart
// item unit price, and cart-level totals.
/** Format a CoCart smallest-unit price (e.g. "4599") as "$45.99". */
export function formatPrice(
  price: string | number,
  currency: CurrencyInfo = STORE_CURRENCY
): string {
  const minorUnitAmount = typeof price === "string" ? Number(price) : price;
  return currencyFormatter.format(minorUnitAmount, currency);
}

/**
 * Derive a cart item's displayed unit price from its subtotal rather than
 * its own `price` field. CoCart's cart item `price` field has been observed
 * to come back as "0" for some variations even though `totals.subtotal`
 * correctly reflects the real per-unit price (verified live) - deriving
 * from subtotal/quantity is more reliable and stays mathematically
 * consistent with the displayed line total.
 */
export function cartItemUnitPrice(subtotal: string, quantity: number): number {
  if (quantity <= 0) return 0;
  return Number(subtotal) / quantity;
}

export function calculateDiscountPercentage(
  regularPrice: string,
  salePrice: string
): number {
  const regular = Number(regularPrice);
  const sale = Number(salePrice);

  if (!regular || !sale || regular <= sale) return 0;

  return Math.round(((regular - sale) / regular) * 100);
}

export function isProductInStock(product: Product | ProductVariation): boolean {
  return product.stock.is_in_stock;
}

export function getProductStockMessage(product: Product | ProductVariation): string {
  if (!isProductInStock(product)) {
    if (product.stock.stock_status === "onbackorder") {
      return "Available on backorder";
    }
    return "Out of stock";
  }

  const { stock_quantity, low_stock_amount } = product.stock;
  if (stock_quantity !== null && stock_quantity !== undefined) {
    if (typeof low_stock_amount === "number" && stock_quantity <= low_stock_amount) {
      return `Only ${stock_quantity} left in stock`;
    }
    return "In stock";
  }

  return "In stock";
}

/**
 * Build the `attributes` map CoCart's cart().addVariation() expects
 * (attribute key -> selected option slug, e.g. { attribute_pa_color: "red" }).
 *
 * Every `used_for_variation` attribute declared on the *product* must be
 * present as a key here, even when this specific variation doesn't declare a
 * value for it - verified live against next-wp.instawp.xyz: omitting a key
 * the variation doesn't declare (rather than sending it as "") makes
 * WooCommerce's variation matching fail server-side, which the CoCart
 * Starter plugin mishandles (calls the non-existent WP_Error::set_param() on
 * the resulting WP_Error), an uncaught fatal that takes the whole request
 * down with it (and, since it's an unhandled PHP error, the response never
 * gets the plugin's CORS headers either - it just looks like a CORS failure
 * in the browser).
 *
 * Precedence per attribute: the variation's own pinned value, else the
 * shopper's selection for it (selectedOptions, from VariationSelector),
 * else "" (WooCommerce's own "any value" convention).
 */
export function variationCartAttributes(
  productAttributes: ProductAttributes,
  variationAttributes: VariationAttributes,
  selectedOptions: Record<string, string> = {}
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, productAttr] of Object.entries(productAttributes)) {
    if (!productAttr.used_for_variation) continue;
    const pinnedSlug = Object.keys(variationAttributes[key]?.option ?? {})[0];
    result[key] = pinnedSlug || selectedOptions[key] || "";
  }
  return result;
}
