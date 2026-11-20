-- Gym Tracker: shared exercise catalog, copied on use.
--
-- exercise_catalog holds standard exercises that every signed-in user can read. Picking one in
-- the app inserts a normal exercise row owned by that user (name, equipment, muscles and steps
-- copied), so plan_exercise, set_log, the composite keys of 0002 and the per-user owner policies
-- are untouched, and per-user data (starting weight, notes, archived) stays on the copy.
-- exercise.catalog_id remembers where a copy came from; custom exercises keep it null.
--
-- The catalog is the one table without owner_id: it is reference data, not user data. Its select
-- policy therefore cannot check an owner. It checks that the caller is signed in, so it is not a
-- using (true) policy and anon sees nothing (anon has no grant either). Client roles get select
-- ONLY: there is no insert, update or delete grant and no write policy, so the catalog changes
-- only through migrations and the seed, run as postgres. The restrictive policy is the one of
-- 0004: a user with a verified factor needs aal2, a user with none may use aal1.
--
-- This migration is schema only. Filling the catalog and linking existing exercises to it
-- (matching by normalised name, reporting duplicates instead of merging them) is a separate,
-- re-runnable seed step, so this file stays free of data and can be rolled back cleanly.
--
-- catalog_id is on delete set null: removing a catalog entry must not block catalog upkeep nor
-- touch users' copies, which are self-contained. The unique index lets a user adopt an entry
-- only once (an archived copy is restored, not copied again); custom rows (null) are not limited.
--
-- One transaction: if any statement fails nothing is applied. Not meant to be run twice.
--
-- Rehearse it first in the SQL editor inside begin; ... rollback; (scripts/README.md has the
-- catalog probes), then apply it and check the app as the owner at aal2.
--
-- Rollback, in one transaction. Dropping the column also drops its index and the links; the
-- copies keep all their own data. Dropping the table drops its policies. The catalog content is
-- recreated by running the seed again:
--
--   begin;
--   alter table public.exercise drop column catalog_id;
--   drop table public.exercise_catalog;
--   commit;

begin;

-- Table ----------------------------------------------------------------------

create table public.exercise_catalog (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name_it           text not null check (char_length(name_it) between 1 and 120),
  name_en           text check (char_length(name_en) between 1 and 120),
  synonyms          text[] not null default '{}' check (cardinality(synonyms) <= 20 and array_position(synonyms, null) is null),
  equipment         text not null check (equipment in ('barbell', 'dumbbell', 'other')),
  primary_muscle    text not null check (char_length(primary_muscle) between 1 and 120),
  secondary_muscles text[] not null default '{}' check (cardinality(secondary_muscles) <= 10 and array_position(secondary_muscles, null) is null),
  execution_steps   text check (char_length(execution_steps) <= 2000),
  source            text check (char_length(source) <= 120),
  source_id         text check (char_length(source_id) <= 120)
);

-- Link from a copy to its catalog entry ---------------------------------------

alter table public.exercise
  add column catalog_id uuid references public.exercise_catalog (id) on delete set null;

create unique index exercise_one_per_catalog_entry_per_owner
  on public.exercise (owner_id, catalog_id) where catalog_id is not null;

-- Privileges -----------------------------------------------------------------

revoke all on table public.exercise_catalog from anon, authenticated, public;
grant select on table public.exercise_catalog to authenticated;

-- Row Level Security ---------------------------------------------------------

alter table public.exercise_catalog enable row level security;

create policy exercise_catalog_select on public.exercise_catalog for select to authenticated
  using ((select auth.uid()) is not null);

create policy exercise_catalog_mfa_if_enrolled on public.exercise_catalog as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(*) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where (select auth.uid()) = user_id and status = 'verified'
    )
  );

commit;
