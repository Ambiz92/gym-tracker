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

type Box = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

/** A client point in scene units. The svg fits the view box inside its box and centers it, so a box wider than the scene's ratio leaves bands at the sides. */
export function scenePoint(box: Box, clientX: number, clientY: number): { x: number; y: number } {
  const scale = Math.min(box.width / VIEW_BOX.width, box.height / VIEW_BOX.height)
  const bandX = (box.width - VIEW_BOX.width * scale) / 2
  const bandY = (box.height - VIEW_BOX.height * scale) / 2
  return {
    x: VIEW_BOX.x + (clientX - box.left - bandX) / scale,
    y: VIEW_BOX.y + (clientY - box.top - bandY) / scale,
  }
}

/** Slider behavior for a scene's svg: pointer drag with capture (touch moves it after a small slop), arrow keys, Home and End. */
export function useSlider({ range, value, label, valueText, orientation, valueAt, onChange }: SliderOptions): SVGProps<SVGSVGElement> {
  const [gesture] = useState(createDragGesture)

  function change(next: number) {
    if (Number.isFinite(next) && next !== value) onChange(next)
  }

  function pick(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    change(snapToStep(valueAt(scenePoint(rect, event.clientX, event.clientY)), range))
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
