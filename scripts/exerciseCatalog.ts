export type CatalogEquipment = 'barbell' | 'dumbbell' | 'other'

export interface CatalogEntry {
  slug: string
  name_it: string
  name_en: string
  synonyms: string[]
  equipment: CatalogEquipment
  primary_muscle: string
  secondary_muscles: string[]
  /** One step per item; stored joined by newlines, the format the app splits on. */
  execution_steps: string[]
  source: string
  source_id: string | null
}

export const CATALOG_JSON_URL = new URL('../supabase/seed/exercise-catalog.json', import.meta.url)
export const SEED_SQL_URL = new URL('../supabase/seed/exercise-catalog.sql', import.meta.url)

export const EQUIPMENT_VALUES: readonly CatalogEquipment[] = ['barbell', 'dumbbell', 'other']

/** Closed list, so a later muscle filter in the UI can rely on it. */
export const MUSCLES: readonly string[] = [
  'Petto',
  'Dorsali',
  'Dorso',
  'Trapezi',
  'Lombari',
  'Spalle',
  'Bicipiti',
  'Tricipiti',
  'Avambracci',
  'Addominali',
  'Quadricipiti',
  'Femorali',
  'Glutei',
  'Adduttori',
  'Polpacci',
]

// Mirror the check constraints of exercise_catalog (migration 0005).
export const NAME_MAX = 120
export const MUSCLE_MAX = 120
export const STEPS_MAX = 2000
export const SYNONYMS_MAX = 20
export const SECONDARY_MUSCLES_MAX = 10
/** Limit of exercise.muscles, where adopting an entry copies the muscles joined by commas. */
export const MUSCLES_TEXT_MAX = 500

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ACCENTED = 'àáâäèéêëìíîïòóôöùúûüç’'
const PLAIN = "aaaaeeeeiiiioooouuuuc'"

/** Lowercase, accent-free, straight apostrophes, single spaces, trimmed: the key used to match user exercises to the catalog. */
export function normalizeName(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replaceAll('’', "'").toLowerCase().replace(/\s+/g, ' ').trim()
}

/** SQL twin of normalizeName for Italian text (Postgres has no unaccent without an extension). */
function normalizedSql(expression: string): string {
  return `trim(regexp_replace(lower(translate(${expression}, '${ACCENTED}', ${sqlText(PLAIN)})), '\\s+', ' ', 'g'))`
}

/** Returns every problem found; an empty list means the catalog can be turned into SQL. */
export function validateCatalog(entries: readonly CatalogEntry[]): string[] {
  const errors: string[] = []
  const slugs = new Set<string>()
  const owners = new Map<string, string>()

  const checkText = (slug: string, field: string, value: string, max: number) => {
    if (value.trim() === '') errors.push(`${slug}: ${field} is empty`)
    else if (value.length > max) errors.push(`${slug}: ${field} is longer than ${max}`)
  }
  const checkMuscle = (slug: string, field: string, value: string) => {
    checkText(slug, field, value, MUSCLE_MAX)
    if (!MUSCLES.includes(value)) errors.push(`${slug}: ${field} "${value}" is not in the muscle list`)
  }

  for (const entry of entries) {
    const { slug } = entry
    if (!SLUG.test(slug)) errors.push(`${slug}: slug must be lowercase kebab-case`)
    if (slugs.has(slug)) errors.push(`${slug}: duplicate slug`)
    slugs.add(slug)

    checkText(slug, 'name_it', entry.name_it, NAME_MAX)
    checkText(slug, 'name_en', entry.name_en, NAME_MAX)
    if (!EQUIPMENT_VALUES.includes(entry.equipment)) errors.push(`${slug}: invalid equipment "${entry.equipment}"`)
    checkMuscle(slug, 'primary_muscle', entry.primary_muscle)
    for (const muscle of entry.secondary_muscles) checkMuscle(slug, 'secondary_muscles', muscle)
    if (entry.secondary_muscles.length > SECONDARY_MUSCLES_MAX) errors.push(`${slug}: more than ${SECONDARY_MUSCLES_MAX} secondary muscles`)
    if (joinMuscles(entry).length > MUSCLES_TEXT_MAX) errors.push(`${slug}: muscles text is longer than ${MUSCLES_TEXT_MAX}`)
    if (entry.secondary_muscles.includes(entry.primary_muscle)) errors.push(`${slug}: primary muscle repeated in secondary_muscles`)
    if (entry.synonyms.length === 0) errors.push(`${slug}: no synonyms`)
    if (entry.synonyms.length > SYNONYMS_MAX) errors.push(`${slug}: more than ${SYNONYMS_MAX} synonyms`)
    for (const synonym of entry.synonyms) checkText(slug, 'synonym', synonym, NAME_MAX)

    if (entry.execution_steps.length === 0) errors.push(`${slug}: no execution steps`)
    entry.execution_steps.forEach((step, index) => checkText(slug, `execution step ${index + 1}`, step, STEPS_MAX))
    if (joinSteps(entry).length > STEPS_MAX) errors.push(`${slug}: execution_steps is longer than ${STEPS_MAX}`)

    checkText(slug, 'source', entry.source, NAME_MAX)
    if (entry.source_id !== null) checkText(slug, 'source_id', entry.source_id, NAME_MAX)

    // A name or synonym shared by two entries would make the link to user exercises ambiguous.
    for (const name of new Set([entry.name_it, entry.name_en, ...entry.synonyms].map(normalizeName))) {
      const owner = owners.get(name)
      if (owner !== undefined) errors.push(`${slug}: "${name}" is already a name or synonym of ${owner}`)
      else owners.set(name, slug)
    }
  }
  return errors
}

