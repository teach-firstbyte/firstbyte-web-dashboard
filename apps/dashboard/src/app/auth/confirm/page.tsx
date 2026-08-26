import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { withBasePath } from "@/lib/paths";
import type { Metadata } from "next";

// This URL carries a single-use token. Keep it out of indexes and out of any
// crawler's follow set.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const COPY: Record<
  string,
  { title: string; description: string; action: string }
> = {
  signup: {
    title: "Confirm your email",
    description: "Click below to finish confirming your account.",
    action: "Confirm my email",
  },
  email: {
    title: "Confirm your email",
    description: "Click below to finish confirming your account.",
    action: "Confirm my email",
  },
  recovery: {
    title: "Reset your password",
    description: "Click below to continue to the password reset form.",
    action: "Continue",
  },
  magiclink: {
    title: "Log in to FirstByte",
    description: "Click below to finish logging in.",
    action: "Log in",
  },
  email_change: {
    title: "Confirm your new email address",
    description: "Click below to finish updating your email address.",
    action: "Confirm my email",
  },
};

const FALLBACK = {
  title: "Confirm this request",
  description: "Click below to continue.",
  action: "Continue",
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;

  // Nothing verifies here — this page is inert on load, which is the point.
  if (!token_hash || !type) {
    return (
      <div className="container mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invalid link</CardTitle>
            <CardDescription>
              This link is missing information. Try signing in or requesting a
              new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">Back to log in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const copy = COPY[type] ?? FALLBACK;

  // A FORM, not a link, and this is load-bearing.
  //
  // Being inert on load only protects against a scanner that fetches the URL
  // from the email. Northeastern's mail security does more than that: it renders
  // this page and follows the links on it, which is exactly how a signup was
  // confirmed 82 seconds before the email arrived in the inbox. An <a> here is
  // indistinguishable to a crawler from any other link.
  //
  // Scanners do not submit forms, so the token now needs a real click. There is
  // no JavaScript involved -- this is a plain HTML POST to a route handler, so
  // it still works with scripting disabled.
  //
  // withBasePath is required because this is a raw <form action>, not next/link:
  // basePath is applied by the Next router, and the browser's own form
  // submission never goes near it.
  return (
    <div className="container mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="post" action={withBasePath("/auth/callback")}>
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type} />
            {next && <input type="hidden" name="next" value={next} />}
            <Button type="submit" className="w-full">
              {copy.action}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
