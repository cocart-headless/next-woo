"use client";

import { useState, useCallback } from "react";

import type { Product, ProductVariation } from "@/lib/cocart";
import { currencyFromPrices } from "@/lib/cocart";
import { VariationSelector, AddToCartButton, PriceDisplay } from "@/components/shop";
import { Prose } from "@/components/craft";

interface ProductDetailClientProps {
  product: Product;
  variations: ProductVariation[];
}

export function ProductDetailClient({
  product,
  variations,
}: ProductDetailClientProps) {
  const [selectedVariation, setSelectedVariation] =
    useState<ProductVariation | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const handleVariationChange = useCallback(
    (variation: ProductVariation | null, options: Record<string, string>) => {
      setSelectedVariation(variation);
      setSelectedOptions(options);
    },
    []
  );

  // Show variation price if selected, otherwise show product price range
  const displayPrice = selectedVariation?.prices.price || product.prices.price;
  const displayRegularPrice =
    selectedVariation?.prices.regular_price || product.prices.regular_price;
  const displaySalePrice =
    selectedVariation?.prices.sale_price || product.prices.sale_price;
  const isOnSale = selectedVariation?.prices.on_sale ?? product.prices.on_sale;
  const currency = currencyFromPrices(selectedVariation?.prices ?? product.prices);

  // Show the selected variation's own description once one is picked,
  // otherwise fall back to the product's short description.
  const displayDescription = selectedVariation?.description || product.short_description;

  return (
    <div className="space-y-6">
      {/* Variation Selector */}
      <VariationSelector
        product={product}
        variations={variations}
        onVariationChange={handleVariationChange}
      />

      {/* Updated Price Display */}
      {selectedVariation && (
        <div className="space-y-2">
          <PriceDisplay
            price={displayPrice}
            regularPrice={displayRegularPrice}
            salePrice={displaySalePrice}
            onSale={isOnSale}
            currency={currency}
            size="md"
          />
        </div>
      )}

      {/* Description (variation-aware) */}
      {displayDescription && (
        <Prose>
          <div className="text-muted-foreground">
            {displayDescription.replace(/<[^>]*>/g, "")}
          </div>
        </Prose>
      )}

      {/* Add to Cart */}
      <AddToCartButton
        product={product}
        variation={selectedVariation}
        selectedOptions={selectedOptions}
      />
    </div>
  );
}
