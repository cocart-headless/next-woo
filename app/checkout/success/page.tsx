"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2 } from "lucide-react";

import { useCart } from "@/components/shop/cart-provider";
import { getOrderReceived, type OrderReceived } from "@/lib/cocart-checkout";
import { formatPrice } from "@/lib/cocart";
import { Section, Container } from "@/components/craft";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function SuccessContent() {
  const searchParams = useSearchParams();
  const { clearCart, cart } = useCart();

  // Handle both URL formats:
  // Our format: ?order=123
  // WooCommerce format: ?order-received=123&key=wc_order_xxx
  const orderId = searchParams.get("order") || searchParams.get("order-received");
  const orderKey = searchParams.get("key");

  const [order, setOrder] = useState<OrderReceived | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    // Clear cart on success page load (payment completed)
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (!orderId || !orderKey) return;

    getOrderReceived(orderId, orderKey)
      .then(setOrder)
      .catch((err) =>
        setOrderError(err instanceof Error ? err.message : "Failed to load order")
      );
  }, [orderId, orderKey]);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
      <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="h-12 w-12 text-green-600" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Thank you for your order!</h1>
        <p className="text-muted-foreground max-w-md">
          Your order has been placed successfully. We&apos;ll send you an
          email confirmation shortly.
        </p>
      </div>

      {orderId && (
        <div className="bg-muted px-6 py-4 rounded-lg">
          <p className="text-sm text-muted-foreground">Order Number</p>
          <p className="text-2xl font-bold">#{order?.order_number ?? orderId}</p>
        </div>
      )}

      {order && (
        <div className="border rounded-lg p-6 space-y-4 text-left w-full max-w-md">
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.item_id} className="flex justify-between gap-3 text-sm">
                <span className="line-clamp-2">
                  {item.product_name} × {item.quantity}
                </span>
                <span className="font-medium whitespace-nowrap">
                  {formatPrice(item.total, cart.currency)}
                </span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatPrice(order.total, cart.currency)}</span>
          </div>
        </div>
      )}

      {orderError && <p className="text-sm text-destructive">{orderError}</p>}

      <div className="flex gap-4">
        <Button asChild>
          <Link href="/shop">Continue Shopping</Link>
        </Button>
        {orderId && (
          <Button variant="outline" asChild>
            <Link href={`/account/orders/${orderId}`}>View Order</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-muted-foreground">Loading order details...</p>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Section>
      <Container>
        <Suspense fallback={<LoadingState />}>
          <SuccessContent />
        </Suspense>
      </Container>
    </Section>
  );
}
