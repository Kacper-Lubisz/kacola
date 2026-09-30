import { _ } from '@gnomeola/ui-core/i18n'
import type { ReactNode } from 'react'
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { Button } from './button.tsx'
import { IconButton } from './icon-button.tsx'

// Dialog (brand spec): bg.raised, radius xl, e3, title in title2. Modal, focus-trapped, Escape and the
// close button dismiss it, focus returns to what opened it (React Aria). Controlled by the screen:
// `isOpen` + `onOpenChange` — a closed dialog is not in the DOM.
//
// AlertDialog: a short question with a cancel and one confirming action (role="alertdialog").

const OVERLAY =
  'fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--k-color-ink-primary)_28%,transparent)] p-4'

export type DialogSize = 'sm' | 'md' | 'lg'
const WIDTH: Record<DialogSize, string> = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[720px]' }

export function Dialog({
  title,
  isOpen,
  onOpenChange,
  children,
  footer,
  size = 'md',
  headerStart,
  isDismissable = true,
  className = '',
}: {
  title: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** Actions at the bottom (right-aligned). */
  footer?: ReactNode
  size?: DialogSize
  /** Something before the title (a back button in a multi-page dialog). */
  headerStart?: ReactNode
  /** Click outside closes (default true). */
  isDismissable?: boolean
  className?: string
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={OVERLAY}
    >
      <Modal
        className={`flex max-h-[calc(100vh-32px)] w-full ${WIDTH[size]} flex-col overflow-hidden rounded-xl bg-bg-raised text-text-primary shadow-e3 outline-none`}
      >
        <AriaDialog aria-label={title} className={`flex min-h-0 flex-1 flex-col outline-none ${className}`}>
          {({ close }) => (
            <>
              <header className="flex shrink-0 items-center gap-2 px-5 pt-4 pb-2">
                {headerStart}
                <Heading slot="title" className="m-0 min-w-0 flex-1 truncate type-title2">
                  {title}
                </Heading>
                <IconButton icon="close" label={_('Close')} tooltip={null} onPress={close} />
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5">{children}</div>
              {footer ? (
                <footer className="flex shrink-0 justify-end gap-2 border-t border-border-subtle px-5 py-3">
                  {footer}
                </footer>
              ) : null}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}

export function AlertDialog({
  title,
  children,
  isOpen,
  onOpenChange,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: {
  title: string
  children?: ReactNode
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className={OVERLAY}>
      <Modal className="w-full max-w-[400px] rounded-xl bg-bg-raised text-text-primary shadow-e3 outline-none">
        <AriaDialog role="alertdialog" className="flex flex-col gap-3 p-5 outline-none">
          {({ close }) => (
            <>
              <Heading slot="title" className="m-0 type-title2">
                {title}
              </Heading>
              {children ? <div className="type-body text-text-secondary">{children}</div> : null}
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="secondary" onPress={close} autoFocus>
                  {cancelLabel ?? _('Cancel')}
                </Button>
                <Button
                  variant={destructive ? 'destructive' : 'primary'}
                  confirm={destructive}
                  onPress={() => {
                    onConfirm()
                    close()
                  }}
                >
                  {confirmLabel}
                </Button>
              </div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}
