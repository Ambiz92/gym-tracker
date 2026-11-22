-- Gym Tracker: coach read policies. An active coach reads the athlete's rows, and only reads.
--
-- One new permissive SELECT policy on each of the eight tables that hold an athlete's training
-- data: exercise, plan, plan_session, plan_exercise, warmup_item, workout, set_log and
-- scheduled_session. A row is readable by a coach when its owner is the athlete of one of the
-- coach's ACTIVE links in coach_athlete (0007). Requirements: workspace/security/S-A1.md (R8-1 to R8-4).
--
-- aal2 inside the policy (S-A1-03). The restrictive *_mfa_if_enrolled policies read the factors of the
-- CALLER, so a coach without a second factor would pass them at aal1 and read the data of an athlete who
-- enrolled one. The coach therefore needs aal2 in every coach policy. It cannot be a restrictive policy:
-- that would bind the owner's own reads too.
--
-- Read-only: no insert, update, delete or `for all` policy for coaches, so nothing is ever written across
-- accounts. The owner policies and the restrictive policies are untouched, exercise_catalog and
-- coach_athlete get nothing, and there is no view and no helper function (a security definer helper would
-- skip the RLS of coach_athlete, including its MFA policy). The only condition on the link is
-- status = 'active': a revoked or pending link reads nothing, and a revoke takes effect on the coach's next
-- statement. The policies are written out one table at a time on purpose; later tables get their coach
-- policy in their own migration.
--
-- The subquery runs as the caller, under the RLS of coach_athlete, and is planned as one hashed
-- subplan per statement (checked with explain in the rehearsal). Two indexes keep the reads on the
-- biggest tables bounded; every read already filters on owner_id (src/data/client.ts own()).
--
-- This migration is also the kill switch: dropping the eight *_select_coach policies ends every coach
-- read at once, whatever the link rows say (rollback below, kept as a tested script).
--
-- One transaction: if any statement fails nothing is applied. Not meant to be run twice.
--
-- Rehearse it first (workspace/security/rehearsal-0008). It needs 0007 applied.
--
-- Rollback, in one transaction. The first eight statements are the kill switch; the indexes are harmless
-- and can stay:
--
--   begin;
--   drop policy exercise_select_coach on public.exercise;
--   drop policy plan_select_coach on public.plan;
--   drop policy plan_session_select_coach on public.plan_session;
--   drop policy plan_exercise_select_coach on public.plan_exercise;
--   drop policy warmup_item_select_coach on public.warmup_item;
--   drop policy workout_select_coach on public.workout;
--   drop policy set_log_select_coach on public.set_log;
--   drop policy scheduled_session_select_coach on public.scheduled_session;
--   drop index public.set_log_owner_id_idx;
--   drop index public.workout_owner_date_idx;
--   commit;

begin;

-- Indexes --------------------------------------------------------------------

create index set_log_owner_id_idx on public.set_log (owner_id);
create index workout_owner_date_idx on public.workout (owner_id, date);

-- Coach read policies --------------------------------------------------------

create policy exercise_select_coach on public.exercise for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

create policy plan_select_coach on public.plan for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

create policy plan_session_select_coach on public.plan_session for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

create policy plan_exercise_select_coach on public.plan_exercise for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

create policy warmup_item_select_coach on public.warmup_item for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

create policy workout_select_coach on public.workout for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

create policy set_log_select_coach on public.set_log for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

create policy scheduled_session_select_coach on public.scheduled_session for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

commit;
