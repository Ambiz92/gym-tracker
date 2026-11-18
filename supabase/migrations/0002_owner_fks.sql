-- Gym Tracker: child rows must belong to the same owner as their parent (S1-03).
--
-- Foreign key checks ignore RLS, so with single-column keys any existing parent id
-- was accepted, even one owned by someone else. Each child key becomes
-- (parent_id, owner_id) -> parent (id, owner_id), so a cross-owner reference is
-- rejected by the database itself.
--
-- Constraint names and delete behaviour are unchanged, so PostgREST embeds keep
-- resolving without hints. workout.session_id is nulled alone: a plain SET NULL
-- on a composite key would also null owner_id (NOT NULL), hence the column list
-- (Postgres 15+; the project runs 17).
--
-- If existing rows already cross owners, adding a key fails and nothing is applied.

begin;

-- Targets of the composite keys (redundant with the primary key, but required).
alter table public.exercise     add constraint exercise_id_owner_id_key     unique (id, owner_id);
alter table public.plan         add constraint plan_id_owner_id_key         unique (id, owner_id);
alter table public.plan_session add constraint plan_session_id_owner_id_key unique (id, owner_id);
alter table public.workout      add constraint workout_id_owner_id_key      unique (id, owner_id);

alter table public.plan_session
  drop constraint plan_session_plan_id_fkey,
  add constraint plan_session_plan_id_fkey
    foreign key (plan_id, owner_id) references public.plan (id, owner_id) on delete cascade;

alter table public.plan_exercise
  drop constraint plan_exercise_session_id_fkey,
  drop constraint plan_exercise_exercise_id_fkey,
  add constraint plan_exercise_session_id_fkey
    foreign key (session_id, owner_id) references public.plan_session (id, owner_id) on delete cascade,
  add constraint plan_exercise_exercise_id_fkey
    foreign key (exercise_id, owner_id) references public.exercise (id, owner_id) on delete restrict;

alter table public.warmup_item
  drop constraint warmup_item_session_id_fkey,
  add constraint warmup_item_session_id_fkey
    foreign key (session_id, owner_id) references public.plan_session (id, owner_id) on delete cascade;

-- session_id is nullable: with the default MATCH SIMPLE a null column skips the check.
alter table public.workout
  drop constraint workout_session_id_fkey,
  add constraint workout_session_id_fkey
    foreign key (session_id, owner_id) references public.plan_session (id, owner_id)
    on delete set null (session_id);

alter table public.set_log
  drop constraint set_log_workout_id_fkey,
  drop constraint set_log_exercise_id_fkey,
  add constraint set_log_workout_id_fkey
    foreign key (workout_id, owner_id) references public.workout (id, owner_id) on delete cascade,
  add constraint set_log_exercise_id_fkey
    foreign key (exercise_id, owner_id) references public.exercise (id, owner_id) on delete restrict;

commit;
