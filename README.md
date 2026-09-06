# Next Woo

A headless WooCommerce storefront built with Next.js 16, React 19, TypeScript, and the [CoCart](https://cocartapi.com) REST API.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcocart-headless%2Fnext-woo&env=WORDPRESS_URL,WORDPRESS_HOSTNAME,WORDPRESS_WEBHOOK_SECRET,NEXT_PUBLIC_WORDPRESS_URL,WC_CONSUMER_KEY,WC_CONSUMER_SECRET&envDescription=WordPress%20URL%2C%20hostname%20for%20images%2C%20webhook%20secret%2C%20and%20WooCommerce%20API%20credentials&project-name=next-woo&repository-name=next-woo&demo-title=Next.js%20WooCommerce%20Starter&demo-url=https%3A%2F%2Fnext-woo.com)

<!-- Add your screenshot here -->
<!-- ![Next Woo Screenshot](screenshot.png) -->

## Table of Contents

- [Features](#features)
- [What's Included](#whats-included)
- [Setup](#setup)
- [Architecture](#architecture)
- [API Functions](#api-functions)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)

## Features

- **Full WooCommerce Integration** - Products, categories, variations, cart, and checkout
- **CoCart-Powered Cart & Auth** - Session persistence and cart operations via the [CoCart](https://cocartapi.com) SDK
- **Type-safe API Layer** - Comprehensive TypeScript definitions for WooCommerce
- **Client-side Cart** - Persistent shopping cart with localStorage
- **Native Headless Checkout** - Order creation and payment via CoCart Plus, no redirect to WooCommerce
- **Customer Accounts** - Login, registration, and an account dashboard (orders, downloads, profile) native to the app
- **Server-side Pagination** - Efficient product browsing with filters
- **Blog Support** - WordPress posts, categories, tags, and authors
- **Cache Revalidation** - Automatic updates when content changes
- **Dark Mode** - Built-in theme switching
- **Responsive Design** - Mobile-first with Tailwind CSS v4

## What's Included

| Feature | Implementation |
|---------|---------------|
| Product browsing | Next.js pages with CoCart-backed product/category data |
| Product search & filters | Server-side with URL params |
| Shopping cart | Client-side with localStorage, synced to CoCart session |
| Checkout form | Native, on `/checkout` — no redirect to WooCommerce |
| Payment processing | **Handled in-app** via CoCart Plus's checkout API (Stripe Elements, offline gateways, redirect-based gateways) |
| Account management | **Native** login, registration, and account dashboard (orders, downloads, profile) |
| Order confirmation | Next.js success page |
| Blog | WordPress posts via REST API |

### Why Native Checkout & Accounts?

Instead of redirecting to WooCommerce's hosted checkout and My Account:
- **Control** - Full ownership of the checkout and account UX, no jarring domain switch
- **Flexibility** - Store owner can still change payment gateways in WooCommerce admin without code changes
- **Still secure** - Card details go straight to the gateway (e.g. Stripe Elements); WooCommerce/CoCart Plus still creates and owns the order
- **Battle-tested backend** - Order creation, payment, and account data still live in WooCommerce/CoCart, just surfaced natively

## Setup

### Prerequisites

- **WordPress 6.0+** with HTTPS enabled
- **WooCommerce 8.0+** installed and activated
- **[CoCart](https://cocartapi.com) plugin** installed and activated (powers the cart/session REST endpoints used by `lib/cocart.ts`)
- **Node.js 18+** and pnpm

### Step 1: WordPress Setup

If you don't have a WordPress site yet:

1. **Hosting**: Use any WordPress host (WP Engine, Bluehost, Cloudways, etc.) or local development (Local by Flywheel, MAMP, Docker)
2. **Install WordPress**: Follow your host's WordPress installation process
3. **Enable HTTPS**: Required for WooCommerce API authentication

#### Configure Permalinks

**Important:** The REST API requires pretty permalinks.

1. Go to **Settings → Permalinks**
2. Select **Post name** (or any option except "Plain")
3. Click **Save Changes**

### Step 2: WooCommerce Setup

1. Install WooCommerce: **Plugins → Add New → Search "WooCommerce"**
2. Activate and run the setup wizard
3. Configure your store basics (currency, location, etc.)

#### Required WooCommerce Pages

This app never renders WooCommerce's own Shop/Cart templates — it has its own `/shop` and `/cart` routes. But WooCommerce still needs its internal **Shop** and **Cart** pages registered (`wc_get_page_id()`), since some core behavior (URL generation, redirects, certain REST/webhook logic) depends on them existing. WooCommerce creates these automatically on install; just verify they're still there:

- **Shop** - Product listing (internal reference only; the storefront's product listing lives at this app's `/shop`)
- **Cart** - Shopping cart (internal reference only; the storefront's cart lives at this app's `/cart`)

Check in **WooCommerce → Settings → Advanced → Page Setup**.

Checkout and My Account are different: this project replaces WooCommerce's hosted Checkout/My Account pages entirely with a native CoCart Plus-powered flow (`/checkout`, `/account`, `/login`, `/register`). There's no equivalent WooCommerce page to keep around for those — skip them in Page Setup.

#### Add Products

1. Go to **Products → Add New**
2. Add product title, description, price, and images
3. Set stock status and publish
4. Repeat or import products via **Products → Import**

### Step 3: WooCommerce API Credentials

1. Go to **WooCommerce → Settings → Advanced → REST API**
2. Click **Add Key**
3. Set **Description** to "Next.js" (or any label)
4. Set **User** to an admin account
5. Set **Permissions** to **Read/Write**
6. Click **Generate API Key**
7. **Copy both keys immediately** - the secret is only shown once

### Step 4: Clone & Configure Next.js

```bash
git clone https://github.com/cocart-headless/next-woo.git
cd next-woo
pnpm install
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# WordPress/WooCommerce Site
WORDPRESS_URL="https://your-wordpress-site.com"
WORDPRESS_HOSTNAME="your-wordpress-site.com"
NEXT_PUBLIC_WORDPRESS_URL="https://your-wordpress-site.com"

# Webhook secret (generate with: openssl rand -base64 32)
WORDPRESS_WEBHOOK_SECRET="your-secret-key-here"

# WooCommerce API credentials from Step 3
WC_CONSUMER_KEY="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
WC_CONSUMER_SECRET="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Only needed if you enable the WooCommerce Stripe Gateway - mounts Stripe
# Elements client-side for card payments (safe to expose)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxxxxxxxxxxxxx"
```

### Step 5: Payment Gateway

Configure your payment gateway in **WooCommerce → Settings → Payments**. Checkout is handled by this Next.js app via CoCart Plus's checkout API — no redirect to WooCommerce.

Popular options:
- **Stripe** (WooCommerce Stripe Gateway) - Card payments via Stripe Elements, mounted client-side; requires `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **PayPal** or other redirect-based gateways - Customer is sent to `action_data.redirect` and returns to `/checkout/success`
- **Cash on Delivery** - For testing, no client-side config needed

#### Configure Return URL

For the customer to land back on this Next.js site after payment:

1. Set CoCart Starter's `frontend_url` setting in WP admin so `payment_result.redirect_url` points at this app instead of the WooCommerce domain
2. Redirect-based gateways send the customer to `/checkout/success` automatically once payment completes

### Step 6: Revalidation Plugin (Optional)

For automatic cache updates when products/posts change:

1. Download the plugin from [wordpress/next-revalidate](https://github.com/cocart-headless/next-woo/tree/main/wordpress/next-revalidate) in this repo
2. Go to **Plugins → Add New → Upload Plugin**
3. Upload and activate the plugin
4. Go to **Settings → Next.js Revalidation**
5. Enter your Next.js site URL and webhook secret

### Step 7: Run Development Server

```bash
pnpm dev
```

Your site is now running at `http://localhost:3000`.

#### Verify the Connection

- Visit `http://localhost:3000/shop` - Should display your products
- Visit `http://localhost:3000/posts` - Should display your blog posts
- Test the cart and checkout flow

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │
│    Next.js      │ ◄─────► │   WooCommerce   │
│   (Frontend)    │   API   │    (Backend)    │
│                 │         │                 │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ ┌───────────────────────┐ │
         │ │      User Flow        │ │
         │ └───────────────────────┘ │
         │                           │
         ▼                           ▼
   ┌──────────┐               ┌──────────┐
   │  Browse  │               │  Account │
   │   Cart   │ ────API─────► │  Orders  │
   │ Checkout │               │          │
   └──────────┘               └──────────┘
    (Next.js)                (WooCommerce)
```

### Checkout Flow

Checkout is native/headless via CoCart Plus's checkout API — payment for
supported gateways (offline gateways plus any redirect-based gateway) is
handled without leaving the Next.js app:

1. Customer adds items to cart (CoCart session, cart-key based)
2. Customer fills the billing form on `/checkout`; address/shipping-rate
   calculation happens live via `cart-provider.tsx`
3. Customer selects a payment method (`GET checkout/payment-methods`)
4. Order is created and paid in one call (`POST checkout` via
   `lib/cocart-checkout.ts`'s `processCheckout()`)
5. The response's `payment_result.payment_status` determines what happens
   next: `success`/`no_payment_required`/`on_hold` redirect to
   `redirect_url` (this app's own `/checkout/success` if CoCart Starter's
   `frontend_url` is configured in WP admin, otherwise the WooCommerce
   domain); a `requires_action` redirect gateway sends the customer to
   `action_data.redirect`
6. Cart cleared automatically before redirecting

## Project Structure

```
next-woo/
├── app/
│   ├── api/
│   │   ├── og/                    # OG image generation
│   │   └── revalidate/            # Cache revalidation webhook
│   ├── shop/                      # Product listing
│   ├── product/[slug]/            # Product detail pages
│   ├── product-category/[slug]/   # Category pages
│   ├── cart/                      # Shopping cart page
│   ├── checkout/
│   │   └── success/               # Order confirmation
│   ├── account/
│   │   ├── (dashboard)/           # Profile, orders, order detail, downloads
│   │   └── verify-email/          # Email verification
│   ├── login/                     # Customer login
│   ├── register/                  # Customer registration
│   ├── posts/                     # Blog posts
│   └── pages/                     # WordPress pages
├── components/
│   ├── shop/                      # Shop components
│   ├── posts/                     # Blog components
│   ├── ui/                        # shadcn/ui components
│   └── theme/                     # Theme toggle
├── lib/
│   ├── woocommerce.ts             # Orders, customers, coupons, shipping, payment gateways
│   ├── woocommerce.d.ts           # WooCommerce type definitions
│   ├── cocart.ts                  # CoCart SDK-backed product/category/cart functions
│   ├── cocart-client.ts           # Shared CoCart SDK client singleton
│   ├── cocart-checkout.ts         # CoCart Plus native checkout API client
│   ├── cocart-account.ts          # CoCart Plus account/auth API client
│   ├── cocart-register.ts         # Customer registration API client
│   ├── stripe-client.ts           # Stripe Elements client-side helper
│   ├── wordpress.ts               # WordPress API functions
│   └── wordpress.d.ts             # WordPress type definitions
├── site.config.ts                 # Site metadata
└── menu.config.ts                 # Navigation configuration
```

## API Functions

### Products

```typescript
import { getProducts, getProductBySlug } from "@/lib/cocart";

// Get paginated products
const { data: products, headers } = await getProducts(1, 12, {
  category: 5,
  on_sale: true,
  orderby: "price",
});

// Get single product
const product = await getProductBySlug("product-name");
```

### Categories & Tags

```typescript
import { getAllProductCategories, getProductCategoryBySlug } from "@/lib/cocart";

const categories = await getAllProductCategories();
const category = await getProductCategoryBySlug("clothing");
```

### Checkout

```typescript
import { getPaymentMethods, processCheckout } from "@/lib/cocart-checkout";

const methods = await getPaymentMethods();

const { payment_result } = await processCheckout({
  billing_address: { email: "customer@example.com", first_name: "...", /* ... */ },
  shipping_address: { /* ... */ },
  use_different_billing: true,
  payment_method: "cod",
});

if (payment_result.payment_status === "success") {
  window.location.href = payment_result.redirect_url;
}
```

### Cart (Client-side)

```typescript
import { useCart } from "@/components/shop";

function MyComponent() {
  const { cart, addItem, removeItem, updateQuantity, clearCart } = useCart();

  await addItem({
    productId: 123,
    quantity: 1,
    name: "Product Name",
    price: "29.99",
  });
}
```

## Customization

### Site Configuration

Edit `site.config.ts`:

```typescript
export const siteConfig = {
  site_name: "Your Store",
  site_domain: "https://yourstore.com",
  site_description: "Your store description",
};
```

### Navigation

Edit `menu.config.ts`:

```typescript
export const mainMenu = {
  home: "/",
  shop: "/shop",
  blog: "/posts",
};
```

## Scripts

```bash
pnpm dev       # Start development server
pnpm build     # Build for production
pnpm start     # Start production server
pnpm lint      # Run ESLint
```

## Troubleshooting

### Products not loading
- Verify WooCommerce REST API credentials are correct
- Check API at `your-site.com/wp-json/wc/v3/products`
- Ensure products are published and visible

### Images not loading
- Add WordPress domain to `WORDPRESS_HOSTNAME`
- Check `next.config.ts` has correct `remotePatterns`

### Checkout redirect fails / lands on the WooCommerce domain
- Verify CoCart Plus is active and its `checkout/config` endpoint responds
- Set CoCart Starter's `frontend_url` setting in WP admin so
  `payment_result.redirect_url` points back at this Next.js app instead of
  the WooCommerce domain
- Check the selected payment gateway is enabled and configured in WooCommerce

### Account / login not working
- Verify CoCart Plus's account/auth endpoints respond (`lib/cocart-account.ts`)
- Ensure `WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET` are valid — order history on `/account/orders` uses the WooCommerce REST API
- Ensure `NEXT_PUBLIC_WORDPRESS_URL` is set correctly — the client-side CoCart SDK (`lib/cocart-client.ts`) uses it as its base URL

## Tech Stack

- [Next.js 16](https://nextjs.org/) - React framework
- [React 19](https://react.dev/) - UI library
- [Tailwind CSS v4](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [WooCommerce](https://woocommerce.com/) - E-commerce backend
- [CoCart](https://cocartapi.com/) - Headless cart & REST API for WooCommerce

## License

MIT License

## Credits

Built on a forked [next-wp](https://github.com/9d8dev/next-wp) by [9d8](https://9d8.dev).

Headless cart functionality powered by [CoCart](https://cocartapi.com/).
