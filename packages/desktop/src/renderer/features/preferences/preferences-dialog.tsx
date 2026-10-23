import type { AudioDevice, Settings, SettingsPatch } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'
import { deviceChoices, finalPasses, retentions } from '@kacola/ui-core/settings'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { useServices } from '../../data/services.tsx'
import {
  Button,
  Dialog,
  EmptyState,
  NumberField,
  Row,
  RowGroup,
  Select,
  Spinner,
  Switch,
  TabList,
  TabPanel,
  Tabs,
  useToast,
} from '../../design/primitives/index.ts'
import { BackgroundRow, CliInstallRow, ExtensionRow } from './integration-rows.tsx'
import { updateSettingsMutation } from './settings-data.ts'

// Preferences: every daemon setting the window owns (the GTK dialog's, S-3), applied as soon as it
// changes — no OK button. Values come from the ['settings'] query, which the EventBridge folds
// settings.updated into, so a change made by the CLI or another window shows up here live and what is
// on screen is always what the daemon holds. Opening the dialog refetches, and writes nothing: every
// control reports only a user's change, never the value it was given.
//
// The API key is write-only: its field starts empty, is cleared once the key is stored, and the only
// thing ever shown is whether a key is configured.

const reasonOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** A text setting applied with Enter or its Apply button (not on every keystroke). */
function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string
  subtitle?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Row title={title} subtitle={subtitle}>
      <Switch aria-label={title} isSelected={value} onChange={(v) => v !== value && onChange(v)} />
    </Row>
  )
}

function SelectRow<T extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  title: string
  subtitle?: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <Row title={title} subtitle={subtitle}>
      <Select
        label={title}
        labelHidden
        options={options}
        value={value}
        onChange={onChange}
        className="w-[230px] max-w-[calc(100vw-96px)]"
      />
    </Row>
  )
}

/**
 * Which AI answers questions, writes notes and judges decisions, its model and the API keys: not shown
 * here, but kept in kacola.env (platformPaths().configFile), which this opens. What is configured shows
 * as one line from /health.
 */
