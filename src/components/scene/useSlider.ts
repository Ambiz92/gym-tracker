import { useState, type KeyboardEvent, type PointerEvent, type SVGProps } from 'react'
import { createDragGesture, snapToStep, valueAfterKey, type SliderRange } from '../../lib/slider'
import { VIEW_BOX } from './SceneFrame'

interface SliderOptions {
  range: SliderRange
  /** Current value, already inside the range. */
  value: number
  label: string
  valueText: string
  orientation: 'horizontal' | 'vertical'
  /** Value under a point of the scene, in scene units (the view box). */
  valueAt: (point: { x: number; y: number }) => number
  onChange: (value: number) => void
}

/** Slider behavior for a scene's svg: pointer drag with capture (touch moves it after a small slop), arrow keys, Home and End. */
export function useSlider({ range, value, label, valueText, orientation, valueAt, onChange }: SliderOptions): SVGProps<SVGSVGElement> {
  const [gesture] = useState(createDragGesture)

  function change(next: number) {
    if (next !== value) onChange(next)
  }

  function pick(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = rect.width / VIEW_BOX.width
    const point = {
      x: VIEW_BOX.x + (event.clientX - rect.left) / scale,
      y: VIEW_BOX.y + (event.clientY - rect.top) / scale,
    }
    change(snapToStep(valueAt(point), range))
  }

  return {
    role: 'slider',
    tabIndex: 0,
    'aria-label': label,
    'aria-orientation': orientation,
    'aria-valuemin': range.min,
    'aria-valuemax': range.max,
    'aria-valuenow': value,
    'aria-valuetext': valueText,
    onPointerDown: (event) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      if (gesture.start(event.pointerType, event.clientX, event.clientY)) pick(event)
    },
    onPointerMove: (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId) && gesture.move(event.clientX, event.clientY)) pick(event)
    },
    onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => {
      const next = valueAfterKey(event.key, value, range, orientation === 'vertical')
      if (next === null) return
      event.preventDefault()
      change(next)
    },
  }
}
