// Shared CoCart SDK client singleton, used by both CartProvider (guest cart
// operations) and AuthProvider (login/logout) so that authenticating on one
// instance actually affects every subsequent request made through the other.

import { createBrowserClient } from "@cocartheadless/sdk/nextjs";
import type { CoCart } from "@cocartheadless/sdk";

const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL;

let cocartClient: CoCart | null = null;

export function getClient(): CoCart {
  if (!cocartClient) {
    if (!wordpressUrl) {
      throw new Error("NEXT_PUBLIC_WORDPRESS_URL is not configured");
    }
    cocartClient = createBrowserClient(wordpressUrl);
  }
  return cocartClient;
}
