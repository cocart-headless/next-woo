"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  editMyAccount,
  getMyAccount,
  type EditAccountInput,
} from "@/lib/cocart-account";

export default function EditAccountPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");

  useEffect(() => {
    getMyAccount()
      .then((account) => {
        setFirstName(account.user.first_name);
        setLastName(account.user.last_name);
        setDisplayName(account.user.display_name);
        setEmail(account.user.email);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load account")
      )
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    const input: EditAccountInput = {
      account_first_name: firstName,
      account_last_name: lastName,
      account_display_name: displayName,
      account_email: email,
    };
    if (passwordCurrent || password1 || password2) {
      input.password_current = passwordCurrent;
      input.password_1 = password1;
      input.password_2 = password2;
    }

    try {
      const result = await editMyAccount(input);
      setPasswordCurrent("");
      setPassword1("");
      setPassword2("");
      setNotice(
        result.email_verification_pending
          ? "Account updated. Check your new email address for a confirmation link before it takes effect."
          : "Account updated."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Account</h1>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-muted border px-4 py-3 rounded-lg text-sm">{notice}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            autoComplete="nickname"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <Separator />
        <p className="text-sm text-muted-foreground">
          Leave the password fields blank to keep your current password.
        </p>

        <div className="space-y-2">
          <Label htmlFor="password_current">Current Password</Label>
          <Input
            id="password_current"
            type="password"
            autoComplete="current-password"
            value={passwordCurrent}
            onChange={(e) => setPasswordCurrent(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="password_1">New Password</Label>
            <Input
              id="password_1"
              type="password"
              autoComplete="new-password"
              value={password1}
              onChange={(e) => setPassword1(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password_2">Confirm New Password</Label>
            <Input
              id="password_2"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
