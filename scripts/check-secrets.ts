/**
 * Fails when a private Supabase credential shows up where only public values belong.
 * Usage: `tsx scripts/check-secrets.ts` scans the files tracked by git and every VITE_* variable;
 * `tsx scripts/check-secrets.ts dist` scans the given files or directories instead of the tracked files.
 * The one JWT allowed is the VITE_SUPABASE_ANON_KEY value, unless it is a service_role token.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { type Finding, scanText } from './secretScan'

function listFiles(path: string): string[] {
  if (!existsSync(path)) throw new Error(`Nothing to scan at ${path}`)
  if (statSync(path).isFile()) return [path]
  return readdirSync(path, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

function trackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return output.split('\0').filter((file) => file && existsSync(file))
}

const targets = process.argv.slice(2)
const files = targets.length > 0 ? targets.flatMap(listFiles) : trackedFiles()
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const publicKeys: ReadonlySet<string> = new Set(anonKey ? [anonKey] : [])

const findings: Finding[] = []
for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith('VITE_') && value) findings.push(...scanText(`env:${name}`, value, publicKeys))
}
for (const file of files) {
  const content = readFileSync(file)
  if (content.includes(0)) continue
  findings.push(...scanText(file, content.toString('utf8'), publicKeys))
}

for (const { file, line, kind, preview } of findings) console.error(`${file}:${line}  ${kind}  ${preview}`)
if (findings.length > 0) {
  console.error(`\n${findings.length} secret-looking value(s) found.`)
  process.exit(1)
}
console.log(`No secret-looking values in ${files.length} file(s) and the VITE_* variables.`)
