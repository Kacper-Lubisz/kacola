import type { AudioDevice, DecisionsProvider, Settings, SettingsPatch } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'
import { deviceChoices, finalPasses, providers, retentions } from '@gnomeola/ui-core/settings'
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
  TextField,
  useToast,
} from '../../design/primitives/index.ts'
import { BackgroundRow, CliInstallRow, ExtensionRow } from './integration-rows.tsx'
import { setApiKeyMutation, updateSettingsMutation } from './settings-data.ts'

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
function ApplyField({
  label,
  value,
  type = 'text',
  onApply,
}: {
  label: string
  value: string
  type?: 'text' | 'url'
  onApply: (v: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const dirty = draft !== null && draft.trim() !== '' && draft.trim() !== value
  const apply = () => {
    if (dirty) onApply(draft.trim())
    setDraft(null)
  }
  return (
    <div className="flex items-end gap-2">
      <TextField
        label={label}
        labelHidden
        type={type}
        className="min-w-0 flex-1"
        value={draft ?? value}
        onChange={setDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply()
        }}
      />
      <Button onPress={apply} isDisabled={!dirty} aria-label={fmt(_('Apply {setting}'), { setting: label })}>
        {_('Apply')}
      </Button>
    </div>
  )
}

function ApiKeyRows({
  configured,
  title,
  provider,
}: {
  configured: boolean
  title: string
  /** Which keyring account (default: the text LLM's current provider). */
  provider?: 'anthropic' | 'openai' | 'typesafe'
}) {
  const { api, queryClient } = useServices()
  const toast = useToast()
  const setKey = useMutation(setApiKeyMutation(api, queryClient))
  const [key, setKeyText] = useState('')
  const save = (value: string | null) =>
    setKey.mutate(provider ? { key: value, provider } : value, {
      onSuccess: (r) => {
        setKeyText('')
        toast(
          value === null
            ? _('API key removed')
            : r.configured
              ? _('API key saved')
              : _('The API key was not stored'),
        )
      },
      onError: (e) =>
        toast(fmt(_('Could not store the API key: {reason}'), { reason: reasonOf(e) }), { tone: 'error' }),
    })
  const label = configured ? _('Replace API key') : _('API key')
  return (
    <>
      <Row
        title={title}
        subtitle={configured ? _('Configured (kept in the keyring, never shown)') : _('Not configured')}
      >
        {configured ? (
          <Button
            variant="destructive"
            size="sm"
            isDisabled={setKey.isPending}
            aria-description={_('Remove the stored API key')}
            onPress={() => save(null)}
          >
            {_('Remove')}
          </Button>
        ) : null}
      </Row>
      <Row title={label} stacked>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (key.trim() && !setKey.isPending) save(key.trim())
          }}
        >
          <TextField
            label={label}
            labelHidden
            type="password"
            autoComplete="off"
            placeholder={_('Paste a key')}
            className="min-w-0 flex-1"
            value={key}
            onChange={setKeyText}
          />
          <Button type="submit" variant="primary" isDisabled={!key.trim() || setKey.isPending}>
            {_('Save')}
          </Button>
        </form>
      </Row>
    </>
  )
}

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
        className="w-[230px] max-w-[50vw]"
      />
    </Row>
  )
}

const decisionProviders = (): { value: DecisionsProvider; label: string }[] => [
  { value: 'local', label: _('On this computer') },
  { value: 'jev', label: _('TypeSafe Jev') },
  { value: 'openai', label: _('OpenAI') },
  { value: 'anthropic', label: _('Anthropic') },
  { value: 'ollama', label: _('Ollama') },
]

/**
 * The live decisions (agendas: is this item covered? which point next? did they answer?): a typed-decision
 * provider of its own, separate from the language model above. /health says whether it can answer, and
 * why not ("on-device model not downloaded").
 */
function DecisionsGroup({ settings, patch }: { settings: Settings; patch: (p: SettingsPatch) => void }) {
  const { queries } = useServices()
  const health = useQuery({ ...queries.health(), refetchOnMount: 'always' })
  const d = settings.decisions ?? { provider: 'local' as const, model: '', apiKeyConfigured: false }
  const status = health.data?.decisions
  const ready =
    status && status.provider === d.provider
      ? status.ready
        ? (status.detail ?? _('Ready'))
        : (status.detail ?? _('Not ready'))
      : undefined
  return (
    <RowGroup
      title={_('Live decisions')}
      description={_(
        'Checks agenda items off, picks the next talking point and hears answers during a meeting.',
      )}
    >
      <SelectRow
        title={_('Decisions provider')}
        subtitle={ready}
        options={decisionProviders()}
        value={d.provider}
        onChange={(provider) => patch({ decisions: { provider } })}
      />
      {d.provider !== 'local' ? (
        <Row title={_('Decision model')} subtitle={d.model ? undefined : _('The provider’s default')} stacked>
          <ApplyField
            label={_('Decision model')}
            value={d.model}
            onApply={(model) => patch({ decisions: { model } })}
          />
        </Row>
      ) : null}
      {d.provider === 'jev' ? (
        <ApiKeyRows
          key="typesafe"
          provider="typesafe"
          configured={d.apiKeyConfigured}
          title={_('TypeSafe API key')}
        />
      ) : d.provider === 'openai' || d.provider === 'anthropic' ? (
        <Row
          title={d.provider === 'openai' ? _('OpenAI API key') : _('Anthropic API key')}
          subtitle={
            d.apiKeyConfigured
              ? _('Shared with the language model (configured)')
              : _('Not configured: set it above, under Questions and Answers')
          }
        />
      ) : null}
    </RowGroup>
  )
}