function AdvancedGroup() {
  const { bridge, queries } = useServices()
  const toast = useToast()
  const health = useQuery({ ...queries.health(), refetchOnMount: 'always' })
  const h = health.data
  // an older daemon's /health may not say
  const ai = !h?.llm
    ? undefined
    : [
        h.llm.provider === 'none'
          ? _('Answers: off')
          : fmt(h.llm.ready ? _('Answers: {provider}') : _('Answers: {provider}, needs an API key'), {
              provider: providerName(h.llm.provider),
            }),
        h.decisions
          ? fmt(
              h.decisions.ready ? _('Decisions: {provider}') : _('Decisions: {provider}, needs an API key'),
              {
                provider: providerName(h.decisions.provider),
              },
            )
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
  return (
    <RowGroup
      title={_('Advanced')}
      description={_(
        'Which AI answers questions, writes notes and judges meetings, and its API keys, are set in a config file.',
      )}
    >
      <Row title={_('AI providers and API keys')} subtitle={ai}>
        <Button
          size="sm"
          onPress={() =>
            void bridge
              .openConfigFile()
              .then(({ path, error }) =>
                toast(
                  error
                    ? fmt(_('Could not open {path}: {reason}'), { path, reason: error })
                    : _('Changes apply a few seconds after you save the file'),
                  error ? { tone: 'error' } : undefined,
                ),
              )
          }
        >
          {_('Open config file')}
        </Button>
      </Row>
    </RowGroup>
  )
}

const providerName = (p: string): string =>
  ({
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    ollama: 'Ollama',
    jev: 'TypeSafe Jev',
    local: _('on this computer'),
  })[p] ?? p

function General({
  settings,
  devices,
  patch,
}: {
  settings: Settings
  devices: AudioDevice[]
  patch: (p: SettingsPatch) => void
}) {
  const { stt, capture, autoRecord } = settings
  // optional in the schema (settings stored before M3): the daemon's defaults
  const speakers = settings.speakers ?? { diarize: true, voiceprints: true }
  return (
    <div className="flex flex-col gap-6">
      <RowGroup
        title={_('Transcription')}
        description={_('A second, more accurate pass replaces the live transcript line by line.')}
      >
        <SelectRow
          title={_('Accurate transcript')}
          options={finalPasses()}
          value={stt.finalPass}
          onChange={(finalPass) => patch({ stt: { finalPass } })}
        />
      </RowGroup>
      <RowGroup
        title={_('Speakers')}
        description={_(
          'Your microphone is always you. People you name are recognised by their voice in later meetings; voices stay on this computer.',
        )}
      >
        <SwitchRow
          title={_('Tell far-end speakers apart')}
          subtitle={_('Label each voice on the other side as its own speaker')}
          value={speakers.diarize}
          onChange={(diarize) => patch({ speakers: { diarize } })}
        />
      </RowGroup>
      <RowGroup title={_('Capture')} description={_('Used for recordings started from now on.')}>
        <SelectRow
          title={_('Microphone')}
          options={deviceChoices(devices, 'source', capture.micDevice)}
          value={capture.micDevice}
          onChange={(micDevice) => patch({ capture: { micDevice } })}
        />
        <SelectRow
          title={_('System audio')}
          subtitle={_('What the other people in the call sound like')}
          options={deviceChoices(devices, 'sink', capture.systemDevice)}
          value={capture.systemDevice}
          onChange={(systemDevice) => patch({ capture: { systemDevice } })}
        />
      </RowGroup>
      <RowGroup
        title={_('Auto-record')}
        description={_(
          'Start recording on its own. A recording that is already running is never interrupted.',
        )}
      >
        <SwitchRow
          title={_('When a calendar meeting starts')}
          subtitle={_('Meetings you declined, and all-day events, are skipped')}
          value={autoRecord.calendar}
          onChange={(calendar) => patch({ autoRecord: { calendar } })}
        />
        {autoRecord.calendar ? (
          <SelectRow
            title={_('Which meetings')}
            subtitle={_(
              'Judged from the event and what you recorded before. You get a notification when one is left alone.',
            )}
            options={[
              { value: 'likely', label: _('The ones you’d want recorded') },
              { value: 'all', label: _('Every meeting') },
            ]}
            value={autoRecord.calendarFilter ?? 'likely'}
            onChange={(calendarFilter) => patch({ autoRecord: { calendarFilter } })}
          />
        ) : null}
        <SwitchRow
          title={_('When another app uses the microphone')}
          subtitle={_('Stops again once the call has ended')}
          value={autoRecord.micActivity}
          onChange={(micActivity) => patch({ autoRecord: { micActivity } })}
        />
      </RowGroup>
      <AdvancedGroup />
    </div>
  )
}

function Storage({ settings, patch }: { settings: Settings; patch: (p: SettingsPatch) => void }) {
  const { retention } = settings
  return (
    <RowGroup
      title={_('Recorded audio')}
      description={_('Transcripts are always kept. This only decides what happens to the audio.')}
    >
      <SelectRow
        title={_('Audio')}
        options={retentions()}
        value={retention.audio}
        onChange={(audio) => patch({ retention: { audio } })}
      />
      {retention.audio === 'delete-after-days' ? (
        <Row title={_('Days to keep audio')}>
          <NumberField
            label={_('Days to keep audio')}
            labelHidden
            minValue={1}
            maxValue={3650}
            value={retention.days}
            onChange={(n) => {
              const days = Math.round(n)
              if (days >= 1 && days !== retention.days) patch({ retention: { days } })
            }}
          />
        </Row>
      ) : null}
      <SwitchRow
        title={_('Archive audio')}
        subtitle={_('Keep a small compressed copy of each recording')}
        value={retention.archive}
        onChange={(archive) => patch({ retention: { archive } })}
      />
    </RowGroup>
  )
}

function Integration() {
  return (
    <RowGroup title={_('Desktop integration')} description={_('Make kacola available outside this window.')}>
      <CliInstallRow />
      <ExtensionRow />
      <BackgroundRow />
    </RowGroup>
  )
}

export function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const { api, queries, queryClient } = useServices()
  const toast = useToast()
  // fresh values every time the dialog opens; events keep them fresh while it is open
  const settings = useQuery({ ...queries.settings(), refetchOnMount: 'always' })
  const devices = useQuery(queries.devices())
  const update = useMutation(updateSettingsMutation(api, queryClient))
  const [tab, setTab] = useState<'general' | 'storage' | 'integration'>('general')
  const patch = (p: SettingsPatch) =>
    update.mutate(p, {
      onError: (e) =>
        toast(fmt(_('Could not save the setting: {reason}'), { reason: reasonOf(e) }), { tone: 'error' }),
    })

  let body: ReactNode
  if (settings.data) {
    body = (
      <>
        <TabPanel id="general">
          <General settings={settings.data} devices={devices.data ?? []} patch={patch} />
        </TabPanel>
        <TabPanel id="storage">
          <Storage settings={settings.data} patch={patch} />
        </TabPanel>
        <TabPanel id="integration">
          <Integration />
        </TabPanel>
      </>
    )
  } else if (settings.isError) {
    body = (
      <EmptyState
        compact
        headingLevel={2}
        icon="warning"
        title={_('Settings unavailable')}
        description={_('kacola’s background service did not answer. Close this and try again.')}
      />
    )
  } else {
    body = (
      <div className="flex justify-center py-10">
        <Spinner label={_('Loading settings')} />
      </div>
    )
  }

  return (
    <Dialog title={_('Preferences')} isOpen onOpenChange={(o) => !o && onClose()} size="lg">
      <Tabs selectedKey={tab} onSelectionChange={setTab}>
        <TabList
          label={_('Preferences pages')}
          className="mb-4"
          tabs={[
            { id: 'general', label: _('General'), icon: 'settings' },
            { id: 'storage', label: _('Storage'), icon: 'storage' },
            { id: 'integration', label: _('Integration'), icon: 'terminal' },
          ]}
        />
        {body}
      </Tabs>
    </Dialog>
  )
}
