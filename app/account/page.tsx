"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/shop";
import { Section, Container } from "@/components/craft";
import { Button } from "@/components/ui/button";

export default function AccountPage() {
  const router = useRouter();
  const { customer, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <Section>
        <Container>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container>
        <div className="max-w-md mx-auto space-y-6">
          <h1 className="text-2xl font-bold">My Account</h1>
          <div className="space-y-1">
            <p className="font-medium">{customer?.display_name}</p>
            <p className="text-muted-foreground">{customer?.email}</p>
          </div>
          <Button variant="outline" onClick={() => logout()}>
            Log Out
          </Button>
        </div>
      </Container>
    </Section>
  );
}
