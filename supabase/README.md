# DEV-MATCH: ready account features

Branch: codex/ready-auth. Project: yxwktllqbmhustmhdaqi (Singapore).

Included: email/password registration, confirmation links and resend screen,
email-confirmed login, login by email code, profile onboarding/storage, profile settings persistence,
password recovery and change, session logout, recovery styling, and direct
birthday month/year selection. Existing marketplace, chat, and project content
remain prototype/demo features, not a completed backend.

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
already applied to the hosted project. Do not reapply them there. On a fresh
project, run those files in that order. The email-onboarding guard replaces the
experimental phone-required guard without marking a phone as verified.

The user favorites and notification state migration
(`migrations/202611110001_user_preferences_and_favorites.sql`) must also be
applied to the hosted project before deploying the matching frontend changes.
On a fresh project, run it after the three account/profile SQL files. It creates
RLS-protected favorites and notification-read tables; notification preferences
are stored in `profiles.profile_data`. On the first authenticated load, legacy
favorites and read-state values are imported once for that account if its new
database table is empty; browser storage then serves only as a local cache.

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
users. The directory view exposes only an allowlist of public profile fields
and project summary counts; private profile rows remain owner-readable only.
Conversation participants cannot directly change or delete a thread, preventing
one participant from exposing or deleting the other participant's message
history. The prototype arrays in the browser still need to be replaced with
Supabase queries before chat and discovery use real data.

Apply `migrations/202611120002_public_project_comments.sql` after the
conversations/directory migration. It limits new comments to published projects
and open requests and only exposes comments for those public projects (plus a
user's own existing comments). Conversation uniqueness is per participant pair
and project, so the same users can have separate threads for separate projects.

Local callback origin is http://localhost:3000. Set Site URL and allowed redirect
URLs for the real deployment, including /devmatch-reset-password.html. Supabase
may fall back to Site URL, so index.html waits for Auth before routing callbacks.

The built-in email sender is for development: its quota is two emails per hour
per project and recipient restrictions apply. Reset/confirmation requests may
be rejected when this quota is exhausted. Configure an email provider before
public production signup. No sender credentials are present in this repository.

Run node --test tests/*.test.cjs. The browser-independent tests cover session
guards, settings persistence, password changes, and recovery routing/errors.
They mock SDK requests and do not prove delivery to a real inbox. A database
transaction test confirmed that unconfirmed email cannot finish onboarding,
confirmed email can finish without a verified phone, and phone status stays
unverified. Fixture changes were rolled back.
