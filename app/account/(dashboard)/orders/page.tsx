"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  CoCartAccountError,
  getMyOrders,
  type MyOrdersResponse,
} from "@/lib/cocart-account";

const PER_PAGE = 10;

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MyOrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noOrders, setNoOrders] = useState(false);

  useEffect(() => {
    getMyOrders({ page, per_page: PER_PAGE })
      .then((data) => {
        setResult(data);
        setError(null);
        setNoOrders(false);
      })
      .catch((err) => {
        if (
          err instanceof CoCartAccountError &&
          err.code === "cocart_account_no_orders"
        ) {
          setNoOrders(true);
          setResult(null);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load orders");
        }
      })
      .finally(() => setIsLoading(false));
  }, [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Orders</h1>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {!isLoading && error && <p className="text-sm text-destructive">{error}</p>}

      {!isLoading && noOrders && (
        <p className="text-muted-foreground">
          You haven&apos;t placed any orders yet.
        </p>
      )}

      {!isLoading && result && (
        <>
          <div className="border rounded-lg divide-y">
            {result.orders.map((order) => (
              <Link
                key={order.order_id}
                href={`/account/orders/${order.order_id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium">Order #{order.order_id}</p>
                  <p className="text-sm text-muted-foreground">{order.order_date}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{order.order_total}</p>
                  <p className="text-sm text-muted-foreground">{order.order_status}</p>
                </div>
              </Link>
            ))}
          </div>

          {(result.pagination.previous || result.pagination.next) && (
            <Pagination>
              <PaginationContent>
                {result.pagination.previous && (
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.max(1, p - 1));
                      }}
                    />
                  </PaginationItem>
                )}
                {result.pagination.next && (
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => p + 1);
                      }}
                    />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
}
