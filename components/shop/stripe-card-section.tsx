"use client";

import { useEffect } from "react";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

import { getStripe } from "@/lib/stripe-client";

interface StripeCardSectionProps {
  /**
   * Called with a function that tokenizes the entered card into a Stripe
   * PaymentMethod id (`pm_...`) when the form is ready to submit, or with
   * null while it isn't (unmounted, or Stripe.js hasn't loaded yet).
   */
  onReady: (createPaymentMethod: (() => Promise<string>) | null) => void;
}

function CardForm({ onReady }: StripeCardSectionProps) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) return;

    onReady(async () => {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card details are incomplete.");

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });

      if (error) {
        throw new Error(error.message ?? "Failed to process card details.");
      }

      return paymentMethod.id;
    });

    return () => onReady(null);
  }, [stripe, elements, onReady]);

  return (
    <div className="rounded-md border px-3 py-2.5">
      <CardElement
        options={{
          style: {
            base: {
              fontSize: "14px",
            },
          },
        }}
      />
    </div>
  );
}

export function StripeCardSection({ onReady }: StripeCardSectionProps) {
  const stripePromise = getStripe();

  if (!stripePromise) {
    return (
      <p className="text-sm text-destructive">
        Stripe is not configured (missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CardForm onReady={onReady} />
    </Elements>
  );
}
