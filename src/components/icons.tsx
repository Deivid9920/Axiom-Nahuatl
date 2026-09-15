// Axiom icons — Material Symbols wrapper + re-export of lucide-react icons

import {
  Loader2,
} from 'lucide-react'

// Material Symbols icon component
export function MS({ name, className = '', fill = false, style }: {
  name: string
  className?: string
  fill?: boolean
  style?: React.CSSProperties
}) {
  return (
    <span
      className={`material-symbols-outlined ${fill ? 'fill' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}

export { Loader2 }
