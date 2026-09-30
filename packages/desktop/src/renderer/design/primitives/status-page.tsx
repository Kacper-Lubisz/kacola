import type { ReactNode } from 'react'
import { Icon } from '../icon.tsx'
import type { IconName } from '../icon-paths.ts'

/** AdwStatusPage: a big dimmed icon, a title, a description, and optional actions below. */
export function StatusPage({
  icon,
  title,
  description,
  children,
}: {
  icon?: IconName
  title: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="flex h-full flex-col items-center justify-center gap-3 overflow-auto px-3 py-9 text-center"
    >
      {icon ? (
        <div className="mb-6 text-dim">
          <Icon name={icon} size={128} />
        </div>
      ) : null}
      <h2 className="m-0 text-[20pt] font-extrabold">{title}</h2>
      {description ? <p className="m-0 max-w-[40ch] text-balance">{description}</p> : null}
      {children ? <div className="mt-6 flex flex-col items-center gap-3">{children}</div> : null}
    </section>
  )
}
