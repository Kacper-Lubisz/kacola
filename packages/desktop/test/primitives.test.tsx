// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServicesProvider } from '../src/renderer/data/services.tsx'
import {
  AlertDialog,
  Banner,
  Button,
  buttonClass,
  Dialog,
  EmptyState,
  HeaderBar,
  IconButton,
  Kbd,
  ProgressBar,
  RecordButton,
  SearchField,
  SegmentedControl,
  Select,
  Switch,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  ToastProvider,
  useToast,
} from '../src/renderer/design/primitives/index.ts'
import { appInfo, servicesFor } from './app-harness.tsx'

// The primitives' behaviour under jsdom (their looks are the gallery's screenshots): names, roles,
// states, and that controlled inputs report only a user's change.

afterEach(() => cleanup())

describe('Button', () => {
  it('is a named button that presses, and a disabled one does not', () => {
    const onPress = vi.fn()
    render(
      <>
        <Button variant="primary" onPress={onPress}>
          Save
        </Button>
        <Button isDisabled onPress={onPress}>
          Nope
        </Button>
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nope' }))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Nope' }).hasAttribute('disabled')).toBe(true)
  })
  it('maps the phase-1 variant names onto the brand ones', () => {
    expect(buttonClass({ variant: 'suggested' })).toBe(buttonClass({ variant: 'primary' }))
    expect(buttonClass({ variant: 'flat' })).toBe(buttonClass({ variant: 'ghost' }))
    expect(buttonClass({ variant: 'default' })).toBe(buttonClass({ variant: 'secondary' }))
    expect(buttonClass({ variant: 'destructive', confirm: true })).toContain('bg-record-fill')
    expect(buttonClass({ variant: 'destructive' })).not.toContain('bg-record-fill')
  })
})

describe('IconButton', () => {
  it('takes its accessible name from the required label', () => {
    const onPress = vi.fn()
    render(<IconButton icon="search" label="Search" onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onPress).toHaveBeenCalled()
  })
})

