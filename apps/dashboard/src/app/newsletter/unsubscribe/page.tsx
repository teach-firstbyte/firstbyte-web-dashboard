import { notFound } from "next/navigation";

import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { OptOutSwitch } from "@/components/newsletter/SmallActions";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import { isNewsletterEnabled } from "@/lib/newsletter/enabled";

/**
 * Where the email's Unsubscribe link lands. A switch rather than a one-click
 * unsubscribe on load, because mail scanners follow links.
 */
export default async function UnsubscribePage() {
  const user = await requireApprovedUser("/newsletter/unsubscribe");
  if (!isNewsletterEnabled()) notFound();

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <PageHeader
          back={<BackLink href="/newsletter" label="Newsletter" />}
          title="Newsletter email"
          description="Turn the weekly email off or on. Account emails, like password resets, still come either way."
        />
        <div className="rounded-2xl border bg-card p-5">
          <OptOutSwitch optOut={user.newsletterOptOut} />
        </div>
      </div>
    </AppShell>
  );
}
