import { BackLink } from "@/components/BackLink";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Banner } from "@/components/ui/banner";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/SubmitButton";
import { resendConfirmation } from "./actions";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    resent?: string;
    error?: string;
    /** Set when logIn() bounced someone here for an unconfirmed account. */
    unconfirmed?: string;
  }>;
}) {
  const { email, resent, error, unconfirmed } = await searchParams;

  // Two ways in: straight from signup, or from a login attempt that failed
  // because the account was never confirmed. Same page, different framing --
  // telling someone who just tried to log in to "check your email" with no
  // explanation reads like the login silently failed.
  const cameFromLogin = unconfirmed === "1";

  return (
    <div className="container mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {cameFromLogin
              ? "Confirm your email to continue"
              : "Check your email"}
          </CardTitle>
          <CardDescription>
            {cameFromLogin
              ? email
                ? `${email} hasn't been confirmed yet.`
                : `That account hasn't been confirmed yet.`
              : email
                ? `We sent a confirmation link to ${email}`
                : `We sent you a confirmation link.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {resent === "1" && (
            <Banner variant="success" role="status">
              Sent. Check your inbox for a new link.
            </Banner>
          )}
          {error && (
            <Banner variant="destructive" role="alert">
              {error}
            </Banner>
          )}

          {/* Nothing was just sent on the login path, so "click the link in that
              email" would point at a message from whenever they signed up -- and
              often at one already spent by a link scanner. Offer the resend as
              the primary route instead. */}
          <p>
            {cameFromLogin
              ? "Use the link from your sign-up email, or send yourself a new one below. If you don't see it, check your spam folder."
              : "Click the link in that email to activate your account. If you don't see it, check your spam folder."}
          </p>

          <form className="space-y-3">
            {/* Prefilled from the URL when we know it, but still editable and
                submitted as a real field: this page is reachable without an
                ?email= (a bookmark, a shared link), and a resend button that
                cannot say who to resend to is useless. */}
            <Input
              name="email"
              type="email"
              placeholder="Email"
              defaultValue={email ?? ""}
              required
            />
            <SubmitButton
              formAction={resendConfirmation}
              variant="outline"
              className="w-full"
              pendingLabel="Sending…"
            >
              Resend confirmation email
            </SubmitButton>
          </form>

          <BackLink href="/login" label="Back to Login" />
        </CardContent>
      </Card>
    </div>
  );
}
