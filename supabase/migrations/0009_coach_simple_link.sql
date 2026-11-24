-- Gym Tracker: simple coach link. The athlete creates the link already active, the coach does nothing,
-- and coaches no longer need a second factor (aal2) to read.
--
-- Decision of Francesco, 2026-11-23 (accepted risk S-A3-01, workspace/security/REGISTER.md): the coach
-- shares his code (his user id) out of band, the athlete pastes it, reads the consent text and confirms.
-- The athlete is the only party who consents; there is no request to accept and no TOTP step for coaches.
-- A coach with an ACTIVE link reads the athlete's rows with a normal password or Google session (aal1),
-- read-only as before. Either party may revoke; `revoked` stays terminal for a pair.
--
-- Two parts, one transaction.
--
-- (a) Coach reads without aal2. The eight `<table>_select_coach` policies of 0008 are recreated without the
--     `(select auth.jwt() ->> 'aal') = 'aal2'` term, in the same `in (select ... (select auth.uid()) ...)` shape,
--     so the planner still builds one hashed subplan per statement.
--
-- (b) Link model of 0007:
--  * Insert: the athlete inserts the row with status 'active' and nothing else. The column grants are
--    unchanged (clients insert only coach_id and athlete_label), so status and accepted_at come from the new
--    column defaults ('active', now()) and athlete_id from auth.uid(); the policy still demands both.
--    coach_id <> athlete_id and the label rules stay table constraints. The two unique indexes (one open link
--    per athlete, one row per pair) are untouched.
--  * Update: the coach has no accept path. Both update policies let a party move an open (pending or active)
--    link to 'revoked' and nothing else, and look at the OLD status in USING so a revoked link stays revoked.
--  * Trigger: private.coach_athlete_guard() (create or replace, still security invoker, empty search_path,
--    schema not exposed by the API) allows only `pending or active -> revoked` by one of the two parties,
--    stamps revoked_at and revoked_by, refuses same-status updates and any column other than status.
--
-- What does not change: no write policy for coaches on the eight tables; the restrictive `*_mfa_if_enrolled`
-- policies (they read the factors of the CALLER, so an account that enrolled a factor, a coach included, still
-- needs aal2 for every read and write); the kill switch (dropping the eight `*_select_coach` policies ends every
-- coach read at once, KILLSWITCH-0008). A 'pending' status stays legal in the check constraint, but nothing
-- creates it any more: the athlete cannot insert it and nobody can move a link to it.
--
-- Consequence, accepted as S-A3-01: a stolen or unattended coach session at aal1 exposes every athlete the coach
-- has an active link with, whatever the athlete's own factor. Also (S-A4-01, S-A4-02): an athlete can attach any
-- account as "coach" without that account doing anything, which exposes only the athlete's own data; a coach is
-- linked without consent, and a flood of fake athletes is limited to labels while sign-ups are closed.
--
-- No data changes: coach_athlete is empty live (the rehearsal APPLICA asserts it). A row left in 'pending' by an
-- earlier state would have no accept path, only a revoke. One transaction: if any statement fails nothing is
-- applied. Not meant to be run twice.
--
-- Rehearse it first (workspace/security/rehearsal-0009). It needs 0007 and 0008 applied.
--
-- Rollback: workspace/security/rehearsal-0009/ROLLBACK-0009.sql restores the 0008 and 0007 versions (aal2 in the
-- read policies, pending insert, coach accept at aal2, the old trigger and defaults) and proves the old behaviour.
-- Link rows created in the meantime stay as they are. The kill switch needs no rollback of 0009.

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

-- Link: insert, active at once ---------------------------------------------------

alter table public.coach_athlete
  alter column status set default 'active',
  alter column accepted_at set default now();

drop policy coach_athlete_insert on public.coach_athlete;
create policy coach_athlete_insert on public.coach_athlete for insert to authenticated
  with check (athlete_id = (select auth.uid()) and status = 'active');

-- Link: the coach only revokes ---------------------------------------------------

drop policy coach_athlete_update_coach on public.coach_athlete;
create policy coach_athlete_update_coach on public.coach_athlete for update to authenticated
  using (coach_id = (select auth.uid()) and status in ('pending', 'active'))
  with check (coach_id = (select auth.uid()) and status = 'revoked');

-- Link: transition guard ---------------------------------------------------------

create or replace function private.coach_athlete_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if new.id is distinct from old.id
     or new.coach_id is distinct from old.coach_id
     or new.athlete_id is distinct from old.athlete_id
     or new.created_at is distinct from old.created_at
     or new.athlete_label is distinct from old.athlete_label
     or new.consent_version is distinct from old.consent_version then
    raise exception 'coach_athlete: only status can change' using errcode = '42501';
  end if;

  new.accepted_at := old.accepted_at;
  new.revoked_at := old.revoked_at;
  new.revoked_by := old.revoked_by;

  if old.status in ('pending', 'active') and new.status = 'revoked' and caller in (old.coach_id, old.athlete_id) then
    new.revoked_at := now();
    new.revoked_by := caller;
  else
    raise exception 'coach_athlete: transition % to % not allowed', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

commit;
