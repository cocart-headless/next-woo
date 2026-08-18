"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { Section, Container } from "@/components/craft";
import { Button } from "@/components/ui/button";
import { verifyEmailChange } from "@/lib/cocart-account";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const userId = searchParams.get("user_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const request =
      key && userId
        ? verifyEmailChange(key, userId)
        : Promise.reject(
            new Error("This confirmation link is missing required information.")
          );

    request
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(
          err instanceof Error
            ? err.message
            : "This confirmation link is invalid or has expired."
        );
      });
  }, [key, userId]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Confirming your new email address...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Confirmation Failed</h1>
          <p className="text-muted-foreground max-w-md">{message}</p>
        </div>
        <Button asChild>
          <Link href="/account/edit">Back to Account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Email Confirmed</h1>
        <p className="text-muted-foreground max-w-md">
          Your new email address has been confirmed.
        </p>
      </div>
      <Button asChild>
        <Link href="/account">Back to Account</Link>
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Section>
      <Container>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </Container>
    </Section>
  );
}
