# Scripts

## verify-rls.ts

Checks, with the public anon key and no login, that every table refuses `select`, `insert`, `update` and `delete`, and that the project refuses sign-ups. It exits with 1 if any check fails.

```
npm run verify:rls
```

The npm script loads `.env`. The script also compares its table list with the `create table public.<name>` statements in `supabase/migrations/` and fails if a table has no probe row, so a new migration cannot slip past it. It takes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment and refuses to run with a `service_role` or secret key. It never prints the key. It sends one sign-up and one magic-link request to a throw-away `@example.invalid` address, so no real mailbox is contacted.

Writes must fail with `42501` (permission denied). An empty result is not accepted there, because the probes filter on a nil id and would match nothing even with an open policy.

Optional signed-in checks of the exercise catalog (migration `0005_exercise_catalog.sql`) run when `RLS_TEST_EMAIL` and `RLS_TEST_PASSWORD` are set in `.env`. Use a throw-away user without a second factor, created in the dashboard. The script then checks that the catalog can be read, that insert, update and delete are refused with `42501`, and that adopting the same entry twice is refused with `23505`. The catalog must hold at least one entry, so run it after the seed. It inserts one exercise named `rls-check` for that user and deletes it again. Setting `RLS_TEST_MFA_EMAIL` and `RLS_TEST_MFA_PASSWORD` too, for a throw-away user with a verified TOTP factor, adds the second-factor check: its password-only session must get an empty catalog, not an error. These variables are not `VITE_*`, so they never reach the bundle.

`RLS_TEST_OTHER_EMAIL` and `RLS_TEST_OTHER_PASSWORD`, a second throw-away user without a second factor, add the cross-owner check of the session calendar (migration `0006_scheduled_session.sql`). The script creates a plan with one session for the first user, checks that the first user can schedule that session, and that the second user scheduling the same session is refused with `23503` (the composite keys), then deletes the plan and the slots. It needs `RLS_TEST_*` too.

Three-user checks of the coach/athlete tables (migrations `0007_coach_athlete.sql` and `0008_coach_read_policies.sql`) run when `RLS_TEST_COACH_*`, `RLS_TEST_ATHLETE_*` and `RLS_TEST_STRANGER_*` are set. The fixtures are three throw-away users created in the dashboard, with a password each (variables `RLS_TEST_<ROLE>_EMAIL` and `RLS_TEST_<ROLE>_PASSWORD`, never `VITE_*`):

- the coach has a verified TOTP factor, and its base32 secret goes in `RLS_TEST_COACH_TOTP_SECRET`. The script computes the codes itself (RFC 6238, `scripts/totp.ts`), so it reaches aal2 without an app. Without the secret only the checks that need no aal2 run (the request and the refused accept at aal1);
- the athlete and the stranger have no second factor;
- optional: `RLS_TEST_BOTH_*` plus `RLS_TEST_BOTH_TOTP_SECRET`, a user with a factor who is the coach's athlete and the stranger's coach. It adds the both-roles, transitivity and mutual-link checks (T-06, T-11, T-12) and the coach-side revoke. It needs `RLS_TEST_COACH_TOTP_SECRET` too.

The script seeds one row in each of the eight data tables for the athlete (and for the other users when `RLS_TEST_BOTH_*` is set), runs the checks of `workspace/security/S-A1.md` (T-02 to T-16 and the S-A1-01, -02 and -03 reproductions) and deletes the seeded rows. Every refusal is judged by its layer: a policy (`row-level security`) or a missing grant (`permission denied`), and every refused write is confirmed by reading the row again as its owner.

No client can delete a `coach_athlete` row, and a revoked pair can never be requested again, so every run leaves link rows behind and the next run stops at the start. The error prints the statement to run as `postgres` in the SQL editor first:

```sql
delete from public.coach_athlete where athlete_id in ('<user ids>') and coach_id in ('<user ids>') and athlete_label = 'rls-check';
```

It deletes only the rows the script creates: both ends are fixture users and the label is `rls-check`. If a fixture user has a link that is not a test row (for example a fixture variable points at a real account), the script stops with a different error and prints no delete statement: use accounts that only this script touches.

Two cases cannot be reached through the API and live in the SQL rehearsals instead (`workspace/security/rehearsal-0008`, file `3b`): a coach with no factor reading at aal1 with an active link (such a coach can never accept one), and the policy layer alone with the trigger switched off.

Not covered, because it needs real sessions of the app: the second-factor rule of migration `0004_optional_mfa.sql` on the other tables. See the next section.

## Manual check with two real users (Google sign-in)

The anon-only script cannot see the second-factor rule of `0004_optional_mfa.sql`, or row ownership: both need logged-in sessions. Run this section once before inviting anyone, and again after any Supabase upgrade. For the coach/athlete tables (`coach_athlete` and the coach read policies) two users are not enough: use the three-user check at the end of the section "Checks with real sessions".

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
   For the session calendar (`scheduled_session`, migration `0006`), also with A's and B's tokens, `X` being a slot of A and `S` a `plan_session` of A:
   - B's select of `scheduled_session` returns `[]` for `?id=eq.X`, and B's patch or delete of `X` changes nothing;
   - B inserting a slot with `plan_session_id` set to `S` (and its own `owner_id`) is refused with `23503`, and with `owner_id` set to A with `42501`;
   - B inserting a slot with `workout_id` set to one of A's workouts is refused with `23503`;
   - past activity stays: as A, deleting a plan session that has slots leaves the slots (with `plan_session_id` null, same date, status and `session_name`), and deleting a workout leaves its slot with `workout_id` null.

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

