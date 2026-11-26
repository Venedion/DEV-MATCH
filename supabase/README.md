# DEV-MATCH: ready account features

Branch: codex/ready-auth. Project: yxwktllqbmhustmhdaqi (Singapore).

Included: email/password registration, confirmation links and resend screen,
email-confirmed login, login by email code, profile onboarding/storage, profile settings persistence,
password recovery and change, session logout, recovery styling, and direct
birthday month/year selection. Published project listings, directories,
dashboard metrics, notifications, and media now use Supabase. The secure chat
backend is implemented locally but still needs the migration, secrets, and Edge
Function deployment below.

Phone numbers are stored as contact data only. This release does not prove phone
ownership and does not require SMS verification to complete onboarding.
Email ownership is checked using trusted Supabase Auth confirmation.

Email-code login is for existing accounts. In Supabase Auth, set the Magic link
or OTP subject to `Kode login DEV-MATCH` and use `email-otp.html` for its body.
The form accepts the configured email OTP length from six to ten digits.
Use the configured custom SMTP relay.
Registration and password recovery use their separate link templates.

The private profiles table uses RLS. Password hashes are managed by Supabase Auth;
no password or privileged service key belongs in application profile data.

Accounts: https://supabase.com/dashboard/project/yxwktllqbmhustmhdaqi/auth/users
Profiles: https://supabase.com/dashboard/project/yxwktllqbmhustmhdaqi/editor

The initial migration, account-registration.sql, and email-onboarding.sql are
already applied to the hosted project. Do not reapply those files there. On a
fresh project, apply `migrations/202611080001_account_profiles.sql`, then
`migrations/202611090001_profile_account_fields.sql`, and then
`email-onboarding.sql`. The profile migration adds the account and onboarding
columns used by later migrations and creates new profiles from signup metadata,
including the selected account role. `account-registration.sql` is retained as
a rerunnable legacy equivalent for existing setups. Existing projects that
already ran that legacy script should still apply the new profile migration
once; its idempotent schema changes and trigger replacement keep the migration
history aligned. The email-onboarding guard replaces the experimental
phone-required guard without marking a phone as verified.

The user favorites and notification state migration
(`migrations/202611110001_user_preferences_and_favorites.sql`) must also be
applied to the hosted project before deploying the matching frontend changes.
On a fresh project, run it after the profile migration and email-onboarding SQL.
It creates RLS-protected favorites and notification-read tables; notification
preferences are stored in `profiles.profile_data`. On the first authenticated
load, legacy favorites and read-state values are imported once for that account
if its new database table is empty; browser storage then serves only as a local
cache.

The projects/comments migration
(`migrations/202611110002_projects_and_comments.sql`) is required for the
client request composer, developer portfolio manager, and shared project
comments. Apply it after the favorites/notification migration. It creates one
owner-scoped projects table for portfolio items and client requests plus
publicly readable comments with authenticated, profile-derived author names.
On the first authenticated load, a user's own legacy requests and portfolio
items are imported once only when that account has no matching rows. Legacy
comments are not imported because their original authors cannot be verified.

The conversations/directory migration
(`migrations/202611120001_conversations_and_directory.sql`) completes the next
large-level backend step for chat and discovery. It adds authenticated chat
conversations and message tables with RLS and a directory view for logged-in
users. Apply `migrations/202611120003_private_profiles_and_public_directory.sql`
after the other migrations to reset profile-table policies and grants to
owner-only access and recreate the authenticated directory view with an
allowlist of public fields. The view does not expose phone or private
`profile_data` keys such as bank-account, tax identifiers, or birthdays. Do not
query `profiles` for directory listings.
Conversation participants cannot directly change or delete a thread, preventing
one participant from exposing or deleting the other participant's message
history. Chat now uses the encrypted Edge Function and Supabase Realtime;
published project catalogs and public directories load from Supabase instead
of prototype arrays.

