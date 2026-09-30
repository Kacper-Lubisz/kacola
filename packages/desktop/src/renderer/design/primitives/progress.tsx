import { ProgressBar as AriaProgressBar } from 'react-aria-components'

// Progress and levels. Both are named (aria-label) and expose their value to assistive tech and tests.
//
//   Spinner      indeterminate (role=progressbar, busy)
//   ProgressBar  determinate 0..1 (model downloads)
//   Meter        a live level 0..1 (audio input), record red above `hot`. A progressbar to assistive
//                tech: role="meter" is ARIA 1.2 and axe-core still rejects its value attributes.

export function Spinner({ label, size = 24 }: { label: string; size?: number }) {
  return (
    <AriaProgressBar isIndeterminate aria-label={label} className="inline-flex text-text-secondary">
      <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="9.5"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="2.5"
        />
        <path
          d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </AriaProgressBar>
  )
}

export function ProgressBar({
  label,
  value,
  showValue = false,
  className = '',
}: {
  label: string
  /** 0..1 */
  value: number
  showValue?: boolean
  className?: string
}) {
  return (
    <AriaProgressBar
      aria-label={label}
      value={Math.round(value * 100)}
      minValue={0}
      maxValue={100}
      className={`flex items-center gap-2 ${className}`}
    >
      {({ percentage, valueText }) => (
        <>
          <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-pill bg-bg-selected">
            <span
              className="block h-full rounded-pill bg-ink-primary transition-[width] duration-(--k-duration-base)"
              style={{ width: `${percentage ?? 0}%` }}
            />
          </span>
          {showValue ? (
            <span className="type-mono w-10 text-right text-text-secondary">{valueText}</span>
          ) : null}
        </>
      )}
    </AriaProgressBar>
  )
}

export function Meter({
  label,
  value,
  hot = 0.85,
  className = '',
}: {
  label: string
  /** 0..1 */
  value: number
  hot?: number
  className?: string
}) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <AriaProgressBar
      aria-label={label}
      value={Math.round(v * 100)}
      minValue={0}
      maxValue={100}
      className={`flex items-center ${className}`}
    >
      {({ percentage }) => (
        <span className="h-1.5 w-full overflow-hidden rounded-pill bg-bg-selected">
          <span
            className={`block h-full rounded-pill transition-[width] duration-(--k-duration-fast) ease-out ${v >= hot ? 'bg-accent-record' : 'bg-status-success'}`}
            style={{ width: `${percentage ?? 0}%` }}
          />
        </span>
      )}
    </AriaProgressBar>
  )
}
