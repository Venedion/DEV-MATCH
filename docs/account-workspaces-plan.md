# Client and developer workspaces

## Account choices

- Connect: the signed-in user adds a developer workspace to their existing account. The existing client workspace and its data remain intact; authentication continues to use the same email and password.
- Create new: the user signs out and registers a separate developer account using another email and password. The existing client account remains separate. No automatic link or data sharing is implied.

## Data model

Keep `auth.users` as the identity and retain `profiles` for shared identity and contact information. Add `account_workspaces` keyed by `(user_id, role)` with role `client` or `dev`, independent onboarding status and role-specific profile data. The original role stays canonical in profiles; account_workspaces stores additional roles only, avoiding stale duplicate data. Do not remove existing profile fields until all consumers and policies have migrated. Creating a workspace must be idempotent and restricted to the authenticated owner. Track the active workspace in sessionStorage per user and per tab; never use a browser-provided role alone for authorization.

## Authorization and rollout

Review all existing role checks in RLS, database functions, storage policies and edge functions. Replace assumptions that `profiles.account_role` is the sole role with server-side workspace membership checks. Keep ownership constraints and existing email verification requirements. Update onboarding, directory data, project and notification queries to use the correct workspace. Preserve other users' data and test existing single-role accounts before deploying migrations.

## Interaction

When an authenticated client selects developer mode and lacks that workspace, show Connect using current account and Create a separate account. Connect creates the developer workspace and opens developer onboarding. Creating a separate account signs out after a clear explanation and opens developer signup; switching back requires signing in to the client account again. If the workspace already exists, switch directly. Apply the symmetric flow from developer to client if desired.

## Validation and deployment

Run `npm ci`, `npm test`, and `npm run test:database`. The database suite runs repository migrations in PGlite with Supabase system tables stubbed, and exercises role membership, independent profile data, RLS, projects, directory privacy, metrics, and project reviews. Authentication identity (username, email, phone and credentials) remains account-wide. Profiles, inboxes, favorites, notifications, read state and notification preferences are scoped to the selected workspace.

Production migration `account_workspaces_and_latest_features` applies the November 17 metrics, replies, reviews and workspace changes together. The chat-api Edge Function also needs the matching role-aware implementation. Static Vercel uploads contain only HTML, assets, and vercel.json.

## Workspace isolation follow-up

Migration `20261118143004_workspace_data_isolation.sql` preserves historical rows and assigns their original workspace. Project conversations derive roles from their project; legacy direct conversations use participants' original roles. New conversations persist both participant roles, and the chat API checks membership and conversation role on every request. Contacts use the canonical username and their saved conversation role. Favorites and notification reads include the workspace in their keys. Notification triggers route to the correct workspace and honor its independent preferences. New connected profiles start blank while keeping the shared login identity.

Validation covers existing-row migration, RLS, separate role-pair conversations for the same users, cross-workspace chat rejection, independent profiles, favorites, notification reads and preferences. Live QA uses disposable synthetic accounts to exercise Connect, onboarding and switching back to the original inbox. Deploy the database migration and matching chat-api before the static frontend.
