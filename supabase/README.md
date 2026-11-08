# DEV-MATCH accounts

Hosted project: `yxwktllqbmhustmhdaqi` (DEV-MATCH, Singapore).

- Accounts and email: https://supabase.com/dashboard/project/yxwktllqbmhustmhdaqi/auth/users
- Profiles, phone numbers, and onboarding data: https://supabase.com/dashboard/project/yxwktllqbmhustmhdaqi/editor
- Email redirect configuration: https://supabase.com/dashboard/project/yxwktllqbmhustmhdaqi/auth/url-configuration

The initial migration and `account-registration.sql` are already applied to this
project; do not run them again. For a fresh project, apply the initial migration
first, then the registration SQL. Supabase Auth owns email/password storage;
passwords must never be added to profiles or application storage.

Registration creates an Auth user and automatically inserts a private profile
with username, phone, and the developer/client persona. Phone is contact data,
not a verified phone login. Login uses email/password and restores profile data
from the database. Completing onboarding saves name and the remaining profile
fields to profiles. Persona is not an administrative privilege.

The frontend uses the vendored Supabase JS SDK 2.119.0 and a publishable key.
The private profile table uses RLS and column grants to restrict each account to
reading/updating its own data. No service-role key is included.

For local email links use `http://localhost:3000`, Supabase's default site URL.
For deployment, change Site URL and allowed redirects to the actual website
origin. Configure custom SMTP before accepting public registrations; Supabase's
default mail service limits recipients and sending volume. Keep email
confirmation enabled. Email delivery and clicking a verification/recovery link
must also be checked with an email inbox controlled by the project owner.

Verified: browser rejects invalid credentials and redirects signed-out dashboard
visitors; live Auth API accepts a confirmed temporary fixture, rejects wrong
passwords, reads/updates its own profile, blocks anonymous profile access, and
logs out. Database tests verify registration metadata, onboarding, and isolation
between accounts. Test fixture was removed. Supabase security advisors returned
no findings. Real inbox delivery was not tested.

Existing project listings, chat, notification content, and settings actions
outside registration/onboarding remain demo features.

Contact verification: `contact-verification.sql` has also been applied. Its Auth
trigger mirrors trusted confirmation timestamps into read-only profile columns;
`account_verified` is generated from verified email and a matching verified phone.
The local frontend routes incomplete accounts to `devmatch-verify.html`. Pending
accounts may read their own profile and change their contact phone, but cannot
complete onboarding. Existing onboarding data is preserved; it does not confer
verified status. Changing the contact phone invalidates the combined status.
The phone provider is not yet active, so pending users cannot reach the dashboard
until SMS is configured and verification succeeds. The UI reports this honestly.

Password recovery: `devmatch-forgot-password.html` requests a reset email without
requiring a password. It uses an explicit return URL, while the root callback
also supports Supabase's fallback Site URL. Configure allowed redirects for the
deployed origin and `/devmatch-reset-password.html`. Recovery routes bypass the
phone-verification gate. Invalid/expired links show a way to request a new link;
password confirmation and a successful-update login message are included.
Recovery tests use mocked SDK calls; real inbox delivery/new-password submission
still require a user-controlled inbox and manual password entry.
