# DEV-MATCH backend (Supabase)

Hosted project: `yxwktllqbmhustmhdaqi` (Singapore).

Everything the backend needs lives in this folder:

| Path | Contents |
| --- | --- |
| `migrations/` | The complete database schema, in order. One file per change, every version unique. |
| `functions/` | Edge Functions: `register-challenge`, `register-permit`, `chat-api`, `whatsapp-verification`. |
| `templates/email-otp.html` | Body of the "Kode login DEV-MATCH" email (magic link / OTP template). |
| `config.toml` | Auth settings and Edge Function settings. |

The old standalone SQL files (`account-registration.sql`, `email-onboarding.sql`)
were removed: their content is part of the migrations.

## Fresh / local database

```text
supabase start
supabase db reset          # applies every file in migrations/ in order
npm ci && npm test && npm run test:database
```

`npm run test:database` runs the real migrations in PGlite (embedded Postgres)
and checks workspaces, RLS, chat, notifications and the audit fixes.

## Secrets (Edge Functions)

| Secret | Used by | Notes |
| --- | --- | --- |
| `REGISTRATION_HMAC_SECRET` | register-challenge, register-permit | Random, at least 32 bytes. |
| `APP_ORIGINS` | all browser-facing functions | Comma separated exact origins. Defaults to the two Vercel domains when unset. |
| `ALLOW_LOCAL_ORIGINS` | same | `true` only on a local/dev project to allow `localhost`. |
| `REGISTRATION_POW_DIFFICULTY` | register-challenge, register-permit | Optional, 12–24, default 17. |
| `CHAT_ENCRYPTION_KEYS` | chat-api | JSON `{"1":"<base64 32-byte key>"}`. Keep old versions to read old messages. |
| `CHAT_ACTIVE_ENCRYPTION_KEY_VERSION` | chat-api | e.g. `1`. |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | whatsapp-verification | From Meta. |
| `WHATSAPP_BUSINESS_NUMBER` | whatsapp-verification | Digits only, e.g. `6285373117073`. Required (no longer hard-coded). |

The bank/NPWP encryption key is created automatically in Supabase Vault
(`profile_private_details_key`) by migration `20261119200100`. Do not delete it:
without it the stored details cannot be decrypted.

## Updating the hosted project (one-time, after the audit fixes)

The migration history was cleaned up: duplicate copies of the same change were
removed and two pairs of colliding versions were renumbered. The hosted
database already contains every change older than `20261119200000`, so only the
history table has to be aligned. `migration repair` only edits that history; it
does not run or undo SQL.

1. Compare local and hosted history:

   ```text
   supabase migration list
   ```

2. For every version that appears **only under Remote** (expected:
   `20261114131159`, `20261114162904`, `20261117170424`, `20261118085659`,
   `20261118142224`, and any old `202611080001` / `202611090001` /
   `202611180001`–`202611180003` / `202611190002` entries):

   ```text
   supabase migration repair --status reverted <version>
   ```

3. For every version that appears **only under Local** and is older than
   `20261119200000` (its change is already in production):

   ```text
   supabase migration repair --status applied <version>
   ```

4. Apply the audit fixes (the six `20261119200…` files):

   ```text
   supabase db push
   ```

5. Deploy the frontend (it accepts both the old and the new registration
   difficulty).

6. Set `WHATSAPP_BUSINESS_NUMBER`, then redeploy the functions:

   ```text
   supabase secrets set WHATSAPP_BUSINESS_NUMBER=6285373117073
   supabase functions deploy register-challenge register-permit chat-api whatsapp-verification
   supabase functions delete DEV-MATCH    # leftover template function, if it was deployed
   ```

7. Check that the signup trigger is active:

   ```sql
   select tgname from pg_trigger where tgrelid = 'auth.users'::regclass;
   -- must include require_registration_permit_before_signup
   ```

This order keeps signups working at every step: the database accepts both the
old and the new `register-permit`, and the new frontend accepts both the old and
the new challenge difficulty.

## What the backend enforces

* **Registration**: every email sign-up needs a one-time permit from
  `register-permit` (HMAC challenge + proof-of-work + honeypot, max 5 permits per
  IPv4 /24 or IPv6 /64 per hour, each challenge usable once). OAuth/SSO
  sign-ups, invited users and users an administrator creates already confirmed
  (Dashboard "Add user") skip the permit. Email confirmation must stay enabled.
* **Usernames**: `is_username_available()` lets the signup form check first; a
  taken username fails with "Username is already taken".
* **Bank account and NPWP**: stored encrypted in
  `private.profile_private_details`, readable only by the owner through
  `get_private_profile_details(role)` / `save_private_profile_details(role, details)`.
  A trigger removes these keys from `profile_data` if anything tries to write them.
* **Phone**: verified over WhatsApp. One verified number belongs to one
  account; changing the phone number invalidates the verification.
* **Rate limits** (HTTP 429): messages 30/min and 2000/day, comments 5/min and
  200/day, favorites 120/hour, projects 30/day, new conversations 20/hour,
  storage uploads 60/hour and 500 MB per account per bucket.
* **Reviews**: only after both sides confirmed completion, at least 24 hours
  after the collaboration started, at least 3 messages from each side, and
  both accounts have a verified phone.
* **Validation**: size limits for `profile_data` and project `data`, cover
  images must be `https://` URLs, `created_at`/`updated_at` are set by the
  server, favorites must point at an existing project or profile.
* **Chat**: messages are encrypted at rest with AES-GCM by `chat-api` (the
  server holds the keys, so this is not end-to-end encryption). Pagination:
  `list-messages` and `list-conversations` accept `before` (ISO timestamp).
  Messages are marked read only through `sync_chat_activity`. Attachments are
  checked against their file signature, not just the declared MIME type.
* **Notifications**: one message notification per conversation; a daily
  `pg_cron` job (`private.cleanup_old_data()`) removes notifications older than
  90 days and expired rate-limit/registration rows.
* **Anonymous visitors** can read public comments but not their authors' user IDs.
