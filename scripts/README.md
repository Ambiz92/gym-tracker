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

The anon-only script cannot see the second-factor rule of `0004_optional_mfa.sql`, or row ownership: both need logged-in sessions. Run this section once before inviting anyone, and again after any Supabase upgrade.

### Supabase and Google setup

Redirect URLs (Auth > URL Configuration). List only these two entries:

- Site URL and redirect: `https://<github-user>.github.io/gym-tracker/`
- Redirect: `http://localhost:5173/gym-tracker/`

Do not add wildcards. GoTrue globs use `.` and `/` as separators, so a single `*` does not cross them but `**` does, and a pattern such as `http://localhost:**` is matched against the URL text: a URL like `http://localhost:@evil.example/` (the part before the `@` is user info, the host is `evil.example`) is the classic way past loose patterns, and with Google sign-in the code would be delivered to the attacker's page.

What the list does not restrict, as confirmed by the security audit: Supabase Auth accepts any URL with the Site URL's scheme and host, on any path, without consulting the list, and any loopback IP literal (`127.0.0.1`, `[::1]`) on any port and path. In practice the allowed set is every page under `https://<github-user>.github.io/` plus loopback addresses. Non-loopback IP literals are refused, so Google sign-in cannot be tested from a phone through the Mac's LAN address: test it on `localhost` from the Mac, or on the deployed URL. Password login works on the LAN as before. If `redirectTo` is not accepted, Supabase falls back to the Site URL, which looks like a successful login that lands on the wrong page.

Consequence: all GitHub Pages sites of one account share one origin, so any other Pages site on that account can read gym-tracker's local storage (session tokens, the PKCE verifier). With friends on board this is a cross-user risk. Keep no other Pages site with third-party scripts on that account, or, better, move gym-tracker to its own custom (sub)domain and set the Site URL to it. Do this before inviting friends or going public.

Dashboard settings:

- Auth > Providers > Google: enabled, with your own OAuth client. In Google Cloud the authorized redirect URI is the Supabase callback, `https://<project-ref>.supabase.co/auth/v1/callback`, not an app URL.
- Google consent screen in Testing mode, with the friends added as test users. This is a second allowlist next to Supabase's: an account that is not a test user never reaches Supabase. Test users' authorizations expire after 7 days, so friends see Google's consent screen again every week (Supabase sessions are not affected). The limit is 100 test users.
- Sign-ups disabled. Anonymous sign-ins off. Manual linking off.
- "Confirm email" on. Users created in the dashboard with Auto Confirm are not affected, and sign-ups stay off.
- Friends: create each one in Auth > Users as confirmed (Auto Confirm), with their Google address, and either without a password or with a random password of 32 or more characters that nobody keeps. A password the friend knows would give them a password-only (aal1) way in next to Google. Prefer `@gmail.com` addresses: Supabase links a Google sign-in to the existing user by verified email, and for other domains the verified flag depends on the account type.
- Do not use "Send invitation". Its link puts the tokens in the URL hash, which this app does not read.
- Turn on MFA for your own Supabase and GitHub accounts. The dashboard (or the admin API) is the only way to remove the owner's second factor, and without that factor the owner's account is password-only (see the header of the migration).

### Order of the rollout

1. Rehearse the migration in the SQL editor, inside a transaction that you roll back (next section).
2. Apply `0004_optional_mfa.sql`. In the real app, signed in as the owner with the code (aal2), check that your data is still there.
3. Deploy the front end. It must come after the migration: until then an aal1 user without a factor is signed in but refused by RLS.
4. Enable the Google provider, create the friends, run the checks below.

### Rehearsing the migration

The SQL editor shows only the rows of the last statement that returns rows, and an error replaces them. Every script below therefore ends with one statement that returns everything you need to read, and the insert attempt is a script of its own.

**Step 0: can the editor's role create the policy?** The migration needs `postgres` to run `create policy` and `grant` on `auth.mfa_factors`, a table owned by Supabase's auth service. On hosted Supabase that works only on Postgres images built since late July 2025. As `postgres`, run:

```sql
show supautils.policy_grants;
```

