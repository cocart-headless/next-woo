import type { Product, ProductVariation } from "@/lib/cocart";
import { isProductInStock, getProductStockMessage } from "@/lib/cocart";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  product: Product | ProductVariation;
  showQuantity?: boolean;
  className?: string;
}

export function StockBadge({
  product,
  showQuantity = false,
  className,
}: StockBadgeProps) {
  const inStock = isProductInStock(product);
  const message = getProductStockMessage(product);

  const isLowStock =
    product.stock.stock_quantity !== null &&
    typeof product.stock.low_stock_amount === "number" &&
    product.stock.stock_quantity <= product.stock.low_stock_amount &&
    product.stock.stock_quantity > 0;

  const isBackorder = product.stock.stock_status === "onbackorder";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {inStock ? (
        <Badge
          variant={isLowStock ? "outline" : "secondary"}
          className={cn(
            isLowStock && "border-yellow-500 text-yellow-600 bg-yellow-50"
          )}
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full mr-2",
              isLowStock ? "bg-yellow-500" : "bg-green-500"
            )}
          />
          {message}
        </Badge>
      ) : isBackorder ? (
        <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
          <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
          {message}
        </Badge>
      ) : (
        <Badge variant="destructive">
          <span className="w-2 h-2 rounded-full bg-red-300 mr-2" />
          {message}
        </Badge>
      )}
    </div>
  );
}
