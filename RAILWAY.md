# Deploy and Host next-woo on Railway

next-woo is a headless WooCommerce storefront built with Next.js 16, React 19, and TypeScript. It features product browsing, a [CoCart](https://cocartapi.com)-powered cart, checkout (via WooCommerce), and blog support. Includes a pre-configured WordPress container with WooCommerce, CoCart, and a cache revalidation plugin.

## About Hosting next-woo

This template deploys a complete headless WooCommerce stack: a MySQL database, WordPress with WooCommerce and CoCart, and a Next.js frontend. WordPress and WooCommerce handle products, orders, and payments, CoCart exposes the cart/session REST API the frontend talks to, and Next.js delivers a fast, modern storefront. The included revalidation plugin automatically invalidates the Next.js cache when products or content change, ensuring your store always shows fresh data. Environment variables are pre-configured to connect all services securely.

## Common Use Cases

- E-commerce stores wanting modern performance with WordPress's familiar admin
- Agencies building custom storefronts for clients who manage their own products
- Existing WooCommerce stores migrating to a headless frontend
- Stores requiring custom checkout flows or unique frontend experiences

## Dependencies for next-woo Hosting

- MySQL 8.0+ (included in template)
- WordPress 6.x with WooCommerce 8.x (included in template)

### Deployment Dependencies

- [next-woo GitHub Repository](https://github.com/9d8dev/next-woo)
- [Next.js Documentation](https://nextjs.org/docs)
- [WooCommerce REST API Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/)

### Implementation Details

After deployment, WordPress auto-installs with WooCommerce and the revalidation plugin pre-configured.

**Post-Deployment Setup:**

1. Wait for WordPress to finish initializing (first deploy takes a few minutes)
2. Visit your WordPress admin at `https://your-wordpress-domain/wp-admin`
3. Log in with credentials from your environment variables:
   ```
   WORDPRESS_ADMIN_USER=admin
   WORDPRESS_ADMIN_PASSWORD=your-secure-password
   WORDPRESS_ADMIN_EMAIL=you@example.com
   ```
4. Go to **WooCommerce → Settings → Advanced → REST API**
5. Generate API keys with **Read/Write** permissions
6. Update your Next.js service environment variables with the real keys:
   ```
   WC_CONSUMER_KEY=ck_xxxxx
   WC_CONSUMER_SECRET=cs_xxxxx
   ```
7. Redeploy the Next.js service to pick up the new keys

To persist uploads and product images between deploys, Pro plan users can add a volume at `/var/www/html/wp-content`.

## Why Deploy next-woo on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying next-woo on Railway, you get a complete e-commerce stack with minimal configuration. Host your storefront, database, and CMS together on one platform.
