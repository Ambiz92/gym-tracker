# Scripts

## verify-rls.ts

Checks, with the public anon key and no login, that every table refuses `select`, `insert`, `update` and `delete`, and that the project refuses sign-ups. It exits with 1 if any check fails.

```
npm run verify:rls
```

The npm script loads `.env`. The script also compares its table list with the `create table public.<name>` statements in `supabase/migrations/` and fails if a table has no probe row, so a new migration cannot slip past it. It takes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment and refuses to run with a `service_role` or secret key. It never prints the key. It sends one sign-up and one magic-link request to a throw-away `@example.invalid` address, so no real mailbox is contacted.

Writes must fail with `42501` (permission denied). An empty result is not accepted there, because the probes filter on a nil id and would match nothing even with an open policy.

Not covered, to test by hand with a logged-in session:

- an authenticated user sees and changes only their own rows;
- an aal1 session (no TOTP challenge) is refused by the restrictive aal2 policies;
- an aal2 session works normally.

## check-secrets.ts

Fails when a private Supabase credential appears where only public values belong: an `sb_secret_` key, a `service_role` JWT, a `SERVICE_ROLE_KEY=...` assignment, or any JWT other than the value of `VITE_SUPABASE_ANON_KEY`. It also scans every `VITE_*` environment variable, because those end up in the bundle.

```
npm run check:secrets        # files tracked by git
npm run check:secrets:dist   # the built bundle (run after npm run build)
```

Findings print as `file:line  kind  first 8 characters`, never the whole value. The CI workflow runs both. The new `sb_publishable_` key format is public and is never flagged.
