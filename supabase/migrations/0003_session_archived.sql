-- Gym Tracker: archivable plan sessions.
--
-- A session that already has logged workouts cannot be deleted without losing the link
-- workout.session_id, so the plan editor archives it instead: it stays in the table, hidden
-- from the plan and from Oggi, and can be restored.
--
-- RLS is unchanged: the new column is covered by the existing row policies, and no new
-- grant is needed (privileges are per table). unique (plan_id, position) is left as is:
-- archived rows keep their position, and the app rewrites the complete list (archived last)
-- on every reorder, so a reorder never collides with an archived row.

begin;

alter table public.plan_session
  add column archived boolean not null default false;

commit;
