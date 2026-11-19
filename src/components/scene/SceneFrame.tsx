import { useId, type ReactNode, type SVGProps } from 'react'

/** The part of the scene the svg shows: the platform, 240 units wide. */
export const VIEW_BOX = { x: 60, y: 0, width: 240, height: 190 } as const

export const FLOOR_Y = 142
/** The height of the bar and of the middle of every plate and head. */
export const CENTER_Y = 80

/** An id for the gradients of one scene; useId may carry characters url(#…) cannot take. */
export const useSceneId = (): string => useId().replace(/\W/g, '')

export const shade = (id: string): string => `url(#${id}-shade)`
export const sheen = (id: string): string => `url(#${id}-sheen)`
export const knurl = (id: string): string => `url(#${id}-knurl)`

type ShadedRectProps = SVGProps<SVGRectElement> & {
  /** Gradient painted over the fill, from shade(), sheen() or knurl(). */
  overlay: string
}

/** A rect with a gradient laid over it: the class gives the color, the overlay the volume. */
export function ShadedRect({ overlay, className, ...geometry }: ShadedRectProps) {
  return (
    <>
      <rect className={className} {...geometry} />
      <rect {...geometry} fill={overlay} />
    </>
  )
}

interface SceneFrameProps {
  id: string
  /** Where the shadow under the equipment sits and how wide it is. */
  shadow: { cx: number; rx: number }
  svgProps: SVGProps<SVGSVGElement>
  children: ReactNode
}

/** The shared svg: gradients, the wooden platform floor and the shadow under the equipment. */
export function SceneFrame({ id, shadow, svgProps, children }: SceneFrameProps) {
  return (
    <svg viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`} className="scene-svg" {...svgProps}>
      <defs>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".38" />
          <stop offset=".22" stopColor="#fff" stopOpacity=".05" />
          <stop offset=".6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".45" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".4" />
        </linearGradient>
        <pattern id={`${id}-knurl`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="1" height="3" fill="#000" fillOpacity=".35" />
        </pattern>
        <pattern id={`${id}-floor`} width="130" height="14" patternUnits="userSpaceOnUse">
          <rect className="scene-floor-a" width="130" height="14" />
          <rect className="scene-floor-b" y="7" width="130" height="7" />
          <path className="scene-floor-line" d="M0 .5H130M0 7.5H130M60 0V7M20 7V14M100 7V14" />
        </pattern>
      </defs>
      <rect x="-100" y={FLOOR_Y} width="600" height="48" fill={`url(#${id}-floor)`} />
      <rect className="scene-floor-edge" x="-100" y={FLOOR_Y} width="600" height="3" />
      <ellipse className="scene-shadow" cx={shadow.cx} cy={FLOOR_Y + 4} rx={shadow.rx} ry="5" />
      {children}
    </svg>
  )
}
