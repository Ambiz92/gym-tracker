# Scripts

## verify-rls.ts

Checks, with the public anon key and no login, that every table refuses `select`, `insert`, `update` and `delete`, and that the project refuses sign-ups. It exits with 1 if any check fails.

```
npx tsx --env-file=.env scripts/verify-rls.ts
```

It reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the environment and refuses to run with a `service_role` or secret key. It never prints the key. It sends one sign-up and one magic-link request to a throw-away `@example.invalid` address, so no real mailbox is contacted.

Writes must fail with `42501` (permission denied). An empty result is not accepted there, because the probes filter on a nil id and would match nothing even with an open policy.

Not covered, to test by hand with a logged-in session:

- an authenticated user sees and changes only their own rows;
- an aal1 session (no TOTP challenge) is refused by the restrictive aal2 policies;
- an aal2 session works normally.
