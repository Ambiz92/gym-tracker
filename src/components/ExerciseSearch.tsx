import { useId, type Ref } from 'react'
import '../styles/exercises.css'

interface ExerciseSearchProps {
  value: string
  onChange: (value: string) => void
  /** Lets the caller focus the box, e.g. when a sheet opens. */
  inputRef?: Ref<HTMLInputElement>
}

/** Name search box shared by the library and the picker. */
export function ExerciseSearch({ value, onChange, inputRef }: ExerciseSearchProps) {
  const id = useId()
  return (
    <div className="field exercise-search" role="search">
      <label className="field__label" htmlFor={id}>
        Cerca per nome
      </label>
      <input
        id={id}
        ref={inputRef}
        className="field__input"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