If the output does not contain `auth.mfa_factors`, do not use 0004 as written: on an older image the editor stops with `42501: must be owner of table mfa_factors` (the file is one transaction, so nothing is applied). First choice: upgrade the project's Postgres image (Dashboard > Settings > Infrastructure) and ask again. Second choice, which needs Francesco's explicit approval because `private/CLAUDE.md` forbids `security definer` without asking: a SECURITY DEFINER boolean function in a non-exposed `private` schema, called by the seven restrictive policies instead of reading the table directly. The function would answer only "does the caller have a verified factor", never return rows, pin its `search_path`, and be executable by `authenticated` only. That variant exists as a design and will be written on request; it is not in the repository.

**Step 1: the migration and its grants.** Paste the migration's statements between `begin;` and `rollback;` (leave out the file's own `begin;` and `commit;`, or the rehearsal would commit), and end with one combined select:

```sql
select has_table_privilege('authenticated', 'auth.mfa_factors', 'select') as reads_table,        -- false
       has_column_privilege('authenticated', 'auth.mfa_factors', 'user_id', 'select') as reads_user_id,  -- true
       has_column_privilege('authenticated', 'auth.mfa_factors', 'secret', 'select') as reads_secret,   -- false
       (select relrowsecurity from pg_class where oid = 'auth.mfa_factors'::regclass) as rls_on,        -- true
       (select string_agg(policyname, ',') from pg_policies
         where schemaname = 'auth' and tablename = 'mfa_factors') as policies;  -- mfa_factors_select_own
rollback;
```

**Step 2: role simulation.** Each case is its own `begin; ... rollback;` script with the migration statements first, then the lines below. Put the owner's id, or a friend's, and the aal in the claims. The last statement is the only one you will see:

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<owner-uuid>","role":"authenticated","aal":"aal1"}', true);
select (select count(*) from auth.mfa_factors where user_id = auth.uid() and status = 'verified') as own_verified_factors,
       (select count(*) from public.exercise)      as exercise,
       (select count(*) from public.plan)          as plan,
       (select count(*) from public.plan_session)  as plan_session,
       (select count(*) from public.plan_exercise) as plan_exercise,
       (select count(*) from public.warmup_item)   as warmup_item,
       (select count(*) from public.workout)       as workout,
       (select count(*) from public.set_log)       as set_log;
rollback;
```

For the owner at `aal1` expect `own_verified_factors` of 1 or more (a second `recovery_code` factor shows up as 2 when recovery codes are enabled) and 0 in every table count. Repeat with:

- the owner at `"aal":"aal2"`: the table counts are the real row counts;
- a friend without a factor at `aal1`: `own_verified_factors` 0 and only the friend's own rows;
- the owner with no `aal` key at all: 0 rows everywhere.

**Step 3: the insert, as a separate script.** The error would hide any counts, so run it alone, with the same migration statements first:

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<owner-uuid>","role":"authenticated","aal":"aal1"}', true);
insert into public.exercise (name, equipment) values ('probe', 'other');
rollback;
```

Expect `new row violates row-level security policy "exercise_mfa_if_enrolled"`, and not `permission denied for table mfa_factors` (that would mean the grant is missing). At `aal2`, and for a friend without a factor at `aal1`, the insert succeeds (and is rolled back).

### Checks with real sessions

For REST checks, get an access token with the password grant for a throw-away test user, typing the password without echo and keeping it out of the command line and the shell history. `$URL` and `$ANON` are the project URL and the public anon key.

```
read -rs PW
TOKEN=$(jq -n --arg e "$EMAIL" --arg p "$PW" '{email: $e, password: $p}' \
  | curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' -d @- \
  | jq -r .access_token)
unset PW
curl -s -w '\n%{http_code}\n' "$URL/rest/v1/exercise?select=id,name" -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"
```

A Google user's token can be read from local storage (`sb-<project-ref>-auth-token`) for the length of the test. The SQL-editor role simulation above is the safer way to test the owner.

a. **A user without TOTP signs in with Google and sees only their rows.** "Continua con Google" lands on Oggi without asking for a code. Create an exercise. In the SQL editor, `select owner_id, name from public.exercise` shows it under that user's id, and the app shows none of the owner's rows (a new user starts with an empty library).

