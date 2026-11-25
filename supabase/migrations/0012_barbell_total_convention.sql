-- Gym Tracker: a barbell weight is stored as the TOTAL of both sides (2 x one side, bar excluded) again; the logger
-- still shows and edits one side. 0010 and 0011 had halved the stored data for the per-side convention, so this puts
-- all of it on the total:
--  (a) plan_exercise suggested min/max and exercise.starting_weight_kg go back to the values 0010 saved in
--      public.barbell_legacy_backup, only for rows still holding the halved value (a row edited since is left alone);
--  (b) the 2026-11-19 barbell sets go back to the totals in public.barbell_setlog_backup;
--  (c) the barbell sets logged per side (workouts on per_side_extra_date and from 2026-11-20 on) are doubled; the
--      2026-11-24 calf raise first set was logged as 15 by mistake and is corrected to 20 per side, final 40.
--      Any other date is left untouched.
-- Old values of (c) stay in public.barbell_total_backup (RLS on, no client grant); its existence makes a second run a no-op.
-- Runs as the table owner, one transaction; no policy or grant on existing tables changes.
--
-- Rollback: set_log from public.barbell_total_backup (old_weight_kg, only rows still holding the doubled value), then halve again what (a) and (b) restored;
-- see workspace/security/rehearsal-0012/ROLLBACK-0012.sql.
begin;

do $migration$
declare
  -- Name of the exercise whose 2026-11-24 first set (logged as 15) is corrected to 20 per side.
  calf_name_pattern constant text := '%calf%';
  -- CONFIRM BEFORE APPLYING. The one workout date before 2026-11-19 whose barbell sets were logged per side.
  per_side_extra_date constant date := date '2026-11-17';
  calf_id uuid;
  n_plan_exercise bigint;
  n_exercise bigint;
  n_nov19 bigint;
  n_doubled bigint;
begin
  if to_regclass('public.barbell_total_backup') is not null then
    raise notice 'barbell total convention already applied: nothing to do';
    return;
  end if;
  if to_regclass('public.barbell_legacy_backup') is null or to_regclass('public.barbell_setlog_backup') is null then
    raise exception 'apply 0010 and 0011 first: their backup tables are missing';
  end if;

  if exists (select 1 from public.barbell_setlog_backup b
              where not exists (select 1 from public.set_log s join public.workout w on w.id = s.workout_id
                                 where s.id = b.id and s.equipment_used = 'barbell' and w.date = date '2026-11-19'))
     or exists (select 1 from public.set_log s join public.workout w on w.id = s.workout_id
                 where s.equipment_used = 'barbell' and w.date = date '2026-11-19'
                   and not exists (select 1 from public.barbell_setlog_backup b where b.id = s.id)) then
    raise exception 'the barbell sets of 2026-11-19 are not the ones in barbell_setlog_backup';
  end if;

  select (array_agg(s.id))[1] into calf_id
  from public.set_log s
  join public.workout w on w.id = s.workout_id
  join public.exercise e on e.id = s.exercise_id
  where w.date = date '2026-11-24' and s.set_number = 1 and s.weight_kg = 15
    and s.equipment_used = 'barbell' and e.name ilike calf_name_pattern
  having count(*) = 1;
  if calf_id is null then
    raise exception 'expected exactly one 2026-11-24 first set of 15 kg on an exercise like %: fix calf_name_pattern', calf_name_pattern;
  end if;

  create table public.barbell_total_backup as
    select s.id, s.weight_kg as old_weight_kg
    from public.set_log s
    join public.workout w on w.id = s.workout_id
    where s.equipment_used = 'barbell' and (w.date = per_side_extra_date or w.date >= date '2026-11-20');
  alter table public.barbell_total_backup add primary key (id);
  alter table public.barbell_total_backup enable row level security;
  revoke all on public.barbell_total_backup from public, anon, authenticated;

  update public.plan_exercise pe
     set suggested_weight_kg = k.old_value, suggested_weight_max_kg = k.old_value_max
    from public.barbell_legacy_backup k, public.exercise e
   where k.source = 'plan_exercise' and k.row_id = pe.id and e.id = pe.exercise_id and e.equipment = 'barbell'
     and pe.suggested_weight_kg is not distinct from round(k.old_value / 2, 2)
     and pe.suggested_weight_max_kg is not distinct from round(k.old_value_max / 2, 2);
  get diagnostics n_plan_exercise = row_count;

  update public.exercise e set starting_weight_kg = k.old_value
    from public.barbell_legacy_backup k
   where k.source = 'exercise' and k.row_id = e.id and e.equipment = 'barbell'
     and e.starting_weight_kg is not distinct from round(k.old_value / 2, 2);
  get diagnostics n_exercise = row_count;

  update public.set_log s set weight_kg = b.old_weight_kg
    from public.barbell_setlog_backup b
   where b.id = s.id;
  get diagnostics n_nov19 = row_count;

  update public.set_log set weight_kg = 20 where id = calf_id;
  update public.set_log s set weight_kg = round(s.weight_kg * 2, 2)
    from public.barbell_total_backup b
   where b.id = s.id;
  get diagnostics n_doubled = row_count;

  if exists (select 1 from public.barbell_total_backup b join public.set_log s on s.id = b.id
              where s.weight_kg <> case when b.id = calf_id then 40 else round(b.old_weight_kg * 2, 2) end)
     or exists (select 1 from public.barbell_setlog_backup b join public.set_log s on s.id = b.id
                 where s.weight_kg <> b.old_weight_kg) then
    raise exception 'set_log: a weight is not the expected one';
  end if;

  raise notice 'barbell total convention: % plan_exercise and % exercise restored, % set_log of 2026-11-19 restored, % set_log doubled',
    n_plan_exercise, n_exercise, n_nov19, n_doubled;
end
$migration$;

commit;
