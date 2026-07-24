"use client";

import { useState, useEffect } from "react";

import type { Product, ProductVariation } from "@/lib/cocart";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface VariationSelectorProps {
  product: Product;
  variations: ProductVariation[];
  onVariationChange: (
    variation: ProductVariation | null,
    selectedOptions: Record<string, string>
  ) => void;
}

export function VariationSelector({
  product,
  variations,
  onVariationChange,
}: VariationSelectorProps) {
  // selectedOptions maps attribute key (e.g. "attribute_pa_color") -> chosen
  // option slug (e.g. "red"). Pre-populate from the product's defaults -
  // default_attributes' key format isn't fully verified against a live
  // store, so match defensively against the real attribute keys rather than
  // assuming an exact prefix match.
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    () => {
      const attributeKeys = Object.keys(product.attributes);
      const bare = (key: string) => key.replace(/^attribute_(pa_)?/, "");
      const initial: Record<string, string> = {};

      for (const [defaultKey, slug] of Object.entries(product.default_attributes)) {
        const matchedKey = attributeKeys.find(
          (key) => key === defaultKey || bare(key) === bare(defaultKey)
        );
        if (matchedKey) initial[matchedKey] = slug;
      }

      return initial;
    }
  );

  // Find matching variation when selections change
  useEffect(() => {
    const matchingVariation = variations.find((variation) => {
      return Object.entries(variation.attributes).every(([key, attr]) => {
        const optionSlugs = Object.keys(attr.option);
        // An empty option map means "any" - this variation doesn't care
        // about this attribute.
        if (optionSlugs.length === 0) return true;
        return selectedOptions[key] === optionSlugs[0];
      });
    });

    onVariationChange(matchingVariation || null, selectedOptions);
  }, [selectedOptions, variations, onVariationChange]);

  const handleSelect = (attributeKey: string, optionSlug: string) => {
    setSelectedOptions((prev) => ({ ...prev, [attributeKey]: optionSlug }));
  };

  // Get available option slugs for an attribute, considering other selections
  const getAvailableOptions = (attributeKey: string): string[] => {
    const otherSelections = { ...selectedOptions };
    delete otherSelections[attributeKey];

    const matchingVariations = variations.filter((variation) => {
      return Object.entries(otherSelections).every(([key, slug]) => {
        const attr = variation.attributes[key];
        if (!attr) return true;
        const optionSlugs = Object.keys(attr.option);
        return optionSlugs.length === 0 || optionSlugs[0] === slug;
      });
    });

    const available = new Set<string>();
    const allOptionSlugs = Object.keys(product.attributes[attributeKey]?.options ?? {});

    matchingVariations.forEach((variation) => {
      const attr = variation.attributes[attributeKey];
      // A variation can mark "any value" for this attribute either by
      // omitting the key entirely (verified live - some real WooCommerce
      // variations never declare an attribute the product still lists as
      // used_for_variation) or by declaring it with an empty option map.
      // Both mean the same thing: every real option the product defines is
      // valid here, not none (the previous behavior disabled every button
      // whenever no variation pinned a specific value for this attribute).
      const optionSlugs = attr ? Object.keys(attr.option) : [];
      if (optionSlugs.length === 0) {
        allOptionSlugs.forEach((slug) => available.add(slug));
      } else {
        optionSlugs.forEach((slug) => available.add(slug));
      }
    });

    return Array.from(available);
  };

  const attributeEntries = Object.entries(product.attributes).filter(
    ([, attr]) => attr.used_for_variation
  );

  if (product.type !== "variable" || attributeEntries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {attributeEntries.map(([attributeKey, attribute]) => {
        const availableOptions = getAvailableOptions(attributeKey);
        const selectedSlug = selectedOptions[attributeKey];

        return (
          <div key={attributeKey} className="space-y-2">
            <Label>{attribute.name}</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(attribute.options).map(([slug, label]) => {
                const isAvailable = availableOptions.includes(slug);
                const isSelected = selectedSlug === slug;

                return (
                  <button
                    key={slug}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => handleSelect(attributeKey, slug)}
                    className={cn(
                      "px-4 py-2 text-sm border rounded-md transition-all",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                      !isAvailable && "opacity-50 cursor-not-allowed line-through"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
