-- Gym Tracker: the second factor is optional, but binding once it exists.
--
-- Until now every table had a restrictive policy (<table>_aal2) that refused any session
-- below aal2. Friends who sign in with Google have no authenticator app, so the rule becomes
-- the opt-in pattern from the Supabase MFA docs: a user with at least one VERIFIED factor
-- in auth.mfa_factors needs aal2; a user with none may use aal1 or aal2.
--
-- Only the restrictive policies change. The owner checks (auth.uid() = owner_id), the
-- missing anon policies and row level security itself are untouched, so a user still sees
-- and changes only their own rows whatever the assurance level. For a restrictive FOR ALL
-- policy a missing WITH CHECK reuses USING, so writes follow the same rule as reads.
--
-- Trade-offs:
--  * The rule reads the user's own factors, so a session is only as strong as the factor
--    list. Enrolling a factor makes the user bound to aal2 from then on; an unverified
--    (abandoned) factor does not count. If Francesco's verified factor were ever removed
--    (dashboard, admin API), his account would fall back to password-only and RLS would
--    accept aal1 for it. A password-only session must not be able to unenroll a verified
--    factor or to enroll a second one; Supabase is expected to require aal2 for both, but
--    test it on the real project (check (e) in scripts/README.md) instead of assuming it.
--  * If the subquery ever returned no rows for an enrolled user (a grant or RLS change on
--    auth.mfa_factors), the rule would fail OPEN to aal1 for everyone. Run check (c) in
--    scripts/README.md after applying this migration and after any Supabase upgrade.
--  * No security definer function is added: the policy runs as the caller.
--
-- One transaction, and the file can be run again: each table gets the new policy and loses
-- the old one.
--
-- Manual verification after applying (details in scripts/README.md):
--  1. select policyname from pg_policies where policyname like '%\_mfa\_if\_enrolled' -> 7 rows,
--     and none ending in _aal2.
--  2. Owner with a password only (aal1) and a verified factor: every table is refused.
--  3. A user with no factor, signed in with Google (aal1): sees and edits only own rows.
--  4. Recovery if the app is unreachable: drop the *_mfa_if_enrolled policies in the SQL
--     editor (this also removes the second-factor guard, so restore them afterwards).

begin;

drop policy if exists exercise_mfa_if_enrolled on public.exercise;
create policy exercise_mfa_if_enrolled on public.exercise as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists exercise_aal2 on public.exercise;

drop policy if exists plan_mfa_if_enrolled on public.plan;
create policy plan_mfa_if_enrolled on public.plan as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists plan_aal2 on public.plan;

drop policy if exists plan_session_mfa_if_enrolled on public.plan_session;
create policy plan_session_mfa_if_enrolled on public.plan_session as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists plan_session_aal2 on public.plan_session;

drop policy if exists plan_exercise_mfa_if_enrolled on public.plan_exercise;
create policy plan_exercise_mfa_if_enrolled on public.plan_exercise as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists plan_exercise_aal2 on public.plan_exercise;

drop policy if exists warmup_item_mfa_if_enrolled on public.warmup_item;
create policy warmup_item_mfa_if_enrolled on public.warmup_item as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists warmup_item_aal2 on public.warmup_item;

drop policy if exists workout_mfa_if_enrolled on public.workout;
create policy workout_mfa_if_enrolled on public.workout as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists workout_aal2 on public.workout;

drop policy if exists set_log_mfa_if_enrolled on public.set_log;
create policy set_log_mfa_if_enrolled on public.set_log as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists set_log_aal2 on public.set_log;

commit;
