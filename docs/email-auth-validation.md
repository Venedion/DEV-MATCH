# Email authentication validation

Validated against the hosted Supabase project and `https://devm4tch.vercel.app`
on 18 November 2026, using a temporary test account.

## Fix

The email-code login form previously ignored `otp_disabled` and displayed the
code form as though a message had been sent. Every send error now keeps the
request in its error state. Successful requests use neutral wording because
Supabase may conceal whether an address is registered. The page's script URL
was updated so browsers load the fix.

## Completed checks

- Registration required email confirmation and did not issue a session before
  verification. Brevo recorded delivery of the branded signup email. A fresh
  code submitted on the website opened client profile setup; Supabase recorded
  the email as confirmed. An expired code was rejected.
- The website's forgot-password form requested a recovery email. Brevo recorded
  delivery, and its actual email link opened the live password-reset form.
- A second delivered recovery link was consumed by an integration test running
  the real `reset-password.js` handler with Supabase Auth API calls. The new
  password was saved, the recovery marker and session were cleared, the old
  password was rejected, and the new password signed into the same test user.
  Password entry/submission was tested through the API harness, not browser UI.
- Email-code login requested mail from the live website. Brevo recorded delivery;
  the newest code submitted on the website opened the same client profile setup.
- All 27 production HTML entrypoints returned HTTP 200. This checks availability,
  not every interaction on every page.
- After integrating upstream commit `434c061`, `npm test` passed all 42 tests and
  `npm run test:database` passed schema, workspace isolation, and RLS checks.
- The upstream `202611180001_realtime_notifications.sql` migration was applied
  to the hosted project. Notification RLS remains enabled and SELECT remains
  restricted to the authenticated recipient.

## Limits

SMS verification remains deferred. Phone numbers are contact data and are not
proof of phone ownership. Email delivery was checked through Brevo delivery logs
and its message preview; inbox versus spam placement was not independently
verified. No test passwords, OTPs, or recovery tokens are included in this repo.
