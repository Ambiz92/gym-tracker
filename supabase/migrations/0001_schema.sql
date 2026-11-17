-- Gym Tracker: initial schema.
--
-- Single-user app on a public static front end: the anon key is public, so every
-- table is protected by Row Level Security. Each row carries owner_id (default
-- auth.uid()) and policies grant access to the `authenticated` role only, when
-- auth.uid() = owner_id. The `anon` and `public` roles get no privileges at all.
--
-- History is never rewritten by plan edits: logged exercises are archived, not
-- deleted (set_log -> exercise is RESTRICT), and workout keeps a session_name
-- snapshot, so deleting a plan session only nulls workout.session_id.
--
-- Position columns are unique per parent but deferrable, so a reorder can swap
-- positions inside one transaction. No seed data: plans are loaded by hand.

begin;

-- Tables -------------------------------------------------------------------

create table public.exercise (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users (id),
  name               text not null check (char_length(name) between 1 and 120),
  equipment          text not null check (equipment in ('barbell', 'dumbbell', 'other')),
  muscles            text check (char_length(muscles) <= 500),
  execution_steps    text check (char_length(execution_steps) <= 2000),
  notes              text check (char_length(notes) <= 2000),
  starting_weight_kg numeric(6, 2) check (starting_weight_kg >= 0),
  archived           boolean not null default false
);

create table public.plan (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id),
  name       text not null check (char_length(name) between 1 and 120),
  is_active  boolean not null default false,
  archived   boolean not null default false,
  check (not (is_active and archived))
);

-- One active plan per owner. Switching needs two updates: deactivate, then activate.
create unique index plan_one_active_per_owner on public.plan (owner_id) where is_active;

create table public.plan_session (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id),
  plan_id     uuid not null references public.plan (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  subtitle    text check (char_length(subtitle) <= 120),
  position    integer not null check (position >= 0),
  is_optional boolean not null default false,
  unique (plan_id, position) deferrable initially deferred
);

create table public.plan_exercise (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null default auth.uid() references auth.users (id),
  session_id              uuid not null references public.plan_session (id) on delete cascade,
  exercise_id             uuid not null references public.exercise (id) on delete restrict,
  position                integer not null check (position >= 0),
  target_sets             integer not null check (target_sets > 0),
  target_reps             integer not null check (target_reps > 0),
  target_unit             text not null default 'reps' check (target_unit in ('reps', 'seconds', 'meters')),
  suggested_weight_kg     numeric(6, 2) check (suggested_weight_kg >= 0),
  suggested_weight_max_kg numeric(6, 2) check (suggested_weight_max_kg >= suggested_weight_kg),
  unique (session_id, position) deferrable initially deferred
);

create index plan_exercise_exercise_id_idx on public.plan_exercise (exercise_id);

create table public.warmup_item (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id),
  session_id uuid not null references public.plan_session (id) on delete cascade,
  position   integer not null check (position >= 0),
  name       text not null check (char_length(name) between 1 and 120),
  reps_text  text check (char_length(reps_text) <= 120),
  note       text check (char_length(note) <= 2000),
  unique (session_id, position) deferrable initially deferred
);

create table public.workout (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id),
  date         date not null default current_date,
  session_id   uuid references public.plan_session (id) on delete set null,
  session_name text not null check (char_length(session_name) between 1 and 120),
  notes        text check (char_length(notes) <= 2000)
);

create index workout_session_id_idx on public.workout (session_id);
create index workout_date_idx on public.workout (date);

create table public.set_log (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id),
  workout_id     uuid not null references public.workout (id) on delete cascade,
  exercise_id    uuid not null references public.exercise (id) on delete restrict,
  set_number     integer not null check (set_number > 0),
  reps           integer not null check (reps > 0),
  weight_kg      numeric(6, 2) not null check (weight_kg >= 0),
  equipment_used text not null check (equipment_used in ('barbell', 'dumbbell', 'other')),
  rpe            numeric(3, 1) check (rpe between 1 and 10),
  unique (workout_id, exercise_id, set_number)
);

create index set_log_exercise_id_idx on public.set_log (exercise_id);

-- Privileges ---------------------------------------------------------------

revoke all on table
  public.exercise, public.plan, public.plan_session, public.plan_exercise,
  public.warmup_item, public.workout, public.set_log
from anon, authenticated, public;

grant select, insert, update, delete on table
  public.exercise, public.plan, public.plan_session, public.plan_exercise,
  public.warmup_item, public.workout, public.set_log
to authenticated;

-- Row Level Security -------------------------------------------------------

alter table public.exercise      enable row level security;
alter table public.plan          enable row level security;
alter table public.plan_session  enable row level security;
alter table public.plan_exercise enable row level security;
alter table public.warmup_item   enable row level security;
alter table public.workout       enable row level security;
alter table public.set_log       enable row level security;

create policy exercise_select on public.exercise for select to authenticated using (auth.uid() = owner_id);
create policy exercise_insert on public.exercise for insert to authenticated with check (auth.uid() = owner_id);
create policy exercise_update on public.exercise for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy exercise_delete on public.exercise for delete to authenticated using (auth.uid() = owner_id);

create policy plan_select on public.plan for select to authenticated using (auth.uid() = owner_id);
create policy plan_insert on public.plan for insert to authenticated with check (auth.uid() = owner_id);
create policy plan_update on public.plan for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy plan_delete on public.plan for delete to authenticated using (auth.uid() = owner_id);

create policy plan_session_select on public.plan_session for select to authenticated using (auth.uid() = owner_id);
create policy plan_session_insert on public.plan_session for insert to authenticated with check (auth.uid() = owner_id);
create policy plan_session_update on public.plan_session for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy plan_session_delete on public.plan_session for delete to authenticated using (auth.uid() = owner_id);

create policy plan_exercise_select on public.plan_exercise for select to authenticated using (auth.uid() = owner_id);
create policy plan_exercise_insert on public.plan_exercise for insert to authenticated with check (auth.uid() = owner_id);
create policy plan_exercise_update on public.plan_exercise for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy plan_exercise_delete on public.plan_exercise for delete to authenticated using (auth.uid() = owner_id);

create policy warmup_item_select on public.warmup_item for select to authenticated using (auth.uid() = owner_id);
create policy warmup_item_insert on public.warmup_item for insert to authenticated with check (auth.uid() = owner_id);
create policy warmup_item_update on public.warmup_item for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy warmup_item_delete on public.warmup_item for delete to authenticated using (auth.uid() = owner_id);

create policy workout_select on public.workout for select to authenticated using (auth.uid() = owner_id);
create policy workout_insert on public.workout for insert to authenticated with check (auth.uid() = owner_id);
create policy workout_update on public.workout for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy workout_delete on public.workout for delete to authenticated using (auth.uid() = owner_id);

create policy set_log_select on public.set_log for select to authenticated using (auth.uid() = owner_id);
create policy set_log_insert on public.set_log for insert to authenticated with check (auth.uid() = owner_id);
create policy set_log_update on public.set_log for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy set_log_delete on public.set_log for delete to authenticated using (auth.uid() = owner_id);

commit;
