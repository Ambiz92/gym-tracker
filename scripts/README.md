# Scripts

## verify-rls.ts

Checks, with the public anon key and no login, that every table refuses `select`, `insert`, `update` and `delete`, and that the project refuses sign-ups. It exits with 1 if any check fails.

```
npm run verify:rls
```

The npm script loads `.env`. The script also compares its table list with the `create table public.<name>` statements in `supabase/migrations/` and fails if a table has no probe row, so a new migration cannot slip past it. It takes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment and refuses to run with a `service_role` or secret key. It never prints the key. It sends one sign-up and one magic-link request to a throw-away `@example.invalid` address, so no real mailbox is contacted.

Writes must fail with `42501` (permission denied). An empty result is not accepted there, because the probes filter on a nil id and would match nothing even with an open policy.

Not covered, because it needs logged-in sessions: row ownership, and the second-factor rule of migration `0004_optional_mfa.sql`. See the next section.

## Manual check with two real users (Google sign-in)

Run it after applying `0004_optional_mfa.sql` and after any Supabase upgrade. Apply the migration before deploying the front end: the app now treats an aal1 session without a factor as signed in, and until the migration is applied RLS still refuses it.

### Setup

- Auth > Providers: Google enabled with your own OAuth client. In Google Cloud the authorized redirect URI is the Supabase callback, `https://<project-ref>.supabase.co/auth/v1/callback`, not an app URL.
- Auth > Sign In / Providers: sign-ups stay disabled. Create each friend in Auth > Users with their Google email, confirmed and without a password. Google sign-in then attaches to that user by email.
- Auth > URL Configuration, redirect URLs. Supabase falls back to the Site URL when `redirectTo` is not on the list, which looks like a successful login that lands on the wrong page.
  - `https://<github-user>.github.io/gym-tracker/` and `https://<github-user>.github.io/gym-tracker/**`
  - `http://localhost:*/gym-tracker/` and `http://localhost:*/gym-tracker/**`
  - for the dev server opened on the LAN, `http://192.168.*.*:*/gym-tracker/` and its `/**` twin (adjust to your network). Remove these two entries when you do not need them: a wildcard on a private range is the loosest line of the list.
- Policies: `select tablename, policyname from pg_policies where policyname like '%\_mfa\_if\_enrolled' order by 1;` returns seven rows, and no policy name ends in `_aal2`.

For the REST checks, get a user's access token with the password grant (a throw-away test user, or the owner for check c) and keep the key and token in shell variables, never in a file:

```
TOKEN=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}' | jq -r .access_token)
curl -s "$URL/rest/v1/exercise?select=id,name" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"
```

The token of a Google user can be read from the browser (local storage, key `sb-<project-ref>-auth-token`) for the length of the test.

### Checks

a. **A user without TOTP signs in with Google and sees only their rows.** In the app: "Continua con Google" lands on Oggi without asking for a code. Create an exercise. In the SQL editor, `select owner_id, name from public.exercise` shows it under that user's id, and the app shows none of the owner's rows (a new user starts with an empty library).

b. **A second user cannot touch the first user's rows.** With the access tokens of users A and B and a row id `X` owned by A, using B's token:
   - select: `GET /rest/v1/exercise?id=eq.X` returns `[]`;
   - insert: `POST` a row with `owner_id` set to A is refused (`42501`);
   - update: `PATCH ...?id=eq.X` changes nothing (confirm in the SQL editor that the row is as before);
   - delete: `DELETE ...?id=eq.X` removes nothing (confirm the row is still there).
   Repeat on one child table such as `set_log`, since each table has its own policies.

c. **The owner with only a password session (aal1) is still refused.** Take a token from the password grant above for the owner, who has a verified factor. `select` on every table must return `[]` even though rows exist, and insert, update and delete must fail or change nothing. Then check the same request with an aal2 token (after the TOTP step) returns the rows. If the aal1 request returns data, the factor lookup in the policy is failing open: drop `*_mfa_if_enrolled` and restore the aal2 policies from `0001_schema.sql` until it is understood.

d. **A Google user who was not pre-created is refused.** Sign in with a Google account that is not in Auth > Users. The app returns to the login with "Questo account Google non è stato invitato.", and Auth > Users has no new row. If the message is the generic one ("Accesso con Google non riuscito"), note the `error_code` and `error_description` Supabase put in the URL and add them to `isSignupRefused` in `src/auth/errors.ts`.

e. **A verified factor cannot be removed or replaced with an aal1 session.** Do this on a throw-away user that has a verified TOTP factor, not on the owner. With its password-only token: `DELETE $URL/auth/v1/factors/<factor-id>` must be refused, and enrolling a second factor (`POST $URL/auth/v1/factors` with `factor_type=totp`) must be refused as well. Afterwards list the factors and confirm the original is still verified. If either call succeeds, a stolen password is enough to strip the second factor, and the optional-MFA design needs to be rethought before friends are invited. Do not assume this: it depends on the Supabase version.

## check-secrets.ts

Fails when a private Supabase credential appears where only public values belong: an `sb_secret_` key, a `service_role` JWT, a `SERVICE_ROLE_KEY=...` assignment, or any JWT other than the value of `VITE_SUPABASE_ANON_KEY`. It also scans every `VITE_*` environment variable, because those end up in the bundle.

```
npm run check:secrets        # files tracked by git
npm run check:secrets:dist   # the built bundle (run after npm run build)
```

Findings print as `file:line  kind  first 8 characters`, never the whole value. The CI workflow runs both. The new `sb_publishable_` key format is public and is never flagged.
