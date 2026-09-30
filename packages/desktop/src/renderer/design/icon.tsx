import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  BadgeCheck,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  Clock,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  FileText,
  HardDrive,
  Info,
  Keyboard,
  Languages,
  LoaderCircle,
  Lock,
  type LucideIcon,
  Menu,
  Merge,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  NotebookPen,
  PanelTop,
  Pause,
  Pencil,
  Play,
  Plus,
  Quote,
  RefreshCw,
  ScrollText,
  Search,
  Send,
  Settings,
  Sparkles,
  Split,
  Square,
  Terminal,
  Trash,
  TriangleAlert,
  UserRound,
  Users,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react'

// The app's icon set: Lucide (ISC, see THIRD_PARTY_NOTICES.md), one stroke family at 1.75px on a 20px
// grid (brand spec). Screens name icons from this registry — never import lucide-react directly — so the
// set stays small, tree-shaken and consistent. Add an icon: import it above, add a name below.
export const ICONS = {
  add: Plus,
  alert: CircleAlert,
  arrowDown: ArrowDown,
  arrowUp: ArrowUp,
  ask: MessageSquare,
  audio: AudioLines,
  back: ChevronLeft,
  calendar: Calendar,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  clock: Clock,
  close: X,
  copy: Copy,
  delete: Trash,
  details: Info,
  document: FileText,
  download: Download,
  edit: Pencil,
  enhance: Sparkles,
  external: ExternalLink,
  help: CircleQuestionMark,
  info: Info,
  keyboard: Keyboard,
  language: Languages,
  loading: LoaderCircle,
  lock: Lock,
  menu: Menu,
  merge: Merge,
  mic: Mic,
  micOff: MicOff,
  more: Ellipsis,
  moreVertical: EllipsisVertical,
  notes: NotebookPen,
  offline: WifiOff,
  pause: Pause,
  person: UserRound,
  play: Play,
  quote: Quote,
  recognised: BadgeCheck,
  record: Circle,
  refresh: RefreshCw,
  refused: Ban,
  search: Search,
  send: Send,
  settings: Settings,
  speakers: Users,
  split: Split,
  stop: Square,
  storage: HardDrive,
  success: CircleCheck,
  terminal: Terminal,
  topBar: PanelTop,
  transcript: ScrollText,
  volume: Volume2,
  warning: TriangleAlert,
  windowClose: X,
  windowMaximize: Square,
  windowMinimize: Minus,
} as const satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

/** A Lucide icon, 20px by default, in currentColor. Decorative unless given a label. */
export function Icon({
  name,
  size = 20,
  label,
  className,
}: {
  name: IconName
  size?: number
  label?: string
  className?: string
}) {
  const C = ICONS[name]
  return (
    <C
      size={size}
      strokeWidth={1.75}
      // keep the stroke 1.75px at every size (brand spec), not scaled with the icon
      absoluteStrokeWidth
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      className={className}
    />
  )
}
