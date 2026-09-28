import * as Adw from '@gtkx/gi/adw'
import * as Gtk from '@gtkx/gi/gtk'
import {
  AdwAboutDialog,
  AdwActionRow,
  AdwAlertDialog,
  AdwApplication,
  AdwApplicationWindow,
  AdwClamp,
  AdwComboRow,
  AdwEntryRow,
  AdwHeaderBar,
  AdwPreferencesDialog,
  AdwPreferencesGroup,
  AdwPreferencesPage,
  AdwSwitchRow,
  AdwToolbarView,
} from '@gtkx/jsx/adw'
import {
  GtkBox,
  GtkButton,
  GtkEntry,
  GtkLabel,
  GtkLevelBar,
  GtkListBox,
  GtkScrolledWindow,
  GtkStringList,
  GtkSwitch,
  GtkTextBuffer,
  GtkTextView,
} from '@gtkx/jsx/gtk'
import { quit } from '@gtkx/react'
import { useState } from 'react'
import { ToastHost, useToast } from './components/toasts.tsx'

// GNOMEOLA_UI_GALLERY=1: every widget pattern docs/gtkx.md recommends, on one screen, so the
// patterns are typechecked by `pnpm typecheck` and exercised by the headless e2e suite
// (packages/testkit/src/ui/e2e/gnomeola-ui.e2e.test.ts). Not part of the product UI.

const MODELS = ['tiny.en (fast)', 'base.en', 'small.en (accurate)']

function GalleryBody() {
  const toast = useToast()
  const [autoRecord, setAutoRecord] = useState(false)
  const [privateMode, setPrivateMode] = useState(false)
  const [model, setModel] = useState(0)
  const [url, setUrl] = useState('http://127.0.0.1:8787')
  const [speaker, setSpeaker] = useState('')
  const [dialog, setDialog] = useState<'about' | 'prefs' | 'confirm' | null>(null)
  const [lastAction, setLastAction] = useState('none')

  return (
    <AdwToolbarView
      topBar={
        <AdwHeaderBar
          start={
            <GtkButton
              iconName="preferences-system-symbolic"
              accessibleLabel="Preferences"
              tooltipText="Preferences"
              onClicked={() => setDialog('prefs')}
            />
          }
          end={
            <GtkButton
              iconName="help-about-symbolic"
              accessibleLabel="About gnomeola"
              tooltipText="About gnomeola"
              onClicked={() => setDialog('about')}
            />
          }
        />
      }
    >
      <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
        <AdwClamp maximumSize={640} marginTop={18} marginBottom={18} marginStart={12} marginEnd={12}>
          <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={18}>
            <GtkListBox
              cssClasses={['boxed-list']}
              selectionMode={Gtk.SelectionMode.NONE}
              accessibleLabel="Settings"
            >
              <AdwSwitchRow
                title="Auto-record meetings"
                active={autoRecord}
                onNotifyActive={(v) => setAutoRecord(Boolean(v))}
              />
              <AdwComboRow
                title="Live model"
                model={<GtkStringList strings={MODELS} />}
                selected={model}
                onNotifySelected={(v) => setModel(Number(v))}
              />
              <AdwEntryRow
                title="Daemon URL"
                text={url}
                showApplyButton
                onApply={(self) => setUrl(self.getText())}
              />
              <AdwActionRow
                title="Speaker labels"
                subtitle="Suffix widgets go in `suffix`, never in children"
                useMarkup={false}
                suffix={<GtkLabel label="me / them" cssClasses={['dim-label']} />}
              />
            </GtkListBox>
            <GtkBox spacing={12}>
              <GtkLabel label="Private" />
              <GtkSwitch
                accessibleLabel="Private"
                active={privateMode}
                onNotifyActive={(v) => setPrivateMode(Boolean(v))}
                valign={Gtk.Align.CENTER}
              />
              <GtkLevelBar hexpand valign={Gtk.Align.CENTER} value={0.6} accessibleLabel="Input level" />
            </GtkBox>
            <GtkEntry
              placeholderText="Speaker name"
              accessibleLabel="Speaker name"
              text={speaker}
              onChanged={(self) => setSpeaker(self.getText())}
            />
            <GtkScrolledWindow minContentHeight={120} hasFrame>
              <GtkTextView
                editable={false}
                cursorVisible={false}
                wrapMode={Gtk.WrapMode.WORD_CHAR}
                accessibleLabel="Transcript"
                topMargin={8}
                bottomMargin={8}
                leftMargin={8}
                rightMargin={8}
              >
                <GtkTextBuffer text={'me: shall we start?\nthem: yes, recording now.'} />
              </GtkTextView>
            </GtkScrolledWindow>
            <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
              <GtkButton
                label="Show Toast"
                cssClasses={['pill']}
                onClicked={() => toast('Saved “Weekly sync & retro”')}
              />
              <GtkButton
                label="Delete…"
                cssClasses={['pill', 'destructive-action']}
                onClicked={() => setDialog('confirm')}
              />
            </GtkBox>
            <GtkLabel
              label={`auto-record: ${autoRecord ? 'on' : 'off'} · private: ${privateMode ? 'on' : 'off'} · model: ${MODELS[model]} · url: ${url} · speaker: ${speaker || '—'} · last action: ${lastAction}`}
              wrap
              cssClasses={['dim-label', 'caption']}
              accessibleLabel="Gallery state"
              accessibleDescription="Summary of every control's value, for tests"
            />
          </GtkBox>
        </AdwClamp>
      </GtkScrolledWindow>

      {/* Dialogs present on mount and close on unmount; onClosed keeps React in charge. */}
      {dialog === 'about' ? (
        <AdwAboutDialog
          applicationName="gnomeola"
          applicationIcon="audio-input-microphone-symbolic"
          version="0.1.0"
          developerName="The gnomeola contributors"
          licenseType={Gtk.License.GPL_3_0}
          comments="A GNOME-native meeting recorder and transcriber."
          onClosed={() => setDialog(null)}
        />
      ) : null}
      {dialog === 'prefs' ? (
        <AdwPreferencesDialog title="Preferences" onClosed={() => setDialog(null)}>
          <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
            <AdwPreferencesGroup title="Recording" description="Applies to new sessions">
              <AdwSwitchRow
                title="Record system audio"
                active
                onNotifyActive={(v) => setLastAction(`system audio ${v ? 'on' : 'off'}`)}
              />
            </AdwPreferencesGroup>
          </AdwPreferencesPage>
        </AdwPreferencesDialog>
      ) : null}
      {dialog === 'confirm' ? (
        <AdwAlertDialog
          heading="Delete Session?"
          body="The recording and its transcript will be removed."
          closeResponse="cancel"
          defaultResponse="cancel"
          responses={[
            { id: 'cancel', label: 'Cancel' },
            { id: 'delete', label: 'Delete', appearance: Adw.ResponseAppearance.DESTRUCTIVE },
          ]}
          onResponse={(id) => {
            setLastAction(id === 'delete' ? 'deleted' : 'kept')
            setDialog(null)
          }}
        />
      ) : null}
    </AdwToolbarView>
  )
}

export function Gallery() {
  return (
    <AdwApplication>
      <AdwApplicationWindow
        title="Widget gallery"
        defaultWidth={900}
        defaultHeight={760}
        onCloseRequest={quit}
      >
        <ToastHost>
          <GalleryBody />
        </ToastHost>
      </AdwApplicationWindow>
    </AdwApplication>
  )
}
