// CoCart Plus customer registration API client.
//
// Thin typed wrapper over the public `cocart/v2/register` endpoint, built on
// the shared CoCart SDK client (see lib/cocart-client.ts). Unauthenticated -
// used before a customer has an account or session. Field names
// (`requested_username`/`requested_password`) are deliberate on the API
// side: CoCart Starter's auth layer treats non-empty `username`/`password`
// fields as a Basic Auth attempt, which would collide with this endpoint.

import { getClient } from "@/lib/cocart-client";

export interface RegisterCustomerInput {
  email: string;
  requested_username?: string;
  requested_password?: string;
}

export interface RegisterCustomerResponse {
  user_id: number;
  username: string;
  message: string;
}

export class CoCartRegisterError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "CoCartRegisterError";
  }
}

export async function registerCustomer(
  input: RegisterCustomerInput
): Promise<RegisterCustomerResponse> {
  try {
    const response = await getClient().post(
      "register",
      input as unknown as Record<string, unknown>
    );
    return response.toObject() as RegisterCustomerResponse;
  } catch (error) {
    if (error instanceof Error) {
      // The SDK's CoCartError exposes the WP_Error code as `errorCode`, not
      // `code` (matches the pattern in lib/cocart-checkout.ts/cocart-account.ts).
      const errorCode = (error as { errorCode?: string | null }).errorCode;
      throw new CoCartRegisterError(error.message, errorCode ?? undefined);
    }
    throw error;
  }
}
