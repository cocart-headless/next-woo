"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/shop";
import { Button } from "@/components/ui/button";
import { getMyAccount, type MyAccountResponse } from "@/lib/cocart-account";

export default function AccountPage() {
  const { customer, logout } = useAuth();
  const [account, setAccount] = useState<MyAccountResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyAccount()
      .then(setAccount)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load account")
      );
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Account</h1>

      <div className="space-y-1">
        <p className="font-medium">
          {account?.user.display_name ?? customer?.display_name}
        </p>
        <p className="text-muted-foreground">
          {account?.user.email ?? customer?.email}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!account && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading account details...
        </div>
      )}

      {account && (
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Orders</p>
            <p className="text-2xl font-bold">{account.user.orders_count}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Spent</p>
            <p className="text-2xl font-bold">{account.user.total_spent}</p>
          </div>
        </div>
      )}

      {account?.recent_order.order_id && (
        <div className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Most Recent Order</p>
            <p className="font-medium">{account.recent_order.order_date}</p>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/account/orders/${account.recent_order.order_id}`}>
              View Order
            </Link>
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/account/orders">View Orders</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/account/downloads">Downloads</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/account/edit">Edit Account</Link>
        </Button>
      </div>

      <Button variant="outline" onClick={() => logout()}>
        Log Out
      </Button>
    </div>
  );
}
