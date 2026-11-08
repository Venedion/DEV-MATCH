# OTP activation — pending sender setup

Not active in the live login flow. Existing password login and email confirmation
links are preserved. `assets/js/otp-service.js` is a tested integration module,
not a completed UI or access-control gate. Its email and phone flags default off.
Unit tests use mocks and do not prove delivery to an email inbox or phone.

Intended flow: email OTP for login; verify a phone on the same account with SMS
after email login, and repeat verification whenever the phone changes.

Activation requirements:

1. Set up an email sender/custom SMTP. The current free-project dashboard blocks
   template editing without custom SMTP or Pro. Install `templates/email-otp.html`
   as the Magic Link/OTP template, subject `Kode login DEV-MATCH`; include
   `{{ .Token }}` in the signup confirmation template too if using code-based
   signup confirmation. Keep email confirmation enabled.
2. Set up a supported SMS provider, its sender/Verify service, and credentials in
   Supabase Auth. Phone authentication is currently disabled. Review charges and
   Indonesia delivery support with the owner before activating SMS.
3. Configure server-side OTP expiry, verification/request rate limits, resend
   intervals, and abuse prevention. The module's 60-second cooldown is UX only;
   it cannot replace server-side limits. Match the six-digit input to the
   configured token length. Credentials belong in provider settings, not Git.
4. Build/connect the code-entry screens; enable email/phone features only after
   real delivery tests. Use `phone_change` verification to attach the phone to
   the existing email account rather than creating a second phone-only account.
5. Require verified email and the matching verified phone in database/API access
   rules for operations that need both. Read verification from trusted Auth data
   (`email_confirmed_at`, `phone_confirmed_at`, and the matching Auth phone),
   never user-editable profile fields, metadata, or browser storage. Define
   pending-verification access so users can finish verification without a loop.
6. Test expired/wrong/reused codes, resends, changed phone numbers, account
   mismatches, unauthorized data access, and delivery to owner-controlled inboxes
   and devices before replacing the current login flow.

Docs: https://supabase.com/docs/guides/auth/auth-email-passwordless
and https://supabase.com/docs/guides/auth/phone-login
