import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildSeedSql,
  CATALOG_JSON_URL,
  type CatalogEntry,
  normalizeName,
  SEED_SQL_URL,
  validateCatalog,
} from './exerciseCatalog'

const catalog = JSON.parse(readFileSync(CATALOG_JSON_URL, 'utf8')) as CatalogEntry[]

const sample: CatalogEntry = {
  slug: 'barbell-curl',
  name_it: "Curl all'inglese",
  name_en: 'Barbell Curl',
  synonyms: ['curl'],
  equipment: 'barbell',
  primary_muscle: 'Bicipiti',
  secondary_muscles: ['Avambracci'],
  execution_steps: ['Primo passo.', 'Secondo passo.'],
  source: 'free-exercise-db',
  source_id: null,
}

describe('curated catalog', () => {
  it('is a valid catalog', () => {
    expect(validateCatalog(catalog)).toEqual([])
  })

  it('covers the fundamentals with a reasonable number of entries', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(40)
    expect(catalog.length).toBeLessThanOrEqual(80)
  })

  it('has a primary muscle for each main group', () => {
    const primary = new Set(catalog.map((entry) => entry.primary_muscle))
    for (const muscle of ['Petto', 'Dorsali', 'Spalle', 'Quadricipiti', 'Bicipiti', 'Tricipiti', 'Addominali']) {
      expect(primary).toContain(muscle)
    }
  })

  it('keeps the common Italian gym names findable', () => {
    const names = new Set(catalog.flatMap((entry) => [entry.name_it, ...entry.synonyms]).map(normalizeName))
    for (const name of ['stacco', 'panca piana', 'lat machine', 'squat', 'trazioni', 'military press']) {
      expect(names).toContain(name)
    }
  })

  it('has the generated SQL up to date', () => {
    expect(readFileSync(SEED_SQL_URL, 'utf8')).toBe(buildSeedSql(catalog))
  })
})

describe('validateCatalog', () => {
  const problems = (...entries: CatalogEntry[]) => validateCatalog(entries).join('\n')

  it('accepts a well-formed entry', () => {
    expect(validateCatalog([sample])).toEqual([])
  })

  it('rejects duplicate slugs and malformed slugs', () => {
    expect(problems(sample, { ...sample, name_it: 'Altro', synonyms: ['altro'] })).toContain('duplicate slug')
    expect(problems({ ...sample, slug: 'Barbell_Curl' })).toContain('kebab-case')
  })

  it('rejects an equipment outside barbell, dumbbell and other', () => {
    expect(problems({ ...sample, equipment: 'cable' as CatalogEntry['equipment'] })).toContain('invalid equipment')
  })

  it('rejects empty Italian fields', () => {
    expect(problems({ ...sample, name_it: ' ' })).toContain('name_it is empty')
    expect(problems({ ...sample, execution_steps: [] })).toContain('no execution steps')
    expect(problems({ ...sample, execution_steps: ['ok', ' '] })).toContain('execution step 2 is empty')
    expect(problems({ ...sample, synonyms: [] })).toContain('no synonyms')
    expect(problems({ ...sample, primary_muscle: '' })).toContain('primary_muscle is empty')
  })

  it('rejects values longer than the database checks', () => {
    expect(problems({ ...sample, name_en: 'x'.repeat(121) })).toContain('name_en is longer than 120')
    expect(problems({ ...sample, execution_steps: ['a'.repeat(1200), 'b'.repeat(1200)] })).toContain(
      'execution_steps is longer than 2000',
    )
  })

  it('rejects muscles outside the list or repeated as primary', () => {
    expect(problems({ ...sample, primary_muscle: 'Bicipite' })).toContain('not in the muscle list')
    expect(problems({ ...sample, secondary_muscles: ['Bicipiti'] })).toContain('repeated in secondary_muscles')
  })

  it('rejects a name shared by two entries, ignoring case and accents', () => {
    const other = { ...sample, slug: 'other', name_it: 'Altro', synonyms: ['CURL'] }
    expect(problems(sample, other)).toContain('already a name or synonym of barbell-curl')
    const accented = { ...sample, slug: 'accented', name_it: 'Cùrl', synonyms: ['altro'] }
    expect(problems(sample, accented)).toContain('"curl" is already a name or synonym of barbell-curl')
  })
})

describe('normalizeName', () => {
  it('lowercases, drops accents and trims', () => {
    expect(normalizeName('  Staccò Rumeno ')).toBe('stacco rumeno')
  })
})

describe('buildSeedSql', () => {
  const sql = buildSeedSql([
    sample,
    { ...sample, slug: 'plank', name_it: 'Plank', synonyms: [], secondary_muscles: [], source_id: 'Plank' },
  ])

  it('upserts by slug and updates every column but the slug', () => {
    expect(sql).toContain('insert into public.exercise_catalog (slug, name_it,')
    expect(sql).toContain('on conflict (slug) do update set')
    expect(sql).toContain('name_it = excluded.name_it')
    expect(sql).toContain('source_id = excluded.source_id')
    expect(sql).not.toContain('slug = excluded.slug')
  })

  it('escapes quotes and renders arrays, newlines and nulls', () => {
    expect(sql).toContain("'Curl all''inglese'")
    expect(sql).toContain("array['curl']::text[]")
    expect(sql).toContain('array[]::text[]')
    expect(sql).toContain("'Primo passo.\nSecondo passo.'")
    expect(sql).toContain(", 'free-exercise-db', null)")
  })

  it('links only exercises without a catalog entry, without creating duplicates', () => {
    expect(sql).toContain('where e.catalog_id is null')
    expect(sql).toContain('catalog_count = 1')
    expect(sql).toContain('o.owner_id = e.owner_id and o.catalog_id = r.catalog_id')
    expect(sql).toContain("translate(e.name, 'àáâäèéêëìíîïòóôöùúûüç', 'aaaaeeeeiiiioooouuuuc')")
  })

  it('never deletes, and ends with the read-only check after the commit', () => {
    expect(sql).not.toMatch(/\bdelete\b|\bdrop\b|\btruncate\b/i)
    const afterCommit = sql.slice(sql.lastIndexOf('commit;'))
    expect(afterCommit).toContain('already_linked_as')
    expect(afterCommit).not.toMatch(/\bupdate\b|\binsert\b/i)
  })
})
