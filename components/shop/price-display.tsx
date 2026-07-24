import { formatPrice, calculateDiscountPercentage } from "@/lib/cocart";
import type { CurrencyInfo } from "@cocartheadless/sdk";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  price: string;
  regularPrice: string;
  salePrice: string;
  onSale: boolean;
  currency?: CurrencyInfo;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
}

export function PriceDisplay({
  price,
  regularPrice,
  salePrice,
  onSale,
  currency,
  size = "md",
  showBadge = true,
}: PriceDisplayProps) {
  const discountPercentage = onSale
    ? calculateDiscountPercentage(regularPrice, salePrice)
    : 0;

  const sizeClasses = {
    sm: {
      price: "text-base",
      original: "text-sm",
    },
    md: {
      price: "text-xl",
      original: "text-base",
    },
    lg: {
      price: "text-3xl",
      original: "text-lg",
    },
  };

  if (!price && !regularPrice) {
    return (
      <span className={cn("font-semibold", sizeClasses[size].price)}>
        Price on request
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {onSale ? (
        <>
          <span
            className={cn(
              "font-bold text-destructive",
              sizeClasses[size].price
            )}
          >
            {formatPrice(salePrice, currency)}
          </span>
          <span
            className={cn(
              "text-muted-foreground line-through",
              sizeClasses[size].original
            )}
          >
            {formatPrice(regularPrice, currency)}
          </span>
          {showBadge && discountPercentage > 0 && (
            <Badge variant="destructive">Save {discountPercentage}%</Badge>
          )}
        </>
      ) : (
        <span className={cn("font-bold", sizeClasses[size].price)}>
          {formatPrice(price || regularPrice, currency)}
        </span>
      )}
    </div>
  );
}
