-- Gym Tracker: coaches no longer need a second factor (aal2) to read their athletes or accept a request.
--
-- Decision of Francesco, 2026-11-23, on the accepted risk S-A3-01 (workspace/security/REGISTER.md): a coach with an
-- ACTIVE link reads the athlete's rows, and accepts a pending request, with a normal password or Google session (aal1).
-- Everything else of 0007 and 0008 stays as it is.
--
-- What changes: the eight `<table>_select_coach` policies of 0008 are recreated without the
-- `(select auth.jwt() ->> 'aal') = 'aal2'` term, and `coach_athlete_update_coach` of 0007 is recreated without
-- that term in the accept branch of its `with check`. The owner of the data is still matched through the
-- coach's ACTIVE links, in the same `in (select ... (select auth.uid()) ...)` shape, so the planner still builds one
-- hashed subplan per statement.
--
-- What does not change:
--  * Read-only, active link only: no write policy for coaches, no `pending` or `revoked` read, a revoke ends the
--    reads on the coach's next statement. Link rows are still updated only in `status`, by the column grants, the
--    policies and the transition trigger. private.coach_athlete_guard() (0007) has no aal logic and is left as it is
--    (security invoker, empty search_path, schema not exposed by the API).
--  * The restrictive `*_mfa_if_enrolled` policies. They read the factors of the CALLER, so an account that has
--    enrolled a factor, a coach included, still needs aal2 for every read and write, its own rows and the
--    athletes' alike. A coach without a factor passes them at aal1.
--  * The kill switch: dropping the eight `*_select_coach` policies ends every coach read at once (KILLSWITCH-0008).
--
-- Consequence, accepted as S-A3-01: a coach reads the athletes' data without a second factor, so a stolen or unattended
-- coach session at aal1 exposes every athlete the coach has an active link with, whatever the athlete's own factor.
--
-- No data changes. One transaction: if any statement fails nothing is applied. Not meant to be run twice.
--
-- Rehearse it first (workspace/security/rehearsal-0009). It needs 0007 and 0008 applied.
--
-- Rollback: workspace/security/rehearsal-0009/ROLLBACK-0009.sql restores the aal2 versions of 0008 and 0007 and
-- proves that a coach at aal1 reads nothing again. The kill switch needs no rollback of 0009.

begin;

-- Coach read policies, without aal2 --------------------------------------------
drop policy exercise_select_coach on public.exercise;
create policy exercise_select_coach on public.exercise for select to authenticated
  using (
    owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

drop policy plan_select_coach on public.plan;
create policy plan_select_coach on public.plan for select to authenticated
  using (
    owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

drop policy plan_session_select_coach on public.plan_session;
create policy plan_session_select_coach on public.plan_session for select to authenticated
  using (
    owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

drop policy plan_exercise_select_coach on public.plan_exercise;
create policy plan_exercise_select_coach on public.plan_exercise for select to authenticated
  using (
    owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

drop policy warmup_item_select_coach on public.warmup_item;
create policy warmup_item_select_coach on public.warmup_item for select to authenticated
  using (
    owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

drop policy workout_select_coach on public.workout;
create policy workout_select_coach on public.workout for select to authenticated
  using (
    owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

drop policy set_log_select_coach on public.set_log;
create policy set_log_select_coach on public.set_log for select to authenticated
  using (
    owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

drop policy scheduled_session_select_coach on public.scheduled_session;
create policy scheduled_session_select_coach on public.scheduled_session for select to authenticated
  using (
    owner_id in (
      select ca.athlete_id from public.coach_athlete ca
      where ca.coach_id = (select auth.uid()) and ca.status = 'active'
    )
  );

-- Accept a request, without aal2 -------------------------------------------------

drop policy coach_athlete_update_coach on public.coach_athlete;
create policy coach_athlete_update_coach on public.coach_athlete for update to authenticated
  using (coach_id = (select auth.uid()) and status in ('pending', 'active'))
  with check (coach_id = (select auth.uid()) and status in ('active', 'revoked'));

commit;
