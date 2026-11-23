# Fake e-board users for testing

2026-11-18 · Issue teach-firstbyte/firstbyte-web-dashboard#141

The e-board task board sends reminder DMs from the "FirstByte Tasks" Slack bot. These 8 made-up people let you test that without real e-board members. They are the sample people from the [mockup](specs/2026-11-18-eboard-task-board-mockup.html). Each one exists in two places:

- **Slack:** a real member of the **FirstByte Slack Dev Sandbox** (`firstbyteslac-gtj8504.slack.com`), so the bot can DM them.
- **Dashboard:** an approved user on the local or preview database, made by the seed script (`apps/dashboard/scripts/seed/seed.mjs`, the `FAKE_EBOARD` list).

Slack and the dashboard are linked by the Slack member ID alone, by hand. The Slack email doesn't need to match the dashboard email, and it doesn't.

## The people

| Name | E-board role | Dashboard role | Teams | Dashboard email | Slack member ID |
|---|---|---|---|---|---|
| Maya Okafor | President | `SUPER_ADMIN` | E-Board (lead) | `maya.okafor@firstbyte.test` | `U0CK0SKF78E` |
| Daniel Reyes | Vice president | `SUPER_ADMIN` | E-Board | `daniel.reyes@firstbyte.test` | `U0CKX75N8L8` |
| Sam Patel | Website lead | `SUPER_ADMIN` | E-Board, Website (lead) | `sam.patel@firstbyte.test` | `U0CK4NBB317` |
| Priya Nair | Events lead | `NORTHEASTERN_ADMIN` | E-Board, Events (lead) | `priya.nair@firstbyte.test` | `U0CK2L2HN3U` |
| Jordan Lee | CS Curricula lead | `NORTHEASTERN_ADMIN` | E-Board, CS Curricula (lead) | `jordan.lee@firstbyte.test` | `U0CK0SGRKML` |
| Alex Kim | STEM Curricula lead | `NORTHEASTERN_ADMIN` | E-Board, STEM Curricula (lead) | `alex.kim@firstbyte.test` | `U0CK2L2T75G` |
| Riley Chen | Brand and Marketing lead | `NORTHEASTERN_ADMIN` | E-Board, Brand and Marketing (lead) | `riley.chen@firstbyte.test` | `U0CKX75UZ9N` |
| Taylor Brooks | Treasurer | `NORTHEASTERN_ADMIN` | E-Board | `taylor.brooks@firstbyte.test` | `U0CJWJUCYRH` |

Team names are the ones in `supabase/seed/officers.json`. If a team is missing there, the seed prints a warning and skips that lead membership.

**Slack status (2026-11-18).** All 8 were invited, and Slack gave each a member ID when it sent the invite. The ID stays the same when they join, whether through the invite email or the shared invite link (checked with Jordan, Maya and Daniel). **Joined: Maya, Daniel, Jordan.** Sam, Priya, Alex, Riley and Taylor are still only invited. They can't get DMs, and their Slack name is the inbox name until they join. Usernames look like `@<inbox>_fb-j` either way, so go by the member ID.

**Slack emails.** Each Slack account is a Gmail plus-address on one inbox that Hector owns: `<inbox>+fb-maya@gmail.com`, `<inbox>+fb-daniel@gmail.com` and so on, by first name. The real inbox isn't written here on purpose. Ask Hector.

## Dashboard: make or reset them

The seed empties the app tables and makes everything again, the fake e-board included. It refuses to run against production.

```bash
cd apps/dashboard
npm run db:seed:local      # local Supabase stack
npm run db:seed:preview    # shared preview project (tell the team first)
```

The **Reset preview database** GitHub workflow recreates them too.

**Logins.** To sign in as one of them, set `TEST_EBOARD_PASSWORD` in `supabase/seed/.env.test-accounts` (see the `.example` file) and seed again. All 8 share that one password. Without it, the seed makes their rows but no logins. To get logins on preview from the workflow, add the same line to the `PREVIEW_TEST_ACCOUNTS` GitHub secret. Never put the password in the repo or a group channel.

A good permission test: sign in as Priya (a lead, not a super admin) and check that she can change her own task's status but not its owner or due date.

## Slack: recreate them

You only need this if the sandbox accounts are lost, deactivated or moved to a new workspace. A new account gets a **new member ID**, so update the table above, the `slackUserId` values in `FAKE_EBOARD`, and the task board's Slack links.

Slack can't create users through its API on Free or Pro plans: `admin.users.invite` is Enterprise only and SCIM needs Business+. So each person is an email invite.

1. In the sandbox, go to **Admin → People → Invitations → Invite People**. Paste the 8 plus-addresses and leave **Add to channels** empty. Invites last 30 days.
2. For each invite email, open the link in a **private window** and sign up with the person's full name. Hector handles the CAPTCHA, codes and passwords. If you use the same browser window as your own Slack sign-in, joining replaces your session and signs you out.
   Slack sent only 1 of 8 invite emails to the shared inbox, and **Extend Invitation** or re-inviting didn't help. What worked: the workspace's shared invite link (**Invite People → Invite link**). Open it in a private window and sign up with the person's plus-address. Slack still emails a sign-up code, and those can take a while too, so do a few at a time.
3. Find each member ID: open their profile → **⋮** → **Copy member ID**, or search for the name with the Slack connector.

To remove someone: **Admin → People → Members → Deactivate account**. Deactivated accounts can't get DMs, so the bot's sends to them will fail.

## Notes

- The sandbox is on a free trial of Slack Pro that ends on 2026-11-20. After that it's on the free plan, which has no member cap and allows up to 10 apps (the newsletter bot is one of them).
- The newsletter bot is installed in the same sandbox. Don't change it. The Tasks bot is a separate app.
- When the bot moves to the real FirstByte Slack, these fake people stay behind. Real e-board members get linked there instead.
