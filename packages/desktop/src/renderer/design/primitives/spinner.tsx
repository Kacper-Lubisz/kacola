/** AdwSpinner: indeterminate progress. Announced as busy via its label. */
export function Spinner({ label, size = 32 }: { label: string; size?: number }) {
  return (
    <span role="progressbar" aria-label={label} aria-busy="true" className="inline-block text-dim">
      <svg width={size} height={size} viewBox="0 0 16 16" className="animate-spin" aria-hidden="true">
        <circle
          cx="8"
          cy="8"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2"
        />
        <path
          d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
