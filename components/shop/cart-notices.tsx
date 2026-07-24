"use client";

import { useCart } from "@/components/shop/cart-provider";
import { cn } from "@/lib/utils";

const NOTICE_STYLES: Record<string, string> = {
  success:
    "bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  warning:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  notice: "bg-muted text-muted-foreground border-muted-foreground/20",
};

/** Renders CoCart's `notices` (validation warnings, quantity/stock messages, etc.) for the cart and checkout pages. */
export function CartNotices() {
  const { cart } = useCart();
  const entries = Object.entries(cart.notices) as [string, string[]][];

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      {entries.flatMap(([type, messages]) =>
        messages.map((message, index) => (
          <div
            key={`${type}-${index}`}
            className={cn(
              "rounded-md border px-4 py-3 text-sm",
              NOTICE_STYLES[type] ?? NOTICE_STYLES.notice
            )}
          >
            {message}
          </div>
        ))
      )}
    </div>
  );
}
