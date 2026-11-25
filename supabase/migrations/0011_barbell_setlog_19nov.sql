-- Gym Tracker: the 2026-11-19 barbell sets were logged before the per-side switch, so they hold the TOTAL of both
-- sides. Halve them once so they compare with later sets (per side). Old values stay in
-- public.barbell_setlog_backup (RLS on, no client grant); its existence makes a second run a no-op.
begin;

do $migration$
begin
  if to_regclass('public.barbell_setlog_backup') is not null then
    raise notice 'already applied';
    return;
  end if;

  create table public.barbell_setlog_backup as
    select s.id, s.weight_kg as old_weight_kg
    from public.set_log s
    join public.workout w on w.id = s.workout_id
    where s.equipment_used = 'barbell' and w.date = date '2026-11-19';
  alter table public.barbell_setlog_backup add primary key (id);
  alter table public.barbell_setlog_backup enable row level security;
  revoke all on public.barbell_setlog_backup from public, anon, authenticated;

  update public.set_log s
     set weight_kg = round(b.old_weight_kg / 2, 2)
    from public.barbell_setlog_backup b
   where b.id = s.id;
end
$migration$;

commit;
