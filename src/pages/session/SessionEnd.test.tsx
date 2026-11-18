import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { SessionEnd } from './SessionEnd'
import type { LoadedSession } from './loadSession'
import type { PlanExerciseDetail } from '../../data/activePlan'
import { addSet, newDraft } from '../../lib/sessionDraft'
import type { SetLog } from '../../types/db'

vi.mock('./sessionStore', () => ({ sessionStore: {} }))

function planExercise(id: string, name: string): PlanExerciseDetail {
  return {
    id: `pe-${id}`,
    owner_id: 'o',
    session_id: 's1',
    exercise_id: id,
    position: 0,
    target_sets: 3,
    target_reps: 10,
    target_unit: 'reps',
    suggested_weight_kg: null,
    suggested_weight_max_kg: null,
    exercise: { id, owner_id: 'o', name, equipment: 'barbell', muscles: null, execution_steps: null, notes: null, starting_weight_kg: null, archived: false },
  }
}

const lastSet = (exerciseId: string, weightKg: number): SetLog => ({
  id: `l-${exerciseId}`,
  owner_id: 'o',
  workout_id: 'w0',
  exercise_id: exerciseId,
  set_number: 1,
  reps: 10,
  weight_kg: weightKg,
  equipment_used: 'barbell',
  rpe: null,
})

const loaded: LoadedSession = {
  plan: { id: 'p', owner_id: 'o', name: 'Forza base', is_active: true, archived: false, sessions: [] },
  session: {
    id: 's1',
    owner_id: 'o',
    plan_id: 'p',
    name: 'Upper body',
    subtitle: null,
    position: 0,
    is_optional: false,
    exercises: [planExercise('e1', 'Panca piana'), planExercise('e2', 'Curl con bilanciere')],
    warmup: [],
  },
  lastSets: new Map([['e2', [lastSet('e2', 12.5)]]]),
  recentSets: new Map(),
}

const base = newDraft({ workoutId: 'w1', date: '2026-11-18', sessionId: 's1', sessionName: 'Upper body', startedAt: Date.now() })
const logged = (draft: typeof base, id: string, exerciseId: string, setNumber: number, weightKg: number) =>
  addSet(draft, { id, exerciseId, setNumber, reps: 10, weightKg, equipment: 'barbell' })

function render(draft: typeof base | null) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SessionEnd loaded={loaded} draft={draft} />
    </MemoryRouter>,
  )
}

test('the summary lists today\'s weights and the change since the last workout of each exercise', () => {
  const draft = logged(logged(logged(base, 'a', 'e1', 1, 15), 'b', 'e2', 1, 15), 'c', 'e2', 2, 12.5)
  const html = render(draft)
  expect(html).toContain('Progressi di oggi')
  expect(html).toContain('1 × 15 kg')
  expect(html).toContain('1 × 15 kg · 1 × 12,5 kg')
  expect(html).toContain('prima volta')
  expect(html).toContain('+2,5 kg')
})

test('without an open session the summary says nothing is saved', () => {
  expect(render(null)).toContain('la sessione non verrà salvata')
})
