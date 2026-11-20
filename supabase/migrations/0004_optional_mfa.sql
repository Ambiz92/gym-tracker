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
-- Access to auth.mfa_factors (not optional). The policies run as `authenticated`, and on
-- Supabase that role has no privilege on this table and the table has row level security on
-- with no policy. Without the two statements below every query on the app tables would fail
-- with "permission denied for table mfa_factors". A bare grant would be worse: row level
-- security would hide the rows, the count would be 0 for everybody, and the owner's
-- password-only (aal1) session would pass. So both are needed:
--  * grant select (user_id, status): only the two columns the policy reads. The TOTP secret
--    and the other columns stay unreadable, and count(*) needs no column of its own.
--  * policy mfa_factors_select_own: a user sees only their own factor rows, which is all the
--    policy asks about (where user_id = auth.uid()).
-- No security definer function is used.
--
-- Trade-offs:
--  * The rule reads the user's own factors, so a session is only as strong as the factor
--    list. Enrolling a factor makes the user bound to aal2 from then on; an unverified
--    (abandoned) factor does not count. If Francesco's verified factor were ever removed
--    (dashboard, admin API), his account would fall back to password-only and RLS would
--    accept aal1 for it. A password-only session must not be able to unenroll a verified
--    factor or to enroll a second one; Supabase is expected to require aal2 for both, but
--    test it on the real project (check (e) in scripts/README.md) instead of assuming it.
--  * If a future Supabase change made the factor rows invisible to `authenticated` again
--    without an error, the rule would fail OPEN to aal1 for everyone. Run check (c) in
--    scripts/README.md after applying this migration and after any Supabase upgrade.
--
-- One transaction, and the file can be run again: each table gets the new policy and loses
-- the old one.
--
-- Rehearse it first in the SQL editor inside begin; ... rollback; (scripts/README.md has the
-- probes), then apply it and check the app as the owner at aal2.
--
-- Prerequisite: `postgres` must be allowed to create a policy on auth.mfa_factors. Check that
-- `show supautils.policy_grants;` lists auth.mfa_factors; on older Postgres images this file
-- stops with 42501 (nothing is applied). Then upgrade the image, or get approval for the
-- security definer fallback described in scripts/README.md.
--
-- Rollback, in one transaction. The 0001 policies come back first, so the tables are never
-- left without a second-factor guard:
--
--   begin;
--   create policy exercise_aal2 on public.exercise as restrictive for all to authenticated
--     using (((select auth.jwt()) ->> 'aal') = 'aal2') with check (((select auth.jwt()) ->> 'aal') = 'aal2');
--   create policy plan_aal2 on public.plan as restrictive for all to authenticated
--     using (((select auth.jwt()) ->> 'aal') = 'aal2') with check (((select auth.jwt()) ->> 'aal') = 'aal2');
--   create policy plan_session_aal2 on public.plan_session as restrictive for all to authenticated
--     using (((select auth.jwt()) ->> 'aal') = 'aal2') with check (((select auth.jwt()) ->> 'aal') = 'aal2');
--   create policy plan_exercise_aal2 on public.plan_exercise as restrictive for all to authenticated
--     using (((select auth.jwt()) ->> 'aal') = 'aal2') with check (((select auth.jwt()) ->> 'aal') = 'aal2');
--   create policy warmup_item_aal2 on public.warmup_item as restrictive for all to authenticated
--     using (((select auth.jwt()) ->> 'aal') = 'aal2') with check (((select auth.jwt()) ->> 'aal') = 'aal2');
--   create policy workout_aal2 on public.workout as restrictive for all to authenticated
--     using (((select auth.jwt()) ->> 'aal') = 'aal2') with check (((select auth.jwt()) ->> 'aal') = 'aal2');
--   create policy set_log_aal2 on public.set_log as restrictive for all to authenticated
--     using (((select auth.jwt()) ->> 'aal') = 'aal2') with check (((select auth.jwt()) ->> 'aal') = 'aal2');
--   drop policy if exists exercise_mfa_if_enrolled on public.exercise;
--   drop policy if exists plan_mfa_if_enrolled on public.plan;
--   drop policy if exists plan_session_mfa_if_enrolled on public.plan_session;
--   drop policy if exists plan_exercise_mfa_if_enrolled on public.plan_exercise;
--   drop policy if exists warmup_item_mfa_if_enrolled on public.warmup_item;
--   drop policy if exists workout_mfa_if_enrolled on public.workout;
--   drop policy if exists set_log_mfa_if_enrolled on public.set_log;
--   drop policy if exists mfa_factors_select_own on auth.mfa_factors;
--   revoke select (user_id, status) on auth.mfa_factors from authenticated;
--   commit;
--
-- Rolling back also makes a user without a factor unable to use the app: it needs aal2.

begin;

grant select (user_id, status) on auth.mfa_factors to authenticated;

drop policy if exists mfa_factors_select_own on auth.mfa_factors;
create policy mfa_factors_select_own on auth.mfa_factors for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists exercise_mfa_if_enrolled on public.exercise;
create policy exercise_mfa_if_enrolled on public.exercise as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists exercise_aal2 on public.exercise;

drop policy if exists plan_mfa_if_enrolled on public.plan;
create policy plan_mfa_if_enrolled on public.plan as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists plan_aal2 on public.plan;

drop policy if exists plan_session_mfa_if_enrolled on public.plan_session;
create policy plan_session_mfa_if_enrolled on public.plan_session as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists plan_session_aal2 on public.plan_session;

drop policy if exists plan_exercise_mfa_if_enrolled on public.plan_exercise;
create policy plan_exercise_mfa_if_enrolled on public.plan_exercise as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists plan_exercise_aal2 on public.plan_exercise;

drop policy if exists warmup_item_mfa_if_enrolled on public.warmup_item;
create policy warmup_item_mfa_if_enrolled on public.warmup_item as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists warmup_item_aal2 on public.warmup_item;

drop policy if exists workout_mfa_if_enrolled on public.workout;
create policy workout_mfa_if_enrolled on public.workout as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists workout_aal2 on public.workout;

drop policy if exists set_log_mfa_if_enrolled on public.set_log;
create policy set_log_mfa_if_enrolled on public.set_log as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );
drop policy if exists set_log_aal2 on public.set_log;

commit;
