import type { AudioDevice, Settings, SettingsPatch } from '@gnomeola/protocol'
import * as Gtk from '@gtkx/gi/gtk'
import {
  AdwActionRow,
  AdwComboRow,
  AdwEntryRow,
  AdwPasswordEntryRow,
  AdwPreferencesDialog,
  AdwPreferencesGroup,
  AdwPreferencesPage,
  AdwSpinner,
  AdwSpinRow,
  AdwStatusPage,
  AdwSwitchRow,
} from '@gtkx/jsx/adw'
import { GtkButton, GtkStringList } from '@gtkx/jsx/gtk'
import { useEffect, useMemo, useState } from 'react'
import { escapeMarkup } from '../data/format.ts'
import { useSettings, useStore } from '../data/hooks.ts'
import {
  type Choice,
  deviceChoices,
  FINAL_PASS,
  indexOf,
  PROVIDERS,
  RETENTION,
  valueAt,
} from '../data/settings.ts'
import { _, fmt } from '../i18n/index.ts'
import { useToast } from './toasts.tsx'

// S-3: every daemon setting the UI owns, applied as soon as it changes (GNOME style: no OK button).
// Values are read from the store, which folds `settings.updated` events — so a change made by the
// CLI or another window shows up here live, and what is on screen is always what the daemon holds.
//
// The API key is write-only: the entry starts empty, is cleared once the key is stored, and the only
// thing ever shown is whether a key is configured.

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

function Combo<T extends string>({
  title,
  subtitle,
  choices,
  value,
  onChange,
}: {
  title: string
  subtitle?: string
  choices: readonly Choice<T>[]
  value: T
  onChange: (v: T) => void
}) {
  const labels = useMemo(() => choices.map((c) => c.label), [choices])
  return (
    <AdwComboRow
      title={title}
      subtitle={subtitle ?? ''}
      useMarkup={false}
      model={<GtkStringList strings={labels} />}
      selected={indexOf(choices, value)}
      onNotifySelected={(i) => {
        const v = valueAt(choices, Number(i))
        if (v !== undefined && v !== value) onChange(v)
      }}
    />
  )
}