b. **A second user cannot touch the first user's rows.** With the tokens of users A and B and a row id `X` owned by A, using B's token:
   - select: `GET /rest/v1/exercise?id=eq.X` returns `[]`;
   - insert: a `POST` with `owner_id` set to A is refused (`42501`);
   - update: `PATCH ...?id=eq.X` changes nothing (confirm in the SQL editor); B patching one of its own rows to set `owner_id` to A is refused;
   - delete: `DELETE ...?id=eq.X` removes nothing (confirm the row is still there);
   - B inserting a `set_log` that points at A's `workout_id` is refused with `23503` (the composite keys of `0002_owner_fks.sql`).
   Repeat the first four on one child table such as `set_log`, since each table has its own policies.

c. **The owner with only a password session (aal1) is refused, and the refusal is the policy, not a missing grant.** Best done with the role simulation above. With a real token: at aal1, `GET /rest/v1/exercise` must answer HTTP 200 with `[]` although rows exist; at aal2 (after the TOTP step) the same request returns the rows. A `42501` permission error does not count as a pass: it means the policies cannot read the factors and the app is broken for everybody. If the aal1 request returns data, the factor lookup is failing open: restore the aal2 policies with the rollback block in the migration header until it is understood.

d. **A Google user who was not pre-created is refused, and nobody can sign up.** Sign in with a Google account that is not in Auth > Users. The app returns to the login with "Questo account Google non è stato invitato.", and Auth > Users has no new row. If the generic message appears instead ("Accesso con Google non riuscito"), note the `error_code` and `error_description` in the URL and add them to `isSignupRefused` in `src/auth/errors.ts`. Also: `curl -s -X POST "$URL/auth/v1/signup" -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{}'` (an anonymous sign-in) must return an error and no `access_token`.

e. **A verified factor cannot be removed or replaced, and the account cannot be taken over, with an aal1 session.** On a throw-away user with a verified TOTP factor, using its password-only token:
   - `DELETE $URL/auth/v1/factors/<factor-id>` must be refused;
   - enrolling a second factor (`POST $URL/auth/v1/factors` with `factor_type` `totp`) must be refused;
   - `PUT $URL/auth/v1/user` changing the email or the password must fail with `insufficient_aal`.
   Afterwards list the factors and confirm the original is still verified. If any of them succeeds, a stolen password is enough to strip the second factor, and the optional-MFA design needs another look before friends are invited. Do not assume this: it depends on the Supabase version and settings.

f. **After each friend's first login, check how the account was linked.**

```sql
select provider, identity_data ->> 'email_verified' as email_verified from auth.identities where user_id = '<friend-uuid>';
select email, email_confirmed_at is not null as confirmed, coalesce(encrypted_password, '') = '' as no_password from auth.users;
```

Expected: a `google` identity with `email_verified` true, `confirmed` true, and `no_password` true (or a password nobody knows) for every friend.

## check-secrets.ts

Fails when a private Supabase credential appears where only public values belong: an `sb_secret_` key, a `service_role` JWT, a `SERVICE_ROLE_KEY=...` assignment, or any JWT other than the value of `VITE_SUPABASE_ANON_KEY`. It also scans every `VITE_*` environment variable, because those end up in the bundle.

```
npm run check:secrets        # files tracked by git
npm run check:secrets:dist   # the built bundle (run after npm run build)
```

Findings print as `file:line  kind  first 8 characters`, never the whole value. The CI workflow runs both. The new `sb_publishable_` key format is public and is never flagged.

## generate-exercise-seed.ts

Builds `supabase/seed/exercise-catalog.sql` from the curated `supabase/seed/exercise-catalog.json` (about 60 fundamental exercises with Italian names, synonyms, muscles and execution steps; adapted from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), Unlicense). Nothing in it comes from a personal plan.

```
npm run seed:catalog
```

To add or fix an exercise, edit the JSON and run the command: it validates the file (unique slugs and names, equipment `barbell`, `dumbbell` or `other`, known muscles, lengths within the database checks) and refuses to write on any problem. Commit the JSON and the regenerated SQL together; a test fails if they drift apart.

The SQL runs as `postgres` after migration `0005_exercise_catalog.sql` and is safe to run again: it upserts the catalog by slug, links existing user exercises to it by normalized name (lowercase, no accents, trimmed) and never merges or deletes anything. Exercises whose name matches several catalog entries, or whose owner already has the entry, stay unlinked. The last statement is a read-only list of those exercises, to decide by hand. Rehearse it on a copy of the data first, as for 0004.
