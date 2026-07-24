"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

import { AuthenticationError } from "@cocartheadless/sdk";
import { getClient } from "@/lib/cocart-client";
import { useCart } from "./cart-provider";

// Shape of a successful POST cocart/v2/login response (verified against
// class-cocart-login-controller.php).
export interface Customer {
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  avatar_urls?: Record<string, string>;
}

// There's no account/profile-fetch endpoint on this store (confirmed live -
// cocart/v2/my-account doesn't exist here), so the profile from a
// successful login is persisted ourselves, alongside the JWT the SDK
// already persists, to restore "who is this token for" on reload without
// re-prompting for a password. Plain localStorage is fine here (unlike a
// password, a display name/email isn't sensitive) - matches the SDK's own
// default storage for the JWT itself.
const CUSTOMER_STORAGE_KEY = "cocart_customer_profile";

function readStoredCustomer(): Customer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Customer) : null;
  } catch {
    return null;
  }
}

function storeCustomer(customer: Customer | null) {
  if (typeof window === "undefined") return;
  if (customer) {
    window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customer));
  } else {
    window.localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  }
}

interface AuthContextType {
  customer: Customer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { refreshCart } = useCart();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore a persisted JWT session on mount (the piece Basic-Auth-only
  // phase 1 explicitly didn't have - a JWT is safe to persist, unlike a
  // raw password). If the token's expired but a refresh token exists, try
  // one refresh before giving up.
  useEffect(() => {
    (async () => {
      const client = getClient();
      await client.jwt().restoreTokensFromStorage();

      if (!client.hasJwtToken()) {
        setIsLoading(false);
        return;
      }

      let valid = await client.jwt().validate();
      if (!valid && client.getRefreshToken()) {
        try {
          await client.jwt().refresh();
          valid = await client.jwt().validate();
        } catch {
          valid = false;
        }
      }

      if (valid) {
        setCustomer(readStoredCustomer());
      } else {
        await client.jwt().clearTokens();
        storeCustomer(null);
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const client = getClient();
        // client.login() persists the JWT/refresh token to storage on
        // success automatically (same storage the cart key uses).
        const response = await client.login(email, password);
        const profile = response.toObject() as Customer;

        storeCustomer(profile);
        setCustomer(profile);
        await refreshCart();
      } catch (err) {
        setCustomer(null);
        storeCustomer(null);
        const message =
          err instanceof AuthenticationError && err.errorCode === "cocart_2fa_required"
            ? "This account requires two-factor authentication, which isn't supported here yet."
            : "Login failed. Please check your credentials and try again.";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshCart]
  );

  const logout = useCallback(async () => {
    const client = getClient();
    try {
      await client.logout();
    } finally {
      storeCustomer(null);
      setCustomer(null);
      setError(null);
      await refreshCart();
    }
  }, [refreshCart]);

  return (
    <AuthContext.Provider
      value={{
        customer,
        isAuthenticated: customer !== null,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
