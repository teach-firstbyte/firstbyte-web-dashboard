"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Banner } from "@/components/ui/banner";
import { signUp, logIn } from "./actions";
import { GoogleButton } from "./GoogleButton";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";

export function AuthForm({
  error,
  returnTo,
  googleEnabled,
}: {
  error?: string;
  /** Already sanitized by the page; app-internal path or null. */
  returnTo?: string | null;
  /** False on preview deployments, whose Supabase project has no Google login. */
  googleEnabled: boolean;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");

  const copy = {
    login: { title: "Log In", description: "Use your email to sign in." },
    signup: {
      title: "Sign Up",
      description: "Create your account to get started.",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy[mode].title}</CardTitle>
        <CardDescription>{copy[mode].description}</CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Banner variant="destructive" role="alert" className="mb-4">
            {error}
          </Banner>
        )}

        {googleEnabled ? (
          <>
            <GoogleButton
              label={
                mode === "signup"
                  ? "Sign up with Google"
                  : "Sign in with Google"
              }
              returnTo={returnTo}
            />
            <div className="my-4 text-center text-sm text-muted-foreground">
              or
            </div>
          </>
        ) : (
          <Banner className="mb-4">
            Google sign-in is off on preview deployments. Use a test account.
          </Banner>
        )}
        <form className="space-y-3">
          {/* Carries the deep link through the password action, which has no
              other view of the URL it was submitted from. */}
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
          <Input name="email" type="email" placeholder="Email" required />
          <Input
            name="password"
            type="password"
            placeholder="Password"
            required
            minLength={6}
          />
          {mode === "signup" && (
            <Input name="name" type="text" placeholder="Full name" required />
          )}
          <div className="flex flex-col items-center gap-4">
            <SubmitButton
              formAction={mode === "signup" ? signUp : logIn}
              className="w-full"
            >
              {mode === "signup" ? "Sign up" : "Log in"}
            </SubmitButton>
            <button
              type="button"
              onClick={() =>
                setMode((m) => (m === "login" ? "signup" : "login"))
              }
              className="text-sm text-muted-foreground hover:underline"
            >
              {mode === "signup"
                ? "Already have an account? Log in"
                : "Need an account? Sign up"}
            </button>
            {mode === "login" && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
