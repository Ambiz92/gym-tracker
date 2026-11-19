import type { KeyboardEvent, PointerEvent, SVGProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { rulerValueAt } from '../../lib/plates'
import { BarbellScene } from './BarbellScene'
import { CableScene } from './CableScene'
import { DumbbellScene } from './DumbbellScene'
import { PlateGlyph } from './PlateGlyph'
import { RulerScene } from './RulerScene'
import { Scene } from './Scene'
import { useSlider } from './useSlider'

const noop = () => {}

describe('BarbellScene', () => {
  it('describes the bar and the plates of each side', () => {
    const html = renderToStaticMarkup(<BarbellScene weight={62.5} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Bilanciere: sbarra da 20 kg e 20, 1,25 kg per lato"')
  })

  it('draws one group per plate, with the diameter shared by the competition plates', () => {
    const html = renderToStaticMarkup(<BarbellScene weight={100} />)
    expect(html.match(/class="plate-g /g)).toHaveLength(2)
    expect(html).toContain('plate-tone--25')
    expect(html).toContain('plate-tone--15')
  })

  it('draws the bare bar at the bar weight', () => {
    const html = renderToStaticMarkup(<BarbellScene weight={20} />)
    expect(html).toContain('aria-label="Bilanciere: sbarra da 20 kg senza dischi"')
    expect(html).not.toContain('plate-g')
  })

  it('says so when the weight is below the bar or the plates cannot reach it', () => {
    expect(renderToStaticMarkup(<BarbellScene weight={15} />)).toContain('Il peso di 15 kg è inferiore alla sbarra')
    const unreachable = renderToStaticMarkup(<BarbellScene weight={23} />)
    expect(unreachable).toContain('e 1,25 kg per lato. Il peso di 23 kg non si ottiene esattamente con i dischi')
  })
})

it('DumbbellScene says the weight is that of a single dumbbell', () => {
  expect(renderToStaticMarkup(<DumbbellScene weight={14} />)).toContain('aria-label="Manubrio da 14 kg, il peso di un singolo manubrio"')
})

describe('CableScene', () => {
  const html = renderToStaticMarkup(<CableScene weight={25} onChange={noop} />)

  it('is a slider over the 11 blocks, in kg', () => {
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-valuemin="5"')
    expect(html).toContain('aria-valuemax="55"')
    expect(html).toContain('aria-valuenow="25"')
    expect(html).toContain('aria-valuetext="25 chili, perno al blocco 5 di 11"')
    expect(html).toContain('tabindex="0"')
  })

  it('lifts the blocks up to the pin and leaves the rest', () => {
    expect(html.match(/cable-block--lifted/g)).toHaveLength(5)
    expect(html.match(/class="cable-block(?: cable-block--lifted)?"/g)).toHaveLength(11)
  })

  it('keeps a weight beyond the stack on the last block, but says the real weight', () => {
    const beyond = renderToStaticMarkup(<CableScene weight={70} onChange={noop} />)
    expect(beyond).toContain('aria-valuenow="55"')
    expect(beyond).toContain('aria-valuetext="70 chili, perno al blocco 11 di 11"')
  })

  it('says the real weight when it falls between two blocks', () => {
    const between = renderToStaticMarkup(<CableScene weight={12.5} onChange={noop} />)
    expect(between).toContain('aria-valuenow="15"')
    expect(between).toContain('aria-valuetext="12,5 chili, perno al blocco 3 di 11"')
  })
})

describe('RulerScene', () => {
  it('is a slider on 90 seconds, in steps of five', () => {
    const html = renderToStaticMarkup(<RulerScene value={30} unit="seconds" onChange={noop} />)
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-label="Durata della tenuta"')
    expect(html).toContain('aria-valuemax="90"')
    expect(html).toContain('aria-valuetext="30 secondi, su 90"')
  })

  it('is a slider on 60 meters', () => {
    const html = renderToStaticMarkup(<RulerScene value={40} unit="meters" onChange={noop} />)
    expect(html).toContain('aria-label="Distanza del trasporto"')
    expect(html).toContain('aria-valuemax="60"')
    expect(html).toContain('aria-valuetext="40 metri, su 60"')
  })

  it('keeps the marker in range but says the real value when it is below the first mark', () => {
    const html = renderToStaticMarkup(<RulerScene value={0} unit="seconds" onChange={noop} />)
    expect(html).toContain('aria-valuenow="5"')
    expect(html).toContain('aria-valuetext="0 secondi, su 90"')
  })

  it('grows the scale when the value is beyond it', () => {
    expect(renderToStaticMarkup(<RulerScene value={100} unit="seconds" onChange={noop} />)).toContain('aria-valuemax="180"')
  })
})

describe('Scene', () => {
  const props = { weight: 40, reps: 8, onWeight: noop, onReps: noop, lifting: false }

  it('chooses the ruler for time or distance, otherwise the drawing of the equipment', () => {
    expect(renderToStaticMarkup(<Scene {...props} equipment="barbell" unit="reps" />)).toContain('Bilanciere')
    expect(renderToStaticMarkup(<Scene {...props} equipment="dumbbell" unit="reps" />)).toContain('Manubrio')
    expect(renderToStaticMarkup(<Scene {...props} equipment="other" unit="reps" />)).toContain('aria-label="Peso del cavo"')
    expect(renderToStaticMarkup(<Scene {...props} equipment="other" unit="seconds" />)).toContain('aria-label="Durata della tenuta"')
    expect(renderToStaticMarkup(<Scene {...props} equipment="other" unit="meters" />)).toContain('aria-label="Distanza del trasporto"')
    expect(renderToStaticMarkup(<Scene {...props} equipment="dumbbell" unit="meters" />)).toContain('aria-label="Distanza del trasporto"')
  })

  it('marks the scene while the save animation runs', () => {
    expect(renderToStaticMarkup(<Scene {...props} equipment="barbell" unit="reps" lifting />)).toContain('scene scene--lifting')
    expect(renderToStaticMarkup(<Scene {...props} equipment="barbell" unit="reps" />)).not.toContain('scene--lifting')
  })

  it('cannot be touched while the save animation runs', () => {
    expect(renderToStaticMarkup(<Scene {...props} equipment="other" unit="reps" lifting />)).toContain('inert=""')
    expect(renderToStaticMarkup(<Scene {...props} equipment="other" unit="reps" />)).not.toContain('inert')
  })
})

describe('PlateGlyph', () => {
  it('is decorative and draws the plates of the load', () => {
    const html = renderToStaticMarkup(<PlateGlyph weight={62.5} />)
    expect(html).toContain('aria-hidden="true"')
    expect(html.match(/class="plate /g)).toHaveLength(2)
  })

  it('draws just the bar below the bar weight', () => {
    expect(renderToStaticMarkup(<PlateGlyph weight={0} />)).not.toContain('class="plate ')
  })
})

describe('slider behavior', () => {
  const range = { min: 5, max: 90, step: 5 }
  // The hook keeps the pointer gesture in state, so it runs inside a render.
  const setup = (value: number, orientation: 'horizontal' | 'vertical' = 'horizontal') => {
    const onChange = vi.fn()
    let props: SVGProps<SVGSVGElement> = {}
    function Probe() {
      props = useSlider({
        range,
        value,
        label: 'Durata',
        valueText: `${value}`,
        orientation,
        valueAt: ({ x }) => rulerValueAt(x, 90, 84, 276),
        onChange,
      })
      return null
    }
    renderToStaticMarkup(<Probe />)
    return { onChange, props }
  }
  const key = (name: string) => ({ key: name, preventDefault: vi.fn() }) as unknown as KeyboardEvent<SVGSVGElement>
  // The svg is 240 px wide, like the view box, so a client x maps to the scene x minus 60.
  const pointer = (clientX: number, captured = true, pointerType = 'mouse', clientY = 0) =>
    ({
      clientX,
      clientY,
      pointerId: 1,
      pointerType,
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 240 }),
        setPointerCapture: vi.fn(),
        hasPointerCapture: () => captured,
      },
    }) as unknown as PointerEvent<SVGSVGElement>

  it('moves by one step with the arrow keys and prevents the page from scrolling', () => {
    const { onChange, props } = setup(30)
    const event = key('ArrowRight')
    props.onKeyDown?.(event)
    expect(onChange).toHaveBeenCalledWith(35)
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('jumps to the ends with Home and End', () => {
    const first = setup(30)
    first.props.onKeyDown?.(key('Home'))
    expect(first.onChange).toHaveBeenCalledWith(5)
    const last = setup(30)
    last.props.onKeyDown?.(key('End'))
    expect(last.onChange).toHaveBeenCalledWith(90)
  })

  it('leaves other keys alone and does not report an unchanged value', () => {
    const { onChange, props } = setup(90)
    const tab = key('Tab')
    props.onKeyDown?.(tab)
    props.onKeyDown?.(key('ArrowRight'))
    expect(onChange).not.toHaveBeenCalled()
    expect(tab.preventDefault).not.toHaveBeenCalled()
  })

  it('treats down as increasing on a vertical stack', () => {
    const { onChange, props } = setup(30, 'vertical')
    props.onKeyDown?.(key('ArrowDown'))
    expect(onChange).toHaveBeenCalledWith(35)
  })

  it('captures the pointer and sets the value snapped to the step under it', () => {
    const { onChange, props } = setup(30)
    const down = pointer(124)
    props.onPointerDown?.(down)
    expect(down.currentTarget.setPointerCapture).toHaveBeenCalledWith(1)
    // x = 184 on a ruler from 84 to 276 is 46.9 of 90, snapped to 45.
    expect(onChange).toHaveBeenCalledWith(45)
  })

  it('follows the pointer only while it is captured', () => {
    const dragging = setup(30)
    dragging.props.onPointerMove?.(pointer(204))
    expect(dragging.onChange).toHaveBeenCalledWith(85)
    const hovering = setup(30)
    hovering.props.onPointerMove?.(pointer(204, false))
    expect(hovering.onChange).not.toHaveBeenCalled()
  })

  it('does not change the value on a touch tap, however long the finger rests', () => {
    const { onChange, props } = setup(30)
    props.onPointerDown?.(pointer(124, true, 'touch'))
    props.onPointerMove?.(pointer(127, true, 'touch', 3))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('follows a touch drag once the finger has travelled the slop', () => {
    const { onChange, props } = setup(30)
    props.onPointerDown?.(pointer(124, true, 'touch'))
    props.onPointerMove?.(pointer(130, true, 'touch'))
    expect(onChange).not.toHaveBeenCalled()
    props.onPointerMove?.(pointer(204, true, 'touch'))
    expect(onChange).toHaveBeenCalledWith(85)
  })

  it('sets the value on a pen press, like the mouse', () => {
    const { onChange, props } = setup(30)
    props.onPointerDown?.(pointer(124, true, 'pen'))
    expect(onChange).toHaveBeenCalledWith(45)
  })

  it('ignores a pointer on an svg with no width, instead of reporting NaN', () => {
    const { onChange, props } = setup(30)
    const event = pointer(124)
    event.currentTarget.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0 }) as DOMRect
    props.onPointerDown?.(event)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clamps a drag past the ends', () => {
    const { onChange, props } = setup(30)
    props.onPointerMove?.(pointer(-500))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('exposes the slider semantics', () => {
    const { props } = setup(30)
    expect(props).toMatchObject({ role: 'slider', tabIndex: 0, 'aria-valuemin': 5, 'aria-valuemax': 90, 'aria-valuenow': 30 })
  })
})