function General({
  settings,
  devices,
  patch,
}: {
  settings: Settings
  devices: AudioDevice[]
  patch: (p: SettingsPatch) => void
}) {
  const { llm, stt, capture, autoRecord } = settings
  // optional in the schema (settings stored before M3): the daemon's defaults
  const speakers = settings.speakers ?? { diarize: true, voiceprints: false }
  return (
    <div className="flex flex-col gap-6">
      <RowGroup
        title={_('Questions and Answers')}
        description={_('The language model that answers questions about your meetings.')}
      >
        <SelectRow
          title={_('Provider')}
          options={providers()}
          value={llm.provider}
          onChange={(provider) => patch({ llm: { provider } })}
        />
        {llm.provider !== 'none' ? (
          <Row title={_('Model')} subtitle={llm.model ? undefined : _('The provider’s default')} stacked>
            <ApplyField label={_('Model')} value={llm.model} onApply={(model) => patch({ llm: { model } })} />
          </Row>
        ) : null}
        {llm.provider === 'ollama' ? (
          <Row title={_('Ollama URL')} stacked>
            <ApplyField
              label={_('Ollama URL')}
              type="url"
              value={llm.ollamaUrl}
              onApply={(ollamaUrl) => patch({ llm: { ollamaUrl } })}
            />
          </Row>
        ) : null}
        {llm.provider === 'anthropic' || llm.provider === 'openai' ? (
          <ApiKeyRows
            // keyed by provider: each has its own key, so switching must not carry an entry's text over
            key={llm.provider}
            configured={llm.apiKeyConfigured}
            title={llm.provider === 'anthropic' ? _('Anthropic API key') : _('OpenAI API key')}
          />
        ) : null}
      </RowGroup>
      <DecisionsGroup settings={settings} patch={patch} />
      <RowGroup
        title={_('Transcription')}
        description={_('A second, more accurate pass replaces the live transcript line by line.')}
      >
        <SelectRow
          title={_('Accurate pass')}
          options={finalPasses()}
          value={stt.finalPass}
          onChange={(finalPass) => patch({ stt: { finalPass } })}
        />
      </RowGroup>
      <RowGroup
        title={_('Speakers')}
        description={_('Your microphone is always you. These decide what happens to the other side.')}
      >
        <SwitchRow
          title={_('Tell far-end speakers apart')}
          subtitle={_('Label each voice on the other side as its own speaker')}
          value={speakers.diarize}
          onChange={(diarize) => patch({ speakers: { diarize } })}
        />
        <SwitchRow
          title={_('Recognise people across meetings')}
          subtitle={_(
            'Remember the voices of people you name, so they are named in later meetings. Voices are stored only on this computer; turning this off forgets them all.',
          )}
          value={speakers.voiceprints}
          onChange={(voiceprints) => patch({ speakers: { voiceprints } })}
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
          title={_('When a Calendar Meeting Starts')}
          subtitle={_('Meetings you declined, and all-day events, are skipped')}
          value={autoRecord.calendar}
          onChange={(calendar) => patch({ autoRecord: { calendar } })}
        />
        <SwitchRow
          title={_('When Another App Uses the Microphone')}
          subtitle={_('Stops again once the call has ended')}
          value={autoRecord.micActivity}
          onChange={(micActivity) => patch({ autoRecord: { micActivity } })}
        />
      </RowGroup>
    </div>
  )
}

function Storage({ settings, patch }: { settings: Settings; patch: (p: SettingsPatch) => void }) {
  const { retention } = settings
  return (
    <RowGroup
      title={_('Recorded Audio')}
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
        subtitle={_('Keep a compressed copy (Opus) of each recording')}
        value={retention.archive}
        onChange={(archive) => patch({ retention: { archive } })}
      />
    </RowGroup>
  )
}

function Integration() {
  return (
    <RowGroup
      title={_('Desktop Integration')}
      description={_('Make gnomeola available outside this window.')}
    >
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
        title={_('Settings Unavailable')}
        description={_('The daemon did not return its settings.')}
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
