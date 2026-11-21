-- Gym Tracker: session calendar, one row per planned session on a day.
--
-- scheduled_session is a planning layer on top of the plan: "session X on date D". It never
-- replaces or edits history. This migration only creates one table; plan, plan_session, workout
-- and set_log are not touched, and nothing here can delete or change a logged workout.
--
-- A slot is planned, done or skipped. When a workout is logged from a slot, the app links it
-- (workout_id) and marks the slot done; a workout without a slot stays valid. date is a plain
-- calendar day sent by the client (like workout.date), with no time and no time zone.
-- series_id groups the slots of a "repeat every week" batch; it has no table yet.
--
-- Same safety net as 0002: the keys to plan_session and workout are composite
-- (id, owner_id), so a slot can never point at another user's rows. Both are on delete set null
-- of the single column (Postgres 15+; the project runs 17), so a plain SET NULL would not also
-- null owner_id (NOT NULL). Deleting a plan session or a workout therefore never deletes a slot:
-- past slots keep their session_name snapshot, status and date. (id, owner_id) is unique as the
-- target of future composite keys. The unique key (owner_id, plan_session_id, date) refuses the
-- same session twice on one day; two different sessions on one day are fine, and slots whose
-- session was deleted (null) never collide.
--
-- RLS, privileges and the restrictive MFA policy follow 0001 and 0004: owner policies for
-- `authenticated` only, nothing for anon, and aal2 required only for a user with a verified factor.
-- No security definer function, no view.
--
-- One transaction: if any statement fails nothing is applied. Not meant to be run twice.
--
-- Rehearse it first (workspace/security/rehearsal-0006), then apply it and only after that
-- publish the front end that reads scheduled_session.
--
-- Rollback, in one transaction. It drops only the planning data (dates and statuses of slots);
-- plans, workouts and sets are untouched. Withdraw the front end first:
--
--   begin;
--   drop table public.scheduled_session;
--   commit;

begin;

-- Table ----------------------------------------------------------------------

create table public.scheduled_session (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id),
  plan_session_id uuid,
  session_name    text not null check (char_length(session_name) between 1 and 120),
  date            date not null,
  status          text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  workout_id      uuid,
  series_id       uuid,
  created_at      timestamptz not null default now(),
  constraint scheduled_session_id_owner_id_key unique (id, owner_id),
  constraint scheduled_session_one_per_session_per_day unique (owner_id, plan_session_id, date),
  constraint scheduled_session_plan_session_id_fkey
    foreign key (plan_session_id, owner_id) references public.plan_session (id, owner_id)
    on delete set null (plan_session_id),
  constraint scheduled_session_workout_id_fkey
    foreign key (workout_id, owner_id) references public.workout (id, owner_id)
    on delete set null (workout_id)
);

create index scheduled_session_owner_date_idx on public.scheduled_session (owner_id, date);
create index scheduled_session_plan_session_id_idx on public.scheduled_session (plan_session_id);
create index scheduled_session_workout_id_idx on public.scheduled_session (workout_id);

-- Privileges -----------------------------------------------------------------

revoke all on table public.scheduled_session from anon, authenticated, public;
grant select, insert, update, delete on table public.scheduled_session to authenticated;

-- Row Level Security ---------------------------------------------------------

alter table public.scheduled_session enable row level security;

create policy scheduled_session_select on public.scheduled_session for select to authenticated using (auth.uid() = owner_id);
create policy scheduled_session_insert on public.scheduled_session for insert to authenticated with check (auth.uid() = owner_id);
create policy scheduled_session_update on public.scheduled_session for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy scheduled_session_delete on public.scheduled_session for delete to authenticated using (auth.uid() = owner_id);

create policy scheduled_session_mfa_if_enrolled on public.scheduled_session as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

commit;
