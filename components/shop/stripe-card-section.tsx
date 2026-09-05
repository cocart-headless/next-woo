"use client";

import { useEffect, useState } from "react";
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
  // Lazy-initialized so getStripe() (and the loadStripe() call inside it)
  // runs at most once per mount instead of on every render. Safe to call
  // during SSR too - getStripe() only touches process.env, and stripe-js's
  // own loadScript() no-ops (resolves null) when window/document aren't
  // available - but this component only ever mounts client-side in
  // practice, once a Stripe payment method is selected post-hydration.
  const [stripePromise] = useState(() => getStripe());

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
