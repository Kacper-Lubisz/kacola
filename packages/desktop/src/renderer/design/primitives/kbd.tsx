import type { ReactNode } from 'react'

/** A keyboard shortcut, in mono (brand: JetBrains Mono for shortcuts). "Ctrl+," → Ctrl + , keycaps. */
export function Kbd({ children }: { children: ReactNode }) {
  if (typeof children !== 'string') return <kbd className={KEY}>{children}</kbd>
  const keys = children.split(/\+(?!$)/)
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((k, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a shortcut's keys never reorder
        <kbd key={i} className={KEY}>
          {k}
        </kbd>
      ))}
    </span>
  )
}

const KEY =
  'inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border-default bg-bg-surface px-1 font-mono text-[12px] leading-none font-medium text-text-secondary'