function joinSteps(entry: CatalogEntry): string {
  return entry.execution_steps.join('\n')
}

/** The text the app stores in exercise.muscles when an entry is adopted. */
function joinMuscles(entry: CatalogEntry): string {
  return [entry.primary_muscle, ...entry.secondary_muscles].join(', ')
}

function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function sqlArray(values: readonly string[]): string {
  return `array[${values.map(sqlText).join(', ')}]::text[]`
}

function sqlRow(entry: CatalogEntry): string {
  const values = [
    sqlText(entry.slug),
    sqlText(entry.name_it),
    sqlText(entry.name_en),
    sqlArray(entry.synonyms),
    sqlText(entry.equipment),
    sqlText(entry.primary_muscle),
    sqlArray(entry.secondary_muscles),
    sqlText(joinSteps(entry)),
    sqlText(entry.source),
    entry.source_id === null ? 'null' : sqlText(entry.source_id),
  ]
  return `  (${values.join(', ')})`
}

const COLUMNS = [
  'slug',
  'name_it',
  'name_en',
  'synonyms',
  'equipment',
  'primary_muscle',
  'secondary_muscles',
  'execution_steps',
  'source',
  'source_id',
] as const

/** Names that identify an entry: the Italian and English names, plus the synonyms for the review query only. */
function catalogNamesCte(withSynonyms: boolean): string {
  const names = withSynonyms ? 'c.synonyms || array[c.name_it, c.name_en]' : 'array[c.name_it, c.name_en]'
  return `catalog_names as (
  select c.id as catalog_id, ${normalizedSql('n.name')} as name_key
  from public.exercise_catalog c
  cross join lateral unnest(${names}) as n(name)
  where n.name is not null
)`
}

// Same equipment is required: a generic name ("curl", "rematore") must not link a cable or dumbbell variant to a barbell entry.
const LINK_EXERCISES = `with ${catalogNamesCte(false)},
matches as (
  select distinct e.id as exercise_id, e.owner_id, e.archived, c.id as catalog_id
  from public.exercise e
  join catalog_names cn on cn.name_key = ${normalizedSql('e.name')}
  join public.exercise_catalog c on c.id = cn.catalog_id and c.equipment = e.equipment
  where e.catalog_id is null
),
single_match as (
  select m.*, count(*) over (partition by m.exercise_id) as catalog_count
  from matches m
),
ranked as (
  select s.*, row_number() over (partition by s.owner_id, s.catalog_id order by s.archived, s.exercise_id) as rank_in_owner
  from single_match s
  where s.catalog_count = 1
)
update public.exercise e
set catalog_id = r.catalog_id
from ranked r
where e.id = r.exercise_id
  and r.rank_in_owner = 1
  and not exists (
    select 1 from public.exercise o where o.owner_id = e.owner_id and o.catalog_id = r.catalog_id
  );`

const DUPLICATE_CHECK = `with ${catalogNamesCte(true)}
select e.owner_id,
       e.id as exercise_id,
       e.name as exercise_name,
       string_agg(distinct c.slug, ', ') as catalog_slugs,
       string_agg(distinct o.name, ', ') as already_linked_as
from public.exercise e
join catalog_names cn on cn.name_key = ${normalizedSql('e.name')}
join public.exercise_catalog c on c.id = cn.catalog_id and c.equipment = e.equipment
left join public.exercise o on o.owner_id = e.owner_id and o.catalog_id = c.id
where e.catalog_id is null
group by e.owner_id, e.id, e.name
order by e.owner_id, e.name;`

/** Idempotent seed script: upsert the catalog, link matching user exercises, then list what is left to review. */
export function buildSeedSql(entries: readonly CatalogEntry[]): string {
  const upsert = COLUMNS.filter((column) => column !== 'slug')
    .map((column) => `${column} = excluded.${column}`)
    .join(',\n  ')

  return `-- Generated by scripts/generate-exercise-seed.ts from supabase/seed/exercise-catalog.json.
-- Do not edit by hand: change the JSON and run \`npm run seed:catalog\`.
--
-- Run as postgres after migration 0005. Safe to run again.
-- 1. Upserts the catalog by slug.
-- 2. Links user exercises (catalog_id null) whose normalized name equals the Italian or English name
--    of an entry with the same equipment. Synonyms are too generic to link on their own.
--    It skips names that match several catalog entries and owners who already have that entry.
--    It never merges exercises and never changes their id, so history stays intact.
-- 3. The last statement is read-only: exercises that match a name or synonym of the catalog
--    (same equipment) and are still unlinked, for manual review.

begin;

insert into public.exercise_catalog (${COLUMNS.join(', ')})
values
${entries.map(sqlRow).join(',\n')}
on conflict (slug) do update set
  ${upsert};

${LINK_EXERCISES}

commit;

${DUPLICATE_CHECK}
`
}
