-- Gym Tracker: convert legacy barbell defaults from "total of both sides" to "load of one side".
--
-- Until commit e4cc63b (2026-11-20) a barbell weight was stored as the TOTAL of both sides (2 x per side, bar
-- excluded). Since then it is the load of ONE side, as loaded in the gym. The defaults saved before the switch
-- were never converted, so prefill, progression and delta compared mixed units (a calf raise showed -50%).
--
-- This halves, only for exercises with equipment = 'barbell':
--  * plan_exercise.suggested_weight_kg and suggested_weight_max_kg;
--  * exercise.starting_weight_kg.
-- Logged sets (set_log) are NOT touched: the workouts that exist were all logged per side.
-- They carry no date, so the defaults are halved unconditionally, once. Exercises in the exclusion list (total
-- is not 2 x per side) are skipped.
--
-- Rounding: round(x / 2, 2), the precision of numeric(6,2). A total made of two equal plate loads (multiples
-- of 2.5) halves exactly; only an odd hundredth rounds (1.25 -> 0.63). Rounding is monotonic, so the check
-- suggested_weight_max_kg >= suggested_weight_kg still holds.
--
-- Idempotent: public.barbell_legacy_backup keeps the old values (used by the rollback) and its existence means
-- the conversion is done, so a second run changes nothing. It has RLS on and no grant to any client role.
-- Runs as the table owner (migration role), one transaction. No policy or grant on existing tables changes.
--
-- Rollback: restore the old values from public.barbell_legacy_backup.

begin;

do $migration$
declare
  -- Both lists are empty: no exclusion was needed when this was applied.
  -- Exercises whose total is NOT 2 x per side (e.g. a calf raise on a machine): left untouched.
  excluded_exercise_ids uuid[] := array[]::uuid[];
  -- Same, by name (case-insensitive, every owner), e.g. array['calf raise'].
  excluded_exercise_names text[] := array[]::text[];
  skip_ids uuid[];
  n_plan_exercise bigint;
  n_exercise bigint;
begin
  if to_regclass('public.barbell_legacy_backup') is not null then
    raise notice 'barbell per-side conversion already applied: nothing to do';
    return;
  end if;

  if exists (select 1 from unnest(excluded_exercise_ids) i where not exists (select 1 from public.exercise e where e.id = i))
     or exists (select 1 from unnest(excluded_exercise_names) n
                where not exists (select 1 from public.exercise e where lower(btrim(e.name)) = lower(btrim(n)))) then
    raise exception 'an excluded exercise does not exist: fix the exclusion list';
  end if;

  select coalesce(array_agg(e.id), array[]::uuid[]) into skip_ids
  from public.exercise e
  where e.id = any(excluded_exercise_ids)
     or lower(btrim(e.name)) in (select lower(btrim(n)) from unnest(excluded_exercise_names) n);

  -- Old values, kept for the rollback; its existence also marks the migration as done.
  create table public.barbell_legacy_backup (
    source        text not null check (source in ('plan_exercise', 'exercise')),
    row_id        uuid not null,
    old_value     numeric(6, 2),
    old_value_max numeric(6, 2),
    primary key (source, row_id)
  );
  revoke all on table public.barbell_legacy_backup from anon, authenticated, public;
  alter table public.barbell_legacy_backup enable row level security;

  insert into public.barbell_legacy_backup (source, row_id, old_value, old_value_max)
  select 'plan_exercise', pe.id, pe.suggested_weight_kg, pe.suggested_weight_max_kg
  from public.plan_exercise pe
  join public.exercise e on e.id = pe.exercise_id
  where e.equipment = 'barbell' and e.id <> all(skip_ids)
    and (pe.suggested_weight_kg is not null or pe.suggested_weight_max_kg is not null);
  get diagnostics n_plan_exercise = row_count;

  insert into public.barbell_legacy_backup (source, row_id, old_value)
  select 'exercise', e.id, e.starting_weight_kg
  from public.exercise e
  where e.equipment = 'barbell' and e.starting_weight_kg is not null and e.id <> all(skip_ids);
  get diagnostics n_exercise = row_count;

  update public.plan_exercise pe
  set suggested_weight_kg = round(pe.suggested_weight_kg / 2, 2),
      suggested_weight_max_kg = round(pe.suggested_weight_max_kg / 2, 2)
  from public.barbell_legacy_backup k where k.source = 'plan_exercise' and k.row_id = pe.id;

  update public.exercise e set starting_weight_kg = round(e.starting_weight_kg / 2, 2)
  from public.barbell_legacy_backup k where k.source = 'exercise' and k.row_id = e.id;

  raise notice 'barbell per-side conversion: % plan_exercise, % exercise rows halved', n_plan_exercise, n_exercise;
end
$migration$;

commit;
