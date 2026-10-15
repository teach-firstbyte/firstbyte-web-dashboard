import Image from "next/image";
import { AuthForm } from "./AuthForm";
import { BackLink } from "@/components/BackLink";
import { safeInternalPath, withBasePath } from "@/lib/paths";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const { error, redirect } = await searchParams;

  // Set by requireSignedInUser when a signed-out visitor hits a deep link --
  // the QR flows (/feedback/:id, /check-in/:id) are the reason this exists.
  // Sanitized here, at the edge, so everything downstream can trust it.
  const returnTo = safeInternalPath(redirect);

  return (
    <div className="container mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      {/* Escape hatch for anyone who hit "Dashboard" in the marketing navbar and
          just wants to get back to the site. */}
      <div className="mb-4 self-start">
        <BackLink href="/" label="Back to main site" exitsZone />
      </div>
      <div className="text-center mb-8">
        <Image
          src={withBasePath("/FirstByteBitex4.png")}
          alt="FirstByte"
          width={120}
          height={120}
          className="mx-auto mb-4"
        />
        <h1 className="text-3xl font-bold">FirstByte Dashboard</h1>
        <p className="text-muted-foreground">Sign in to continue</p>
      </div>
      <AuthForm error={error} returnTo={returnTo} />
    </div>
  );
}
