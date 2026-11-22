-- Gym Tracker: coach/athlete links (the table only; the coach read policies are 0008).
--
-- coach_athlete is the one row that two accounts write: the athlete inserts it as 'pending' with
-- the coach's id (the athlete's act is the consent), the coach accepts it, and either of them may
-- revoke it. Design: workspace/design/allenatore-atleta.md. Threat model and the requirements
-- this file follows: workspace/security/S-A1.md (R7-1 to R7-7).
--
-- Every control below has its own job, and the table is only safe with all of them:
--  * Column grants. Clients may insert only (coach_id, athlete_label) and update only (status).
--    Grants cannot tell a coach from an athlete, but they stop either party from rewriting
--    coach_id or athlete_id into a forged active link (S-A1-01), and from touching the labels
--    and the consent timestamps (S-A1-07). There is no delete and no truncate for clients:
--    the row is the record of the consent.
--  * Policies. They decide WHO may set which status: the athlete inserts only a pending row
--    for themselves and may only revoke; the coach may accept (aal2 inside the policy) or
--    revoke. Both update policies look at the OLD status in USING, so a revoked link stays
--    revoked (S-A1-02). RLS cannot compare old and new values, which is why the trigger exists.
--  * Trigger. private.coach_athlete_guard() checks the transition (pending to active by the
--    coach, pending or active to revoked by a participant), refuses any change to the identity
--    columns and sets accepted_at, revoked_at and revoked_by. It is `security invoker` with an
--    empty search_path, in a schema the Data API does not expose, and nobody but its owner can
--    execute it directly: a trigger needs no EXECUTE privilege to fire. It is not a
--    security definer function, so the policies still apply to everything it reads (it reads
--    nothing).
--  * Constraints. (coach_id, athlete_id) is unique, so 'revoked' is terminal for a pair and
--    re-linking is done by the administrator in SQL. A partial unique index allows one open
--    (pending or active) link per athlete: one coach each. unique (id, coach_id, athlete_id)
--    lets later tables point at the link with a composite key.
--
-- No policy of this table may query coach_athlete: with the restrictive MFA policy in place
-- that fails with 42P17 (infinite recursion), and caps or rate limits belong in the trigger.
-- No delete policy, no anon policy, no change to auth.mfa_factors, and the table stays out of the
-- supabase_realtime publication. The link rows of both parties stay readable after a revoke
-- (hiding them from the coach would make the coach's own revoke fail with 42501).
--
-- This migration changes no existing table: nothing is readable across accounts until 0008.
--
-- One transaction: if any statement fails nothing is applied. Not meant to be run twice.
--
-- Rehearse it first (workspace/security/rehearsal-0007), then apply it. Roll back 0008 before
-- this one: the coach policies of 0008 depend on this table.
--
-- Rollback, in one transaction, after 0008 has been rolled back. It drops the links (who coaches
-- whom and the consent record) and the trigger function; withdraw the front end first:
--
--   begin;
--   drop table public.coach_athlete;
--   drop function private.coach_athlete_guard();
--   drop schema private;
--   commit;

begin;

-- Table ----------------------------------------------------------------------

create table public.coach_athlete (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null references auth.users (id),
  athlete_id      uuid not null default auth.uid() references auth.users (id),
  status          text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  -- Plain visible text only: no control, bidi, zero-width or line-separator characters, so a
  -- label cannot imitate another name in the coach's screens (S-A1-14).
  athlete_label   text check (
    char_length(athlete_label) between 1 and 60
    and athlete_label ~ '\S'
    and athlete_label !~ '[\u0001-\u001f\u007f-\u009f؜​-‏ -‮⁠⁦-⁩﻿]'
  ),
  consent_version text not null default 'consent-v1' check (char_length(consent_version) between 1 and 40),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  revoked_by      uuid,
  constraint coach_athlete_not_self check (coach_id <> athlete_id),
  constraint coach_athlete_status_consistent check (
    (status = 'pending' and accepted_at is null and revoked_at is null and revoked_by is null)
    or (status = 'active' and accepted_at is not null and revoked_at is null and revoked_by is null)
    or (status = 'revoked' and revoked_at is not null and revoked_by is not null and revoked_by in (coach_id, athlete_id))
  ),
  constraint coach_athlete_pair_key unique (coach_id, athlete_id),
  constraint coach_athlete_id_pair_key unique (id, coach_id, athlete_id)
);

create unique index coach_athlete_one_open_link_per_athlete
  on public.coach_athlete (athlete_id) where status in ('pending', 'active');
create index coach_athlete_active_idx
  on public.coach_athlete (coach_id, athlete_id) where status = 'active';

-- Transition guard -------------------------------------------------------------

create schema private;
revoke all on schema private from public, anon, authenticated;

create function private.coach_athlete_guard() returns trigger
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

  if old.status = 'pending' and new.status = 'active' and caller = old.coach_id then
    new.accepted_at := now();
  elsif old.status in ('pending', 'active') and new.status = 'revoked' and caller in (old.coach_id, old.athlete_id) then
    new.revoked_at := now();
    new.revoked_by := caller;
  else
    raise exception 'coach_athlete: transition % to % not allowed', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.coach_athlete_guard() from public, anon, authenticated;

create trigger coach_athlete_guard before update on public.coach_athlete
  for each row execute function private.coach_athlete_guard();

-- Privileges -----------------------------------------------------------------

revoke all on table public.coach_athlete from anon, authenticated, public;
grant select on table public.coach_athlete to authenticated;
grant insert (coach_id, athlete_label) on table public.coach_athlete to authenticated;
grant update (status) on table public.coach_athlete to authenticated;

-- Row Level Security ---------------------------------------------------------

alter table public.coach_athlete enable row level security;

create policy coach_athlete_select on public.coach_athlete for select to authenticated
  using ((select auth.uid()) in (coach_id, athlete_id));

create policy coach_athlete_insert on public.coach_athlete for insert to authenticated
  with check (athlete_id = (select auth.uid()) and status = 'pending');

create policy coach_athlete_update_coach on public.coach_athlete for update to authenticated
  using (coach_id = (select auth.uid()) and status in ('pending', 'active'))
  with check (coach_id = (select auth.uid())
              and (status = 'revoked' or (status = 'active' and (select auth.jwt() ->> 'aal') = 'aal2')));

create policy coach_athlete_update_athlete on public.coach_athlete for update to authenticated
  using (athlete_id = (select auth.uid()) and status in ('pending', 'active'))
  with check (athlete_id = (select auth.uid()) and status = 'revoked');

create policy coach_athlete_mfa_if_enrolled on public.coach_athlete as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

commit;
