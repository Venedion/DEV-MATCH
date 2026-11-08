# DEV-MATCH email designs

Prepared HTML templates; **not applied to hosted Auth**.

The current dashboard requires custom SMTP or a Pro subscription before it
allows subject/body customization while sending authentication emails. No
subscription or sender configuration was changed.

When email sending is configured, use the subjects in `subjects.json` and paste
each HTML file into the corresponding Confirm sign up / Reset password template
at https://supabase.com/dashboard/project/yxwktllqbmhustmhdaqi/auth/templates.

Keep `{{ .ConfirmationURL }}` intact: Supabase replaces it with the correct
single-use authentication link. Do not replace it with a static website URL.
Send a test to an owner-controlled inbox before using the templates publicly.
