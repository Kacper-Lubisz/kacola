// LOCAL (phase 2B): a handful of Lucide icons (ISC licence, https://lucide.dev — path data copied) until
// the design system's icon set lands; consolidate into design/ then. 24-unit grid, 1.75 stroke at 20px
// (the brand spec), currentColor. Decorative unless labelled.

const PATHS = {
  arrowDown: ['M12 5v14', 'm19 12-7 7-7-7'],
  arrowUp: ['m5 12 7-7 7 7', 'M12 19V5'],
  search: ['m21 21-4.3-4.3', 'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16'],
  chevronUp: ['m18 15-6-6-6 6'],
  chevronDown: ['m6 9 6 6 6-6'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  userPlus: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
    'M19 8v6',
    'M22 11h-6',
  ],
  pencil: [
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
    'm15 5 4 4',
  ],
  merge: ['M18 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6', 'M6 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6', 'M6 21V9a9 9 0 0 0 9 9'],
  mic: ['M12 19v3', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3'],
  alert: [
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
    'M12 9v4',
    'M12 17h.01',
  ],
  info: ['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20', 'M12 16v-4', 'M12 8h.01'],
  ban: ['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20', 'm4.9 4.9 14.2 14.2'],
  badgeCheck: [
    'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z',
    'm9 12 2 2 4-4',
  ],
  loader: ['M21 12a9 9 0 1 1-6.219-8.56'],
  question: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  fileText: [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8',
  ],
  scissors: [
    'M6 3a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
    'M6 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
    'M20 4 8.12 15.88',
    'M14.47 14.48 20 20',
    'M8.12 8.12 12 12',
  ],
} as const

export type LocalIconName = keyof typeof PATHS

export function LIcon({
  name,
  size = 16,
  label,
  className = '',
}: {
  name: LocalIconName
  size?: number
  label?: string
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75 * (20 / size) > 2.25 ? 2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
