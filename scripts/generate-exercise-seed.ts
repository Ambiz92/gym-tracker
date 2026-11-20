/**
 * Turns supabase/seed/exercise-catalog.json into supabase/seed/exercise-catalog.sql.
 * Usage: `npm run seed:catalog`. Fails, writing nothing, when the JSON is invalid.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { buildSeedSql, CATALOG_JSON_URL, type CatalogEntry, SEED_SQL_URL, validateCatalog } from './exerciseCatalog'

const entries = JSON.parse(readFileSync(CATALOG_JSON_URL, 'utf8')) as CatalogEntry[]
const errors = validateCatalog(entries)
if (errors.length > 0) {
  for (const error of errors) console.error(error)
  console.error(`\n${errors.length} problem(s) in the catalog.`)
  process.exit(1)
}

writeFileSync(SEED_SQL_URL, buildSeedSql(entries))
console.log(`Wrote ${entries.length} exercises to supabase/seed/exercise-catalog.sql`)
