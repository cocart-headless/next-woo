import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@cocartheadless/sdk/nextjs";
import { createOrder } from "@/lib/woocommerce";
import type { CreateOrderInput } from "@/lib/woocommerce.d";

const wordpressUrl = process.env.WORDPRESS_URL;

export async function POST(request: NextRequest) {
  try {
    if (!wordpressUrl) {
      return NextResponse.json(
        { error: "WORDPRESS_URL is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.billing?.email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Source cart contents from CoCart's server-side cart (identified by the
    // X-Cart-Key header) rather than trusting a client-submitted item list -
    // CoCart is the single source of truth for "what's in the cart".
    const cartClient = createServerClient(wordpressUrl, request.headers);
    const cartResponse = await cartClient.cart().get();
    const items = cartResponse.getItems();

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    // Note: CoCart's cart item `id` is the variation ID for variable
    // products (not the parent product ID) - the API doesn't expose the
    // parent ID separately for a cart item. WooCommerce's order creation
    // resolves a variation ID passed as `product_id` correctly since
    // wc_get_product() returns the WC_Product_Variation either way, but this
    // should be verified against the target store during testing.
    const line_items = items.map((item) => ({
      product_id: item.id,
      quantity: item.quantity.value,
    }));

    // Create order in WooCommerce (unpaid - payment handled via WooCommerce checkout)
    const orderData: CreateOrderInput = {
      set_paid: false,
      billing: body.billing,
      shipping: body.shipping,
      line_items,
      customer_note: body.customer_note,
    };

    const order = await createOrder(orderData);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        number: order.number,
        status: order.status,
        total: order.total,
        payment_url: order.payment_url,
        needs_payment: order.needs_payment,
      },
    });
  } catch (error) {
    console.error("Checkout error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to create order";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
