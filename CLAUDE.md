# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `pnpm dev` - Start development server with turbo mode
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Architecture Overview

Headless WordPress starter using Next.js 16 App Router with TypeScript.

### Data Layer (`lib/wordpress.ts`)
- All WordPress REST API interactions centralized here
- Type definitions in `lib/wordpress.d.ts` (Post, Page, Category, Tag, Author, FeaturedMedia)
- `WordPressAPIError` class for consistent error handling
- Cache tags for granular revalidation: `['wordpress', 'posts', 'post-{id}', 'posts-page-{n}']`
- Pagination via `getPostsPaginated()` returns `{ data, headers: { total, totalPages } }`
- Default cache: 1 hour (`revalidate: 3600`)

### WooCommerce Data Layer (`lib/woocommerce.ts`)
- WooCommerce REST API v3 integration with consumer key/secret auth
- Type definitions in `lib/woocommerce.d.ts` (Product, ProductVariation, Order, Cart, Customer, etc.)
- `WooCommerceAPIError` class for consistent error handling
- Cache tags: `['woocommerce', 'products', 'product-{id}', 'categories', 'orders']`
- Key functions: `getProducts()`, `getProductBySlug()`, `getProductVariations()`, `createOrder()`
- Utility functions: `formatPrice()`, `isProductInStock()`, `calculateDiscountPercentage()`

### Routing
- Dynamic: `/posts/[slug]`, `/pages/[slug]`
- Archives: `/posts`, `/posts/authors`, `/posts/categories`, `/posts/tags`
- Shop: `/shop`, `/product/[slug]`, `/product-category/[slug]`
- Cart/Checkout: `/cart`, `/checkout`, `/checkout/success`
- Account: `/account`, `/account/orders`, `/account/orders/[id]`
- API: `/api/revalidate` (webhook), `/api/og` (OG images), `/api/checkout` (order creation)

### Data Fetching Patterns
- Server Components with parallel `Promise.all()` calls
- `generateStaticParams()` uses `getAllPostSlugs()` for static generation
- URL-based state for search/filters via `searchParams`
- Debounced search (300ms) in `SearchInput` component

### Revalidation Flow
1. WordPress plugin sends webhook to `/api/revalidate`
2. Validates `x-webhook-secret` header against `WORDPRESS_WEBHOOK_SECRET`
3. Calls `revalidateTag()` for specific content types (posts, categories, tags, authors)
4. WooCommerce content types: product, product_cat, product_tag, order, stock_update

### Cart System
- Client-side cart with localStorage persistence (`CartProvider` context)
- `useCart()` hook provides: `cart`, `addItem()`, `removeItem()`, `updateQuantity()`, `clearCart()`
- `CartDrawer` component for slide-out cart preview
- Cart state: items array with `{ productId, variationId?, quantity, name, price, image }`

### Checkout & Payment Flow
- Native headless checkout via CoCart Plus's `cocart/v2/checkout*` REST API (`lib/cocart-checkout.ts`) — no more redirect to WooCommerce's hosted checkout
- Address/shipping-rate calculation on `/checkout` still uses `cart-provider.tsx`'s `updateCustomerAddress()`/`selectShippingMethod()` (CoCart Plus's `cart/update`/`cart/set-shipping-method`) — kept as-is because `PUT /checkout`'s `shipping_methods` response is a flat map, not the per-package rate list the shipping UI needs
- Payment methods listed via `getPaymentMethods()` (`GET checkout/payment-methods`), selected in the checkout form
- Placing the order calls `processCheckout()` (`POST checkout`), which creates and (attempts to) pay the `WC_Order` in one call; branch on `payment_result.payment_status`: `success`/`no_payment_required`/`on_hold` redirect to `redirect_url`, `requires_action` with `action_type: 'gateway_redirect_required'` redirects to `action_data.redirect`, other `action_type`s (e.g. Stripe 3DS) aren't supported yet, `failed` shows `payment_result.message`
- `redirect_url` only lands back on this Next.js app if CoCart Starter's `frontend_url` setting is configured in WP admin — otherwise it points at the WooCommerce domain
- `/checkout/success` reads `order`/`order-received` + `key` from the query string and calls `getOrderReceived()` to show real order totals/items
- Cart cleared before redirecting on a successful/on-hold/no-payment-required order
- Gateway-specific client-side tokenization (Stripe Elements, etc.) is not yet implemented — see `docs/checkout-workflow.md` and `docs/gateway-compatibility.md` in the CoCart Plus plugin for the full `payment_result` contract

### Configuration Files
- `site.config.ts` - Site metadata (domain, name, description)
- `menu.config.ts` - Navigation menu structure
- `next.config.ts` - Image remotePatterns, /admin redirect to WordPress

## Code Style

### TypeScript
- Strict typing with interfaces from `lib/wordpress.d.ts`
- Async params: `params: Promise<{ slug: string }>` (Next.js 15+ pattern)

### Naming
- Components: PascalCase (`PostCard.tsx`)
- Functions/variables: camelCase
- Types/interfaces: PascalCase

### File Structure
- Pages: `/app/**/*.tsx`
- UI components: `/components/ui/*.tsx` (shadcn/ui)
- Feature components: `/components/posts/*.tsx`, `/components/theme/*.tsx`
- Shop components: `/components/shop/*.tsx` (ProductCard, ProductGallery, CartProvider, etc.)
- WordPress functions must include cache tags

## Environment Variables
```
WORDPRESS_URL="https://example.com"           # Full WordPress URL
WORDPRESS_HOSTNAME="example.com"              # For Next.js image optimization
WORDPRESS_WEBHOOK_SECRET="secret-key"         # Webhook validation
NEXT_PUBLIC_WORDPRESS_URL="https://example.com"  # Client-side WordPress URL (for My Account links)

# WooCommerce (required for shop functionality)
WC_CONSUMER_KEY="ck_xxx"                      # WooCommerce REST API consumer key
WC_CONSUMER_SECRET="cs_xxx"                   # WooCommerce REST API consumer secret
```

Note: Payment processing is configured in WooCommerce admin, not in Next.js.

## Key Dependencies
- Next.js 16 with React 19
- Tailwind CSS v4 with `@tailwindcss/postcss`
- shadcn/ui components (Radix primitives)
- brijr/craft for layout (`Section`, `Container`, `Article`, `Prose`)
