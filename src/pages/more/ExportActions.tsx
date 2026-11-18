import { useEffect, useRef, useState } from 'react'
import { FormError } from '../../auth/FormParts'
import { buildCsvFiles, buildJsonFile, type ExportFile } from './exportFiles'

type Kind = 'csv' | 'json'

type ExportState =
  | { status: 'idle' }
  | { status: 'busy'; kind: Kind }
  | { status: 'ready'; kind: Kind; files: ExportFile[] }
  | { status: 'error'; message: string }

const ACTIONS: readonly { kind: Kind; title: string; detail: string; busyDetail: string }[] = [
  { kind: 'csv', title: 'Esporta CSV', detail: 'Un file per tabella', busyDetail: 'Preparo i file…' },
  { kind: 'json', title: 'Esporta JSON', detail: 'Un solo file con tutto', busyDetail: 'Preparo il file…' },
]

/** Excel needs the BOM to read UTF-8 accents in a CSV. */
function toBlob({ content, mime }: ExportFile): Blob {
  return new Blob(mime.startsWith('text/csv') ? ['﻿', content] : [content], { type: mime })
}

/**
 * Loads every table, then offers the files as download links. The links are tapped by the user
 * because mobile browsers may block downloads started programmatically after an async wait.
 */
export function ExportActions() {
  const [state, setState] = useState<ExportState>({ status: 'idle' })
  const inFlight = useRef(false)

  async function start(kind: Kind) {
    if (inFlight.current) return
    inFlight.current = true
    setState({ status: 'busy', kind })
    try {
      // Loaded on demand so rendering the Altro screen never needs the Supabase client.
      const { fetchAllTables } = await import('../../data/export')
      const tables = await fetchAllTables()
      const now = new Date()
      setState({ status: 'ready', kind, files: kind === 'csv' ? buildCsvFiles(tables, now) : [buildJsonFile(tables, now)] })
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      setState({ status: 'error', message: `Esportazione non riuscita: ${reason}. I dati nel database non sono toccati, riprova.` })
    } finally {
      inFlight.current = false
    }
  }

  const busyKind = state.status === 'busy' ? state.kind : null

  return (
    <>
      {ACTIONS.map(({ kind, title, detail, busyDetail }) => (
        <button
          key={kind}
          type="button"
          className="row-link action-row"
          disabled={busyKind !== null}
          aria-busy={busyKind === kind || undefined}
          onClick={() => void start(kind)}
        >
          <span>
            <span className="row-link__title">{title}</span>
            <span className="row-link__detail">{busyKind === kind ? busyDetail : detail}</span>
          </span>
          <span className="row-link__arrow" aria-hidden="true">
            →
          </span>
        </button>
      ))}
      {state.status === 'ready' && <ReadyFiles files={state.files} />}
      <FormError message={state.status === 'error' ? state.message : null} />
    </>
  )
}

function ReadyFiles({ files }: { files: readonly ExportFile[] }) {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(toBlob(file)))
    setUrls(created)
    return () => created.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  return (
    <div role="status">
      <p className="history-note">Pronto. Tocca un file per scaricarlo.</p>
      <ul className="export-ready">
        {files.map((file, index) => (
          <li key={file.name}>
            {urls[index] && (
              <a className="export-ready__link" href={urls[index]} download={file.name}>
                <span>{file.name}</span>
                <span className="row-link__detail">{file.rowCount} righe</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
