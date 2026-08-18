"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getMyOrder, type MyOrderDetail } from "@/lib/cocart-account";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<MyOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyOrder(id)
      .then(setOrder)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load order")
      );
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/account/orders">Back to Orders</Link>
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order #{order.order_number}</h1>
        <Button variant="outline" asChild>
          <Link href="/account/orders">Back to Orders</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>{order.order_date}</span>
        <span>{order.order_status}</span>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.item_id} className="flex justify-between gap-3 text-sm">
              <span className="line-clamp-2">
                {item.product_name} × {item.quantity}
              </span>
              <span className="font-medium whitespace-nowrap">{item.subtotal}</span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="space-y-1">
          {Object.entries(order.totals).map(([key, total]) => (
            <div
              key={key}
              className={
                key === "total"
                  ? "flex justify-between font-bold"
                  : "flex justify-between text-sm text-muted-foreground"
              }
            >
              <span>{total.label}</span>
              <span>{total.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Billing Address</p>
          <p className="text-sm">{order.billing_address}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Shipping Address</p>
          <p className="text-sm">{order.shipping_address}</p>
        </div>
      </div>

      {order.order_note && (
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Note</p>
          <p className="text-sm">{order.order_note}</p>
        </div>
      )}

      {order.order_notes.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Order Notes</p>
          {order.order_notes.map((note, i) => (
            <div key={i} className="text-sm">
              <p className="text-muted-foreground">{note.date}</p>
              <p>{note.note}</p>
            </div>
          ))}
        </div>
      )}

      {order.downloads.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Downloads</p>
          {order.downloads.map((download, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{download.product_name}</span>
              <Button variant="outline" size="sm" asChild>
                <a href={download.file}>Download</a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