### Three-user check for the coach/athlete tables

Needs three users: a coach with a verified TOTP factor (aal2 after the code), an athlete and a stranger, both without a factor. `npm run verify:rls` with the `RLS_TEST_COACH_*`, `RLS_TEST_ATHLETE_*` and `RLS_TEST_STRANGER_*` variables does all of this and more; by hand, with the three tokens and the athlete's row id `X`:

- the athlete inserts a request (`POST /rest/v1/coach_athlete` with only `coach_id` and `athlete_label`); sending `status`, `accepted_at` or an `athlete_id` is refused with `42501 permission denied`;
- the stranger gets `[]` from `GET /rest/v1/coach_athlete` and from every data table filtered on the athlete's `owner_id`;
- the athlete patching their own request to `active`, or the coach patching `athlete_id`, `coach_id` or the label, is refused (`42501`) and the row is unchanged;
- the coach at aal1 gets `[]` from the athlete's tables, and accepting at aal1 changes nothing; at aal2 the accept succeeds, `accepted_at` is set by the server, and the coach reads the athlete's rows in the eight data tables and nobody else's;
- the coach inserting, updating, deleting or upserting a row of the athlete is refused or changes nothing (confirm as the athlete), and a `set_log` of the coach pointing at the athlete's workout fails with `23503`;
- the athlete revokes: the coach's next read returns `[]`, setting `active` again updates no row, and a new request from the athlete to the same coach fails with `23505`.

### Rehearsing migration 0005 (exercise catalog)

Same method as above: the migration's statements between `begin;` and `rollback;` (without the file's own `begin;` and `commit;`), then one of the probes below, each as its own script. Replace `<user-uuid>` with a user's id and use `<user-with-factor-uuid>` for someone with a verified factor.

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<user-uuid>","role":"authenticated","aal":"aal1"}', true);
select count(*) from public.exercise_catalog;
rollback;
```

Insert a catalog row as `postgres` right after the migration statements so there is something to see. Expect the count to be 1 for a user without a factor at `aal1`, 0 for `<user-with-factor-uuid>` at `aal1`, and 1 for that user at `aal2`. As `authenticated`, an `insert`, `update` or `delete` on `public.exercise_catalog` must fail with `permission denied` whatever the `aal`; as `anon` even the `select` fails. For the duplicate rule, run as the user at `aal1`:

```sql
insert into public.exercise (name, equipment, catalog_id) select 'probe', 'other', id from public.exercise_catalog;
insert into public.exercise (name, equipment, catalog_id) select 'probe 2', 'other', id from public.exercise_catalog;
rollback;
```

The second insert must fail with `exercise_one_per_catalog_entry_per_owner`. Exercises with a null `catalog_id` are never limited. After applying the migration, run `npm run verify:rls` (with the signed-in variables if you can) and open the app once as the owner at `aal2` to check that the library still loads.

### Rehearsing migrations 0007 and 0008 (coach and athlete)

The two migrations have one rehearsal folder each (`workspace/security/rehearsal-0007` and `rehearsal-0008`, outside the repository, with a `LEGGIMI.md`). They follow the method of 0006: every script is one `do` block that embeds the migration, creates its own throw-away users inside the block (`insert into auth.users`, rolled back with the rest), simulates the roles and ends with an error whose text is a `check | result | expected` report. The only placeholder is your own user id, in file `3e`. The order is: `0-PRECHECK` (read only), `1-rehearsal-migration` (privileges, policies, trigger, indexes), the role simulations, `APPLICA` (one block with its own checks) and, only if needed, `ROLLBACK`. Run 0007 first and apply it before rehearsing 0008, which needs the table. `ROLLBACK-0008.sql` removes the eight coach read policies and the two indexes, and proves that a coach with an active link then reads nothing. For an emergency use `KILLSWITCH-0008.sql`: it drops only the eight policies of 0008, by name, so it keeps working when later migrations add other `*_select_coach` policies.

Administration in SQL, as `postgres`: the transition trigger applies to every role, so a direct `update` of a link fails. To re-link a pair whose link was revoked, delete the old row (`delete from public.coach_athlete where id = '<link id>'`) and let the athlete send a new request. To edit a link row on purpose, wrap the update in `alter table public.coach_athlete disable trigger coach_athlete_guard;` and `enable trigger` again, inside one transaction.

### Rehearsing migration 0006 (session calendar)

The probes for `0006_scheduled_session.sql` are not the `begin; ... rollback;` scripts above: the SQL editor can run each statement in its own transaction and does not keep temporary objects between statements, so every rehearsal is a single `do` block that embeds the migration, creates its own test rows, simulates the roles (`set local role`, `request.jwt.claims`) and ends with a deliberate `raise exception` whose text is a `check | result | expected` report. They are kept outside the repository next to the earlier rehearsal sets. They cover the same cases as the earlier sections: the owner with a verified factor at `aal1` sees 0 rows and cannot insert (refused by `scheduled_session_mfa_if_enrolled`, not by a missing grant), at `aal2` works normally, a user without a factor works at `aal1`, `anon` is denied, and a slot referencing another owner's `plan_session_id` or `workout_id` fails with `23503`. One more check proves that deleting a plan session or a workout never deletes slots. Apply, then run `npm run verify:rls` (with the signed-in variables if you can) and the calendar items of check (b) above.

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