describe('RecordButton', () => {
  it('idle: one "Record" button', () => {
    const onRecord = vi.fn()
    render(<RecordButton state="idle" onRecord={onRecord} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record' }))
    expect(onRecord).toHaveBeenCalled()
    expect(screen.queryByRole('timer')).toBeNull()
  })
  it('recording: a named timer, Pause and Stop; paused: Resume', () => {
    const on = { stop: vi.fn(), pause: vi.fn(), resume: vi.fn() }
    const { rerender } = render(
      <RecordButton
        state="recording"
        elapsedMs={192_000}
        onStop={on.stop}
        onPause={on.pause}
        onResume={on.resume}
      />,
    )
    expect(screen.getByRole('timer', { name: 'Recording, 3:12' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(on.pause).toHaveBeenCalled()
    expect(on.stop).toHaveBeenCalled()
    rerender(
      <RecordButton
        state="paused"
        elapsedMs={192_000}
        onStop={on.stop}
        onPause={on.pause}
        onResume={on.resume}
      />,
    )
    expect(screen.getByRole('timer', { name: 'Paused, 3:12' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(on.resume).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
  })
  it('starting / stopping are disabled', () => {
    const { rerender } = render(<RecordButton state="starting" />)
    expect(screen.getByRole('button', { name: 'Starting…' }).hasAttribute('disabled')).toBe(true)
    rerender(<RecordButton state="stopping" elapsedMs={1000} />)
    expect(screen.getByRole('button', { name: 'Stopping…' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('fields', () => {
  it('TextField is labelled (visibly or not) and reports typing', () => {
    const onChange = vi.fn()
    render(
      <>
        <TextField label="Title" onChange={onChange} />
        <TextField label="Hidden label" labelHidden type="password" />
      </>,
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'x' } })
    expect(onChange).toHaveBeenCalledWith('x')
    expect(screen.getByLabelText('Hidden label').getAttribute('type')).toBe('password')
  })
  it('SearchField is a named searchbox', () => {
    render(<SearchField label="Search sessions" />)
    expect(screen.getByRole('searchbox', { name: 'Search sessions' })).toBeTruthy()
  })
  it('Select shows its value and never reports the value it was given', () => {
    const onChange = vi.fn()
    function H() {
      const [v, setV] = useState<'a' | 'b'>('b')
      return (
        <Select
          label="Provider"
          value={v}
          onChange={(x) => {
            onChange(x)
            setV(x)
          }}
          options={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ]}
        />
      )
    }
    render(<H />)
    const trigger = screen.getByRole('button', { name: /Provider/ })
    expect(trigger.textContent).toContain('Beta')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Switch, SegmentedControl, Tabs', () => {
  it('Switch is a named switch; a change is reported, the given value is not', () => {
    const onChange = vi.fn()
    render(<Switch aria-label="Archive audio" isSelected={false} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: 'Archive audio' }) as HTMLInputElement
    expect(sw.checked).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })
  it('SegmentedControl selects one segment', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        label="Filter"
        value="all"
        onChange={onChange}
        segments={[
          { id: 'all', label: 'All' },
          { id: 'mine', label: 'Mine' },
        ]}
      />,
    )
    const group = screen.getByRole('radiogroup', { name: 'Filter' })
    fireEvent.click(within(group).getByRole('radio', { name: 'Mine' }))
    expect(onChange).toHaveBeenCalledWith('mine')
  })
  it('Tabs switch panels', () => {
    render(
      <Tabs defaultSelectedKey="a">
        <TabList
          label="Views"
          tabs={[
            { id: 'a', label: 'First' },
            { id: 'b', label: 'Second' },
          ]}
        />
        <TabPanel id="a">panel A</TabPanel>
        <TabPanel id="b">panel B</TabPanel>
      </Tabs>,
    )
    expect(screen.getByRole('tabpanel').textContent).toBe('panel A')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Second' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Second' }))
    expect(screen.getByRole('tabpanel').textContent).toBe('panel B')
  })
})

describe('dialogs and toasts', () => {
  it('Dialog is a named modal with a Close button', () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog title="Speakers" isOpen onOpenChange={onOpenChange}>
        body
      </Dialog>,
    )
    const d = screen.getByRole('dialog', { name: 'Speakers' })
    fireEvent.click(within(d).getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
  it('AlertDialog confirms once and closes', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <AlertDialog
        title="Delete Session?"
        isOpen
        onOpenChange={onOpenChange}
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
      >
        Gone for good.
      </AlertDialog>,
    )
    const d = screen.getByRole('alertdialog', { name: 'Delete Session?' })
    fireEvent.click(within(d).getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
  it('toasts appear in the named region as plain text and dismiss themselves', () => {
    vi.useFakeTimers()
    function Trigger() {
      const toast = useToast()
      return <Button onPress={() => toast('Saved <b>“Weekly”</b>')}>Show</Button>
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    const region = screen.getByRole('region', { name: 'Notifications' })
    expect(within(region).getByRole('status').textContent).toContain('Saved <b>“Weekly”</b>')
    act(() => {
      vi.advanceTimersByTime(5100)
    })
    expect(within(region).queryByRole('status')).toBeNull()
    vi.useRealTimers()
  })
})

describe('status and layout', () => {
  it('Banner is a named status; EmptyState a named region with a heading', () => {
    render(
      <>
        <Banner
          tone="warning"
          title="A speech model is not downloaded yet"
          action={<Button>Set up</Button>}
        />
        <EmptyState title="No Sessions Yet" description="Press Record." headingLevel={2} />
      </>,
    )
    const b = screen.getByRole('status', { name: 'A speech model is not downloaded yet' })
    expect(within(b).getByRole('button', { name: 'Set up' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'No Sessions Yet' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'No Sessions Yet' })).toBeTruthy()
  })
  it('ProgressBar exposes its value', () => {
    render(<ProgressBar label="Download" value={0.42} />)
    expect(screen.getByRole('progressbar', { name: 'Download' }).getAttribute('aria-valuenow')).toBe('42')
  })
  it('Kbd splits keys', () => {
    render(<Kbd>Ctrl+,</Kbd>)
    expect([...document.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual(['Ctrl', ','])
  })
  it('HeaderBar leaves the traffic lights room on macOS and draws window buttons on Linux', () => {
    const { container, rerender } = render(
      <ServicesProvider services={servicesFor({ appInfo: { ...appInfo, platform: 'darwin' } })}>
        <HeaderBar title="T" controls="start" />
      </ServicesProvider>,
    )
    expect(container.querySelector('header')!.className).toContain('pl-[78px]')
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    rerender(
      <ServicesProvider services={servicesFor()}>
        <HeaderBar title="T" controls="end" />
      </ServicesProvider>,
    )
    expect(container.querySelector('header')!.className).not.toContain('pl-[78px]')
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})
