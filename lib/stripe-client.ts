// Shared Stripe.js singleton, mirroring lib/cocart-client.ts's pattern -
// loaded lazily and only once, so stores without Stripe configured never
// pay for the Stripe.js network fetch.

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/** Returns null (not a rejected promise) when unconfigured, so callers can gate on it without try/catch. */
export function getStripe(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}