Apply `migrations/202611120002_public_project_comments.sql` after the
conversations/directory migration. It limits new comments to published projects
and open requests and only exposes comments for those public projects (plus a
user's own existing comments). Conversation uniqueness is per participant pair
and project, so the same users can have separate threads for separate projects.

The hosted DEV-MATCH project already received the November 17 metrics, replies,
reviews, and workspace changes in the combined migration
`account_workspaces_and_latest_features` (`20261117170424`). The separate
migration files below describe those changes for fresh/local databases; do not
apply them again to the hosted project. The hosted project also contains older
bundled migration versions; fetch their SQL into `supabase/migrations` with
`supabase migration fetch --remote` before pushing from a checkout that does not
contain them. Reconcile individual local migrations as applied only after
verifying their changes are present; do not mark hosted bundles as reverted.
The read-receipt and presence migrations are ordered before the latest hosted
bundle, so include earlier pending versions when applying them with
`supabase db push --remote --include-all`.

For a fresh/local database, apply
`migrations/202611170003_project_comment_replies.sql` after the project comments
and notification migrations. It adds threaded replies for project comments,
lets request owners read comments on their own requests and reply even when a
request is no longer public, and notifies the original commenter. Reply
notifications are included in the developer notification feed and dashboard
activity.

Apply `migrations/202611190001_sync_project_comment_display_names.sql` after
the project comment migrations. It updates existing comment author names to
each account's primary profile display name and keeps them synchronized when
that display name changes. Workspace-specific display names do not affect
comment authors.

Apply `migrations/202611190002_public_developer_work_terms.sql` after
`migrations/20261117164331_account_workspaces.sql` to include account-owned
`contractTypes` in the authenticated developer directory projection. It
retains the existing public field allowlist and does not expose private payout
or tax data.

Apply `migrations/202611190003_public_request_card_metrics.sql` after the
favorites, project-comments, and account-workspaces migrations. It exposes only
aggregated favorite and comment counts for open requests to authenticated
developer workspaces; it does not return view counts or individual favorite
records.

After applying the profile/directory migration in the Supabase SQL Editor (or
through the project's migration workflow), verify that authenticated users can
read only their own `profiles` row and that `directory_people` returns only its
public projection. Configure authentication endpoint limits in the Supabase
Dashboard under Authentication > Rate Limits. These cover signup/sign-in and
related Auth endpoints; they do not automatically rate-limit arbitrary
application API requests, which need separate endpoint or gateway protections.

Dashboard and profile mutations use the Supabase client's bearer-token
authentication, with ownership enforced by database RLS; this app does not use
an application session cookie. A server-issued CSRF token is therefore not part
of this flow. Adding a token only in browser JavaScript would not create a
server-side CSRF guarantee. If authentication moves to HttpOnly cookies later,
route mutations through a backend that validates a CSRF token.

Registration anti-abuse runs entirely in Supabase Edge Functions and the
`migrations/202611120004_registration_protection.sql` migration. To avoid
blocking new signups during cutover, configure secrets and deploy the functions
before applying the migration:

- `REGISTRATION_HMAC_SECRET`: a randomly generated secret with at least 32
  bytes. Keep it server-side and never commit it.
- `APP_ORIGINS`: comma-separated, exact browser origins allowed to call the
  functions, such as `https://dev-match.example` and
  `http://localhost:3000`. Do not include URL paths or a trailing slash.

Supabase supplies the project URL and server service-role key to Edge Functions;
the key must never be exposed in frontend code. Deploy both functions with the
Supabase CLI:

```text
supabase secrets set REGISTRATION_HMAC_SECRET="replace-with-a-random-secret" APP_ORIGINS="https://your-domain.example,http://localhost:3000"
supabase functions deploy register-challenge
supabase functions deploy register-permit
```

Then apply `migrations/202611120004_registration_protection.sql` after the other
migrations and deploy the updated frontend.

The public functions are configured with `verify_jwt = false` because they must
be callable before signup; they enforce an explicit origin allowlist and use the
server-only key only when calling the rate-limit RPC. Vercel may still host the
static site and apply its security headers, but it does not run registration
backend code.

The migration requires a valid, one-time permit for every new `auth.users`
record; signup through Supabase Auth's browser API remains in use, but direct
signup requests without a permit are rejected. This also applies to accounts
created through Supabase Dashboard/admin APIs; use the protected registration
flow to create new users after applying the migration. The permit function limits
successful registration permits to five per IPv4 `/24` or IPv6 `/64` network
per rolling hour, stored in the project's Postgres database (no external Redis).
The HMAC challenge, honeypot and proof-of-work are checked by the server.
Keep Supabase's own Auth rate limits enabled as an additional layer. This
integration does not change email verification or login-by-email-code flows.

Secure chat is implemented by
`migrations/202611120005_encrypted_realtime_chat.sql` and the
`functions/chat-api` Edge Function. Apply the migration after
`202611120004_registration_protection.sql`. It replaces the unused plaintext
message column with AES-GCM ciphertext, a random nonce, and a key version;
authenticated participants can read ciphertext for Realtime, but only the
Edge Function can write messages or decrypt them. The migration stops without
changing data if `public.messages` already contains rows; export and encrypt
those rows before retrying it.

Set these additional Supabase secrets before deploying the chat function:

- `CHAT_ENCRYPTION_KEYS`: JSON object mapping key versions to base64-encoded
  cryptographically random 32-byte keys, for example `{"1":"replace-with-a-base64-key"}`.
- `CHAT_ACTIVE_ENCRYPTION_KEY_VERSION`: active positive integer version, such
  as `1`. Keep previous keys in the keyring to decrypt messages encrypted with
  older versions.
- `APP_ORIGINS`: the same exact-origin allowlist used by the registration
  functions.

Configure secrets, apply `migrations/202611120005_encrypted_realtime_chat.sql`,
deploy `chat-api` with `supabase functions deploy chat-api`, and then deploy the
updated static frontend. Supabase Realtime uses the authenticated Supabase
session token over WSS; this app does not use a session cookie. Message content
is sanitized on the server before encryption and before being returned to either
participant. The old device-only demo conversations are not associated with
account IDs and are cleared from local storage when the new chat page loads;
they are not imported.

Apply `migrations/202611120006_live_data_metrics_notifications_storage.sql`
after migration `202611120005`. It adds:

- `get_dashboard_metrics()` and `record_project_view()` RPCs. View counts are
  unique authenticated viewers per project per UTC day; anonymous views and
  the owner's own views are not counted.
- An RLS-protected notification feed populated for project comments,
  project favorites, and encrypted chat messages. Notification preferences
  suppress matching events when disabled.
- A public `project-media` bucket for project images/video and avatars, where
  only authenticated owners can upload or change objects. A private
  `private-uploads` bucket restricts experience documents to their owner and
  request attachments to the request owner or authenticated developers while
  the request is open. The separate private `chat-attachments` bucket is
  readable only by conversation participants and has no authenticated upload
  policy; only the Edge Function writes its encrypted objects.

Chat attachments use the `chat-attachments` bucket only as encrypted object storage.
`chat-api` encrypts attachments with AES-GCM before upload, stores attachment
metadata inside the encrypted message, and returns decrypted bytes only to
conversation participants. Supported files are PDF, DOC, DOCX, JPG, PNG, or
WebP up to 2 MB. Redeploy `chat-api` after updating it. Do not upload chat
attachments directly from the browser.

Project proposals use
`migrations/202611240001_project_proposals.sql`, after the encrypted chat and
private `chat-attachments` bucket migrations. It adds participant-readable
proposal and agreement records, developer-only proposal creation, recipient-only
acceptance, and creator-only withdrawal. Proposal events are encrypted chat
messages linked to their structured terms; proposal attachment bytes are
AES-GCM encrypted in the existing private chat bucket and are downloaded only
through `chat-api`. Acceptance snapshots and locks the proposal terms in an
agreement. Apply the migration, deploy the updated `chat-api`, and deploy the
updated chat page before using proposal cards. Do not expose proposal or
agreement tables to direct client writes.

Accepted proposal agreements use
`migrations/202611260001_proposal_agreement_payments.sql` for agreement-linked
payment state, order references, and dispute reviewer assignments. This keeps
proposal terms as the source of truth while the existing project payment tables
remain available for legacy project rooms. Deploy the updated `payment-api` and
chat frontend after applying the migration. Midtrans checkout uses Sandbox;
escrow, refunds, and payouts remain simulations.

Apply `migrations/202611180001_realtime_notifications.sql` after
`202611120006_live_data_metrics_notifications_storage.sql` to add the
notification table to Supabase Realtime. This allows the app's notification
badge to update while a user is on another page.

Apply `migrations/202611180002_chat_message_read_receipts.sql` after
`migrations/202611180001_realtime_notifications.sql` (the encrypted chat
migration must already be applied), then deploy the updated `chat-api` Edge
Function and frontend. Opening a conversation marks incoming messages as read;
the sender sees “Read” beside the sent message and receives updates in real time.

Apply `migrations/202611180003_chat_global_presence.sql` after the encrypted
chat migration and deploy the updated frontend to enable chat contact presence
across the site. If also applying read receipts, apply
`migrations/202611180002_chat_message_read_receipts.sql` first. A verified
user's active Realtime connection publishes only that user's ID while they use
any page; other users can read that status only when they share a conversation.
A stored login session by itself does not count as online, and the status clears
when all of the user's tabs/devices disconnect. No Edge Function deployment or
new secret is required for presence. All participants need the updated frontend
for the indicator to work.

The migration and frontend changes are local until the migration is applied
and the updated `chat-api` is deployed to the hosted project. Apply database
migrations in order; do not mark a feature live until its Supabase operation
has been verified.

Two-way project reviews use
`migrations/202611170002_project_engagement_reviews.sql`, after
`migrations/202611170001_owned_project_metrics.sql`. In a project-linked chat,
either participant can confirm completion; reviews unlock only after both the
client and developer confirm. Each participant can submit one 1–5 rating and
an optional comment per conversation. Review tables have no direct client write
or read grants; authenticated RPCs enforce participant and completion checks,
and the public profile RPC returns only display-safe review fields. Apply the
migration before deploying the matching frontend. Chat participants retain
read access to the project metadata associated with their conversation even
after a request is closed, so they can finish the confirmation flow.

Supabase Auth continues to manage password hashing and credentials; the app
does not store password hashes itself. Argon2id migration and recovery codes
are not included in this implementation.

Local callback origin is http://localhost:3000. Set Site URL and allowed redirect
URLs for the real deployment, including /devmatch-reset-password.html. Supabase
may fall back to Site URL, so index.html waits for Auth before routing callbacks.

Apply `migrations/202611260006_username_validation.sql` after the existing
migrations and deploy the updated frontend to enable normalized, case-insensitive
usernames, live availability checks, and server-enforced seven-day username
changes. Existing usernames are lowercased during migration; their initial
change timestamp is backfilled from the profile creation time. The migration
provides the public availability RPC and the authenticated username-change RPC;
no Edge Function deployment is required.

The built-in email sender is for development: its quota is two emails per hour
per project and recipient restrictions apply. Reset/confirmation requests may
be rejected when this quota is exhausted. Configure an email provider before
public production signup. No sender credentials are present in this repository.

Run node --test tests/*.test.cjs. The browser-independent tests cover session
guards, settings persistence, password changes, recovery routing/errors, and
chat message sanitization and encryption.
They mock SDK requests and do not prove delivery to a real inbox. A database
transaction test confirmed that unconfirmed email cannot finish onboarding,
confirmed email can finish without a verified phone, and phone status stays
unverified. Fixture changes were rolled back.

## Midtrans DP checkout (local source only)

The DP payment changes in
`migrations/20261126110000_payments.sql`,
`functions/payments`, and `functions/midtrans-webhook` are local and have not
been applied or deployed. Do not run database or deployment commands until the
staging project reference is provided and the migration is approved. The
`project_id` above is not a staging reference; do not use it for this work.

The Vercel build script `npm run build` writes the ignored
`assets/js/deployment-config.js` from these optional environment variables:

- `DEVMATCH_SUPABASE_URL` and `DEVMATCH_SUPABASE_ANON_KEY` select the frontend's
  Supabase project for that deployment. Both must be set for staging; otherwise
  the existing production frontend defaults remain in effect.
- `DEVMATCH_MIDTRANS_ENVIRONMENT` selects `sandbox` or `production` and defaults
  to `sandbox`.
- `DEVMATCH_MIDTRANS_CLIENT_KEY` is the public client key matching that
  environment.
- `DEVMATCH_MIDTRANS_SNAP_JS_URL` optionally overrides the Snap script URL,
  which must use the matching Midtrans host.

The embedded DP checkout is enabled only when the Supabase URL, Supabase anon
key, and Midtrans client key are all provided. Without a staging build
configuration, the frontend retains the existing production Supabase defaults
and legacy checkout behavior.

Configure `MIDTRANS_ENVIRONMENT`, `MIDTRANS_SERVER_KEY`, and
`PAYMENT_RETURN_ORIGIN` only in the staging Edge Function environment.
`PAYMENT_RETURN_ORIGIN` must be the HTTPS origin of that staging frontend; the
function uses it to return the payer to the same conversation in Client mode.
Never add the server key to frontend configuration. Before enabling the
integration, deploy the migration and both Edge Functions explicitly to
staging, after approval and once its project reference is known.
The staging Edge Function `APP_ORIGINS` allowlist must also include the exact
origin serving the staging frontend.

For Midtrans Sandbox, set the dashboard's Payment Notification URL to
`https://<STAGING_PROJECT_REF>.supabase.co/functions/v1/midtrans-webhook`.
This is guidance only; the dashboard has not been changed. The rollback script
removes payment-kind notification rows, so review their data impact before
using it.
