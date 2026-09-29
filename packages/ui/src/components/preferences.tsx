import type { AudioDevice, Settings, SettingsPatch } from '@gnomeola/protocol'
import type * as Adw from '@gtkx/gi/adw'
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
  AdwStatusPage,
  AdwSwitchRow,
} from '@gtkx/jsx/adw'
import { GtkButton, GtkSpinButton, GtkStringList } from '@gtkx/jsx/gtk'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { escapeMarkup } from '../data/format.ts'
import { useSettings, useStore } from '../data/hooks.ts'
import {
  type Choice,
  deviceChoices,
  finalPasses,
  indexOf,
  providers,
  retentions,
  valueAt,
} from '../data/settings.ts'
import { _, fmt } from '../i18n/index.ts'
import { nameGroupList } from './a11y.ts'
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
  // Memoised by content, not identity: callers rebuild `choices` every render, and GtkStringList's
  // `strings` is construct-only — GTKX throws (and the app dies) if it sees a "new" list.
  const key = choices.map((c) => c.label).join('\n')
  const labels = useMemo(() => key.split('\n'), [key])
  const index = indexOf(choices, value)
  // Controlled by hand, not with a `selected` prop: GTKX applies `model` after `selected`, and
  // setting the model resets the selection to 0 AND emits notify::selected — so a `selected` prop
  // plus onNotifySelected wrote the FIRST option back to the daemon every time Preferences opened
  // (caught by the e2e run: retention silently reset to "Keep"). Notifications are ignored until
  // the real value has been applied, and while we apply it.
  const row = useRef<Adw.ComboRow | null>(null)
  const applying = useRef(true)
  useLayoutEffect(() => {
    const r = row.current
    // (re-run when the choices change: `key` remounts the row, and the new one needs its value)
    if (!r || key === '') return
    applying.current = true
    if (r.getSelected() !== index) r.setSelected(index)
    applying.current = false
  }, [index, key])
  return (
    <AdwComboRow
      ref={row}
      // …and a genuinely different list (devices plugged in) builds a new row
      key={key}
      title={title}
      subtitle={subtitle ?? ''}
      useMarkup={false}
      model={<GtkStringList strings={labels} />}
      onNotifySelected={(i) => {
        if (applying.current) return
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
        // stays sensitive while saving: an insensitive row would throw keyboard focus elsewhere
        onApply={(self) => {
          const key = self.getText().trim()
          if (key && !busy) void save(key, self)
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
  const { llm, stt, capture, retention, autoRecord } = settings
  // optional in the schema (settings stored before M3): the daemon's defaults
  const speakers = settings.speakers ?? { diarize: true, voiceprints: false }

  return (
    <>
      <AdwPreferencesPage title={_('General')} iconName="preferences-system-symbolic" name="general">
        <AdwPreferencesGroup
          ref={nameGroupList(_('Questions and Answers'))}
          title={_('Questions and Answers')}
          description={_('The language model that answers questions about your meetings.')}
        >
          <Combo
            title={_('Provider')}
            choices={providers()}
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
          ref={nameGroupList(_('Transcription'))}
          title={_('Transcription')}
          description={_('A second, more accurate pass replaces the live transcript line by line.')}
        >
          <Combo
            title={_('Accurate pass')}
            choices={finalPasses()}
            value={stt.finalPass}
            onChange={(finalPass) => patch({ stt: { finalPass } })}
          />
        </AdwPreferencesGroup>
        <AdwPreferencesGroup
          ref={nameGroupList(_('Speakers'))}
          title={_('Speakers')}
          description={_('Your microphone is always you. These decide what happens to the other side.')}
        >
          <AdwSwitchRow
            title={_('Tell far-end speakers apart')}
            subtitle={_('Label each voice on the other side as its own speaker')}
            active={speakers.diarize}
            onNotifyActive={(v) => {
              if (Boolean(v) !== speakers.diarize) patch({ speakers: { diarize: Boolean(v) } })
            }}
          />
          <AdwSwitchRow
            title={_('Recognise people across meetings')}
            subtitle={_(
              'Remember the voices of people you name, so they are named in later meetings. Voices are stored only on this computer; turning this off forgets them all.',
            )}
            active={speakers.voiceprints}
            onNotifyActive={(v) => {
              if (Boolean(v) !== speakers.voiceprints) patch({ speakers: { voiceprints: Boolean(v) } })
            }}
          />
        </AdwPreferencesGroup>
        <AdwPreferencesGroup
          ref={nameGroupList(_('Capture'))}
          title={_('Capture')}
          description={_('Used for recordings started from now on.')}
        >
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
        <AdwPreferencesGroup
          ref={nameGroupList(_('Auto-record'))}
          title={_('Auto-record')}
          description={_(
            'Start recording on its own. A recording that is already running is never interrupted.',
          )}
        >
          <AdwSwitchRow
            title={_('When a Calendar Meeting Starts')}
            subtitle={_('Meetings you declined, and all-day events, are skipped')}
            active={autoRecord.calendar}
            onNotifyActive={(v) => {
              if (Boolean(v) !== autoRecord.calendar) patch({ autoRecord: { calendar: Boolean(v) } })
            }}
          />
          <AdwSwitchRow
            title={_('When Another App Uses the Microphone')}
            subtitle={_('Stops again once the call has ended')}
            active={autoRecord.micActivity}
            onNotifyActive={(v) => {
              if (Boolean(v) !== autoRecord.micActivity) patch({ autoRecord: { micActivity: Boolean(v) } })
            }}
          />
        </AdwPreferencesGroup>
      </AdwPreferencesPage>
      <AdwPreferencesPage title={_('Storage')} iconName="drive-harddisk-symbolic" name="storage">
        <AdwPreferencesGroup
          ref={nameGroupList(_('Recorded Audio'))}
          title={_('Recorded Audio')}
          description={_('Transcripts are always kept. This only decides what happens to the audio.')}
        >
          <Combo
            title={_('Audio')}
            choices={retentions()}
            value={retention.audio}
            onChange={(audio) => patch({ retention: { audio } })}
          />
          {retention.audio === 'delete-after-days' ? (
            // An action row with a spin button suffix, not AdwSpinRow: libadwaita 1.9's spin row is
            // missing from the AT-SPI tree entirely (visible on screen, absent to a screen reader).
            <AdwActionRow
              title={_('Days to keep audio')}
              useMarkup={false}
              suffix={
                <GtkSpinButton
                  valign={Gtk.Align.CENTER}
                  adjustment={days}
                  numeric
                  value={retention.days}
                  accessibleLabel={_('Days to keep audio')}
                  onNotifyValue={(v) => {
                    const n = Math.round(Number(v))
                    if (n >= 1 && n !== retention.days) patch({ retention: { days: n } })
                  }}
                />
              }
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
          <AdwPreferencesGroup ref={nameGroupList(_('Settings'))}>
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
