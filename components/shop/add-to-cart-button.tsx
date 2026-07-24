"use client";

import { useState } from "react";
import { ShoppingCart, Plus, Minus, Loader2 } from "lucide-react";

import type { Product, ProductVariation } from "@/lib/cocart";
import { isProductInStock, variationCartAttributes } from "@/lib/cocart";
import { useCart } from "@/components/shop/cart-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AddToCartButtonProps {
  product: Product;
  variation?: ProductVariation | null;
  selectedOptions?: Record<string, string>;
  className?: string;
  showQuantity?: boolean;
}

export function AddToCartButton({
  product,
  variation,
  selectedOptions,
  className,
  showQuantity = true,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // External/affiliate products aren't added to the cart at all - they link
  // out to wherever the merchant configured (external_url), labeled with
  // their own button_text (e.g. "Buy on Amazon").
  if (product.type === "external") {
    return (
      <Button asChild className={cn("w-full", className)} size="lg">
        <a href={product.external_url} target="_blank" rel="noopener noreferrer">
          {product.button_text || "Buy Product"}
        </a>
      </Button>
    );
  }

  // For variable products, require both a matched variation AND an explicit
  // shopper selection for every variation attribute - a variation can match
  // via "any value" attributes (see variation-selector.tsx) without the
  // shopper ever having picked one, so !variation alone isn't enough to
  // gate on.
  const isVariable = product.type === "variable";
  const variationAttributeKeys = Object.entries(product.attributes)
    .filter(([, attr]) => attr.used_for_variation)
    .map(([key]) => key);
  const allOptionsSelected = variationAttributeKeys.every((key) =>
    Boolean(selectedOptions?.[key])
  );
  const needsVariation = isVariable && (!variation || !allOptionsSelected);

  // Check stock
  const checkableItem = variation || product;
  const inStock = isProductInStock(checkableItem) ||
    checkableItem.stock.stock_status === "onbackorder";

  const maxQuantity = checkableItem.stock.stock_quantity || 99;

  const handleAddToCart = async () => {
    if (needsVariation || !inStock) return;

    setIsAdding(true);

    try {
      await addItem({
        productId: product.id,
        variationId: variation?.id,
        quantity,
        attributes: variation
          ? variationCartAttributes(product.attributes, variation.attributes, selectedOptions)
          : undefined,
      });

      // Reset quantity after adding
      setQuantity(1);
    } finally {
      setIsAdding(false);
    }
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity((q) => q + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity((q) => q - 1);
    }
  };

  if (!inStock) {
    return (
      <Button disabled className={cn("w-full", className)}>
        Out of Stock
      </Button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Quantity Selector */}
      {showQuantity && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Quantity:</span>
          <div className="flex items-center border rounded-md">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={decrementQuantity}
              disabled={quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center font-medium">{quantity}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={incrementQuantity}
              disabled={quantity >= maxQuantity}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add to Cart Button */}
      <Button
        onClick={handleAddToCart}
        disabled={needsVariation || isAdding}
        className="w-full"
        size="lg"
      >
        {isAdding ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adding...
          </>
        ) : needsVariation ? (
          "Select options"
        ) : (
          <>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </>
        )}
      </Button>
    </div>
  );
}