function ApiKeyRows({ configured }: { configured: boolean }) {
  const store = useStore()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const save = async (key: string | null, entry?: { setText: (s: string) => void }) => {
    setBusy(true)
    try {
      const ok = await store.setApiKey(key)
      entry?.setText('')
      toast(key === null ? _('API key removed') : ok ? _('API key saved') : _('The API key was not stored'))
    } catch (e) {
      toast(fmt(_('Could not store the API key: {reason}'), { reason: errorText(e) }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <AdwActionRow
        title={_('Anthropic API key')}
        subtitle={configured ? _('Configured (kept in the keyring, never shown)') : _('Not configured')}
        useMarkup={false}
        suffix={
          configured ? (
            <GtkButton
              label={_('Remove')}
              valign={Gtk.Align.CENTER}
              cssClasses={['flat', 'destructive-action']}
              sensitive={!busy}
              accessibleDescription={_('Remove the stored API key')}
              onClicked={() => void save(null)}
            />
          ) : undefined
        }
      />
      <AdwPasswordEntryRow
        title={configured ? _('Replace API key') : _('API key')}
        showApplyButton
        sensitive={!busy}
        onApply={(self) => {
          const key = self.getText().trim()
          if (key) void save(key, self)
        }}
      />
    </>
  )
}

function Loaded({ settings, devices }: { settings: Settings; devices: AudioDevice[] }) {
  const store = useStore()
  const toast = useToast()
  const patch = (p: SettingsPatch) => {
    store.updateSettings(p).catch((e: unknown) => {
      toast(fmt(_('Could not save the setting: {reason}'), { reason: errorText(e) }))
    })
  }
  // one adjustment for the row's lifetime; its value is driven by the `value` prop below
  const [days] = useState(() => Gtk.Adjustment.new(settings.retention.days, 1, 3650, 1, 7, 0))
  const mics = deviceChoices(devices, 'source', settings.capture.micDevice)
  const outputs = deviceChoices(devices, 'sink', settings.capture.systemDevice)
  const { llm, stt, capture, retention } = settings

  return (
    <>
      <AdwPreferencesPage title={_('General')} iconName="preferences-system-symbolic" name="general">
        <AdwPreferencesGroup
          title={_('Questions and Answers')}
          description={_('The language model that answers questions about your meetings.')}
        >
          <Combo
            title={_('Provider')}
            choices={PROVIDERS}
            value={llm.provider}
            onChange={(provider) => patch({ llm: { provider } })}
          />
          {llm.provider !== 'none' ? (
            <AdwEntryRow
              title={_('Model')}
              text={llm.model}
              showApplyButton
              onApply={(self) => {
                const model = self.getText().trim()
                if (model && model !== llm.model) patch({ llm: { model } })
              }}
            />
          ) : null}
          {llm.provider === 'ollama' ? (
            <AdwEntryRow
              title={_('Ollama URL')}
              text={llm.ollamaUrl}
              inputPurpose={Gtk.InputPurpose.URL}
              showApplyButton
              onApply={(self) => {
                const url = self.getText().trim()
                if (url && url !== llm.ollamaUrl) patch({ llm: { ollamaUrl: url } })
              }}
            />
          ) : null}
          {llm.provider === 'anthropic' ? <ApiKeyRows configured={llm.apiKeyConfigured} /> : null}
        </AdwPreferencesGroup>
        <AdwPreferencesGroup
          title={_('Transcription')}
          description={_('A second, more accurate pass replaces the live transcript line by line.')}
        >
          <Combo
            title={_('Accurate pass')}
            choices={FINAL_PASS}
            value={stt.finalPass}
            onChange={(finalPass) => patch({ stt: { finalPass } })}
          />
        </AdwPreferencesGroup>
        <AdwPreferencesGroup title={_('Capture')} description={_('Used for recordings started from now on.')}>
          <Combo
            title={_('Microphone')}
            choices={mics}
            value={capture.micDevice}
            onChange={(micDevice) => patch({ capture: { micDevice } })}
          />
          <Combo
            title={_('System audio')}
            subtitle={_('What the other people in the call sound like')}
            choices={outputs}
            value={capture.systemDevice}
            onChange={(systemDevice) => patch({ capture: { systemDevice } })}
          />
        </AdwPreferencesGroup>
      </AdwPreferencesPage>
      <AdwPreferencesPage title={_('Storage')} iconName="drive-harddisk-symbolic" name="storage">
        <AdwPreferencesGroup
          title={_('Recorded Audio')}
          description={_('Transcripts are always kept. This only decides what happens to the audio.')}
        >
          <Combo
            title={_('Audio')}
            choices={RETENTION}
            value={retention.audio}
            onChange={(audio) => patch({ retention: { audio } })}
          />
          {retention.audio === 'delete-after-days' ? (
            <AdwSpinRow
              title={_('Days to keep audio')}
              adjustment={days}
              value={retention.days}
              onNotifyValue={(v) => {
                const n = Math.round(Number(v))
                if (n >= 1 && n !== retention.days) patch({ retention: { days: n } })
              }}
            />
          ) : null}
          <AdwSwitchRow
            title={_('Archive audio')}
            subtitle={_('Keep a compressed copy (Opus) of each recording')}
            active={retention.archive}
            onNotifyActive={(v) => {
              if (Boolean(v) !== retention.archive) patch({ retention: { archive: Boolean(v) } })
            }}
          />
        </AdwPreferencesGroup>
      </AdwPreferencesPage>
    </>
  )
}

export function PreferencesDialog({ onClosed }: { onClosed: () => void }) {
  const store = useStore()
  const settings = useSettings()
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    // fresh values every time the dialog opens; events keep them fresh while it is open
    store.refreshSettings(ac.signal).then((s) => {
      if (!s && !ac.signal.aborted && !store.getSnapshot().settings) {
        setFailed(_('The daemon did not return its settings.'))
      }
    })
    store.api
      .listDevices(ac.signal)
      .then((d) => {
        if (!ac.signal.aborted) setDevices(d)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [store])

  return (
    <AdwPreferencesDialog title={_('Preferences')} searchEnabled onClosed={onClosed}>
      {settings ? (
        <Loaded settings={settings} devices={devices} />
      ) : (
        <AdwPreferencesPage title={_('General')} iconName="preferences-system-symbolic">
          <AdwPreferencesGroup>
            {failed ? (
              <AdwStatusPage
                iconName="dialog-warning-symbolic"
                title={_('Settings Unavailable')}
                description={escapeMarkup(failed)}
              />
            ) : (
              <AdwSpinner widthRequest={32} heightRequest={32} halign={Gtk.Align.CENTER} />
            )}
          </AdwPreferencesGroup>
        </AdwPreferencesPage>
      )}
    </AdwPreferencesDialog>
  )
}
