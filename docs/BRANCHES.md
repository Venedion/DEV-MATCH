# Branch cleanup plan

Checked on 2026-11-19 against `origin`.

| Branch | Last commit | Status |
| --- | --- | --- |
| `fix/backend-audit` | audit fixes | **Contains everything below** except `codex/supabase-auth`. Merge this one. |
| `codex/connect-backend` | 2026-11-19 | Fully contained in `fix/backend-audit`. |
| `Dev` | 2026-11-17 | Fully contained. |
| `frontend/backend` | 2026-11-13 | Fully contained. |
| `codex/ready-auth` | 2026-11-10 | Fully contained. |
| `main` | 2026-11-10 | Fully contained, but has no backend yet. |
| `codex/supabase-auth` | 2026-11-08 | Superseded: an earlier attempt at the same auth work. `codex/ready-auth` redid it from the same starting commit ("Ship email-confirmed account flows without unfinished OTP features"). Its only extra content is the unfinished SMS/email OTP experiment that was deliberately left out. |

## Steps

1. Open a pull request `fix/backend-audit` → `main` and let CI run.
2. Merge it (a normal merge keeps every branch's history).
3. Make `main` the only long-lived branch: set it as the default branch and
   protect it (require the CI check and a pull request).
4. Delete the merged branches: `Dev`, `frontend/backend`, `codex/ready-auth`,
   `codex/connect-backend`, `fix/backend-audit`.
5. Delete `codex/supabase-auth` once you agree the OTP experiment is not needed
   (or keep it only as an archive tag: `git tag archive/supabase-auth origin/codex/supabase-auth`).
6. From now on: one short-lived branch per change, merged into `main` through a
   pull request.
