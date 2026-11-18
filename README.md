# Gym Tracker

A small workout tracker for one person. You build your own training plans, log reps and weight set by set, and follow how the weights change over time. It is made for a phone in the gym, so the interface is mobile-first and in Italian. On a wide screen it shows a sidebar and every feature except logging and editing sets, which stay phone-only (the session view is read-only there).

It is a personal project, not a multi-user product.

## Features

- Pick a session of the active plan and log sets. Reps and weight are prefilled from the last workout of that exercise.
- Session view with ordered exercise cards (muscles, execution steps), a warm-up block, a checkbox per exercise and a progress bar.
- Plan editor: create, rename and archive plans, choose the active one, add and reorder sessions and exercises, mark a session as a bonus.
- Exercise library: your own exercises, reused across plans.
- History per exercise: a table and a chart of weight over the weeks, with the change from the first logged week.
- Progression hint when every set of the last workout was completed.
- Export of all data as CSV or JSON.

History survives plan edits: used plans and exercises are archived, not deleted, and each workout keeps the name of its session.

## Stack

- Vite, React and TypeScript, with a HashRouter because GitHub Pages has no SPA fallback.
- Supabase (Postgres and Auth) as the database, called straight from the browser with `@supabase/supabase-js`.
- Vitest for tests, `tsx` for the scripts in `scripts/`.

The front end is a static build served by GitHub Pages. There is no server of my own. The browser loads the files from Pages and then talks to Supabase directly.

Nothing in a static front end can be secret, so the model is a public client with protected data. The Supabase project URL and the anon key are in the published bundle on purpose. What keeps the data private is Row Level Security on every table (each row belongs to one owner) plus a login with password and TOTP. The `service_role` key is never used anywhere in this repo.

The schema, including the RLS policies, is in `supabase/migrations/`.

## Getting started

You need Node 22 and a Supabase project (the free tier is enough).

1. Clone the repo and install the dependencies.

   ```
   git clone <repo-url>
   cd gym-tracker
   npm ci
   ```

2. Copy `.env.example` to `.env` and fill in the project URL and the anon key from the Supabase dashboard (Project Settings, API). Use the anon or publishable key only. The build fails without the URL, because the CSP is generated from it.

3. Apply the migrations with the [Supabase CLI](https://supabase.com/docs/guides/cli).

   ```
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

4. In the dashboard, turn off sign-ups (Authentication settings) and create your user by hand. The first login asks you to enroll a TOTP authenticator.

5. Start the dev server. `--host` makes it reachable from your phone on the same network.

   ```
   npm run dev -- --host
   ```

There is no seed. The repo contains no plan data, so you create your plan in the app (or load it into the database yourself).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | unit and component tests (Vitest) |
| `npm run typecheck` | TypeScript check, no output |
| `npm run build` | typecheck, then production build into `dist/` |
| `npm run verify:rls` | with the anon key and no login, checks that every table refuses reads and writes and that sign-up is refused (needs `.env`) |
| `npm run check:secrets` | scans tracked files for private Supabase keys |
| `npm run check:secrets:dist` | the same scan on `dist/`, after a build |

`verify:rls` and `check:secrets` are described in [scripts/README.md](scripts/README.md), including what `verify:rls` does not cover.

## Security notes

- RLS is enabled on every table in the migration that creates it. Policies are for authenticated users only, check `auth.uid() = owner_id`, and require a TOTP-verified session (aal2). There are no policies for the `anon` role.
- Sign-ups are disabled. Otherwise anyone holding the public anon key could register and write into the project.
- The build injects a Content-Security-Policy whose `connect-src` is limited to the Supabase URL. There are no third-party scripts and no analytics.
- `check:secrets` fails the CI build if a private key shows up in tracked files or in the bundle.
- Keep a written procedure for a lost or stolen phone (end all sessions, change the password, re-enroll TOTP). Mine lives outside the repo.

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`: it audits the dependencies, scans for secrets, runs the typecheck and the tests, builds, scans `dist/`, and publishes it to GitHub Pages.

Setup on GitHub:

- Settings, Pages: set the source to GitHub Actions.
- Settings, Secrets and variables, Actions, Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. They are variables and not secrets because they end up in the bundle anyway.

Free GitHub Pages needs a public repository. For a private one you need a paid plan. The app is served under `/gym-tracker/` (`base` in `vite.config.ts`), so rename it there if the repo name differs.

## Personal data

The `private/` directory holds personal notes and reference files. It is in `.gitignore` and is never committed.

## License

[MIT](LICENSE).
