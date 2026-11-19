import { useEffect, useId, useState, type ReactNode } from 'react'
import {
  ACCENT_PRESETS,
  DEFAULT_MINI_PLAYER_SHORTCUT,
  hasNewVersion,
  roundMixSize,
  SOUND_KEY,
  SOUND_KEY_URL,
  TOP_MIX,
  type AccentChoice,
  type MotionChoice,
  type NewVersion,
  type PreferenceChanges,
  type UpdateStatus
} from '@shared/api'
import { shortcutFor, shortcutLabel } from '@shared/shortcut'
import { Button } from '@/components/Button/Button'
import { Panel } from '@/components/Panel/Panel'
import { Segmented } from '@/components/Segmented/Segmented'
import { Switch } from '@/components/Switch/Switch'
import { CloseIcon, FolderIcon } from '@/components/icons'
import { identify } from '@/store/identify'
import { library } from '@/store/library'
import { usePreferences } from '@/store/preferences'
import { useUpdateStatus } from '@/store/updates'
import views from '../views.module.css'
import styles from './settings.module.css'

const update = (changes: PreferenceChanges): void => void window.encore.preferences.update(changes)

const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta']

// Everything Encore lets you set, in a few short groups.
export function SettingsView() {
  const { miniPlayerShortcut, accent, motion, musicFolders, identifyNewSongs, startWithWindows, topMixSize, checkForUpdates } =
    usePreferences()
  const updateStatus = useUpdateStatus()

  return (
    <Panel label="Settings" header={<h2 className={views.heading}>Settings</h2>}>
      <div className={styles.page}>
        {hasNewVersion(updateStatus) && <UpdateCard update={updateStatus} />}
        <Section title="Mini player">
          <ShortcutSetting shortcut={miniPlayerShortcut} />
        </Section>
        <Section title="Look">
          <AccentSetting accent={accent} />
          <MotionSetting motion={motion} />
        </Section>
        <Section title="Home">
          <MixSizeSetting size={topMixSize} />
        </Section>
        <Section title="Music">
          <FolderSetting folders={musicFolders} />
          <SwitchSetting
            title="Identify new songs automatically"
            description="Looks up new songs that are missing an album or cover. You still review every match in Local files."
            checked={identifyNewSongs}
            onChange={(on) => update({ identifyNewSongs: on })}
          />
          <SoundKeySetting />
        </Section>
        <Section title="Startup">
          <StartupSetting on={startWithWindows} />
        </Section>
        <Section title="About">
          <AboutRow />
          <UpdatesRow update={updateStatus} automatic={checkForUpdates} />
          <SwitchSetting
            title="Check for updates automatically"
            description="Looks for a new version when Encore opens and every few hours. Nothing downloads until you say so."
            checked={checkForUpdates}
            onChange={(on) => update({ checkForUpdates: on })}
          />
        </Section>
      </div>
    </Panel>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.card}>{children}</div>
    </section>
  )
}

interface RowProps {
  title: string
  titleId?: string
  description: string
  // Sits to the right of the title and description.
  control?: ReactNode
  // Spans the full width below them.
  children?: ReactNode
}

function Row({ title, titleId, description, control, children }: RowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle} id={titleId}>
          {title}
        </span>
        <span className={styles.rowDescription}>{description}</span>
      </div>
      {control && <div className={styles.control}>{control}</div>}
      {children && <div className={styles.rowBody}>{children}</div>}
    </div>
  )
}

function SwitchSetting({ title, description, checked, onChange, disabled }: {
  title: string
  description: string
  checked: boolean
  onChange: (on: boolean) => void
  disabled?: boolean
}) {
  const titleId = useId()
  return (
    <Row
      title={title}
      titleId={titleId}
      description={description}
      control={<Switch checked={checked} onChange={onChange} labelledBy={titleId} disabled={disabled} />}
    />
  )
}

const RECORDING_HINT = 'Hold Ctrl, Alt, or the Windows key, then press one more key. Windows keeps a few for itself, like Alt + Space.'

// The modifier keys held down right now, as they're written on the keys.
const heldModifiers = (event: KeyboardEvent): string[] =>
  [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Win'].filter((key): key is string => Boolean(key))

// Shows the mini player shortcut as keys, and records a new one from the next key combination pressed.
// The keys held so far show up as they're pressed, so it's clear what Encore is hearing.
function ShortcutSetting({ shortcut }: { shortcut: string }) {
  const [recording, setRecording] = useState(false)
  const [held, setHeld] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return
    // The current shortcut steps aside, so pressing its keys reaches the recorder instead of opening the mini player.
    window.encore.preferences.pauseMiniPlayerShortcut(true)

    const onKeyDown = (event: KeyboardEvent): void => {
      // While recording, keys belong to the recorder, not to Space for play or Ctrl + F for search.
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        setMessage(null)
        return
      }
      setHeld(heldModifiers(event))
      if (MODIFIER_KEYS.includes(event.key)) return
      const next = shortcutFor(event)
      if (!next) {
        setMessage(RECORDING_HINT)
        return
      }
      setRecording(false)
      window.encore.preferences.setMiniPlayerShortcut(next).then((claimed) => {
        setMessage(claimed ? null : `${shortcutLabel(next)} is already used by Windows or another app. Try a different one.`)
      })
    }
    const onKeyUp = (event: KeyboardEvent): void => setHeld(heldModifiers(event))

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      setHeld([])
      window.encore.preferences.pauseMiniPlayerShortcut(false)
    }
  }, [recording])

  const reset = (): void => {
    setMessage(null)
    void window.encore.preferences.setMiniPlayerShortcut(DEFAULT_MINI_PLAYER_SHORTCUT)
  }

  const keys = recording
    ? held.length > 0
      ? [...held.map((key) => <kbd key={key}>{key}</kbd>), <span key="more">+ …</span>]
      : 'Press the new keys'
    : shortcutLabel(shortcut)
        .split(' + ')
        .map((key) => <kbd key={key}>{key}</kbd>)

  return (
    <Row
      title="Shortcut"
      description="Shows or hides the mini player from any app."
      control={
        <>
          <span className={styles.keys} data-recording={recording || undefined} aria-live="polite">
            {keys}
          </span>
          <Button
            size="small"
            onClick={() => {
              setMessage(recording ? null : RECORDING_HINT)
              setRecording(!recording)
            }}
          >
            {recording ? 'Cancel' : 'Change'}
          </Button>
          {!recording && shortcut !== DEFAULT_MINI_PLAYER_SHORTCUT && (
            <button className={styles.textButton} onClick={reset}>
              Reset
            </button>
          )}
        </>
      }
    >
      {message && <p className={styles.note}>{message}</p>}
    </Row>
  )
}

const ACCENT_OPTIONS: { value: AccentChoice; name: string; label: string }[] = [
  { value: 'album', name: 'Album', label: 'Follow the album cover' },
  ...ACCENT_PRESETS.map((preset) => ({ value: preset.color, name: preset.name, label: preset.name }))
]

function AccentSetting({ accent }: { accent: AccentChoice }) {
  return (
    <Row title="Accent color" description="Follows the cover of the song that's playing, or stays one color.">
      <div className={styles.swatches} role="radiogroup" aria-label="Accent color">
        {ACCENT_OPTIONS.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={accent === option.value}
            aria-label={option.label}
            className={styles.swatch}
            onClick={() => update({ accent: option.value })}
          >
            <span
              className={styles.swatchColor}
              data-album={option.value === 'album' || undefined}
              style={option.value === 'album' ? undefined : { background: option.value }}
            />
            <span className={styles.swatchName}>{option.name}</span>
          </button>
        ))}
      </div>
    </Row>
  )
}

const MOTION_OPTIONS: { value: MotionChoice; label: string }[] = [
  { value: 'system', label: 'Match Windows' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' }
]

// Whether Encore animates. Matching Windows follows its Animation effects setting, which some performance tools
// turn off without saying so.
function MotionSetting({ motion }: { motion: MotionChoice }) {
  const titleId = useId()
  return (
    <Row
      title="Motion"
      titleId={titleId}
      description="Covers fading in, views easing in, and long song names scrolling in the mini player. Match Windows follows its Animation effects setting."
      control={
        <Segmented labelledBy={titleId} options={MOTION_OPTIONS} value={motion} onChange={(next) => update({ motion: next })} />
      }
    />
  )
}

// The size of the top songs mix on Home. Whatever is typed rounds to the nearest five once you're done typing.
function MixSizeSetting({ size }: { size: number }) {
  const titleId = useId()
  const [text, setText] = useState(String(size))
  useEffect(() => setText(String(size)), [size])

  const commit = (): void => {
    const next = roundMixSize(Number(text), size)
    setText(String(next))
    if (next !== size) update({ topMixSize: next })
  }

  return (
    <Row
      title="Top songs mix size"
      titleId={titleId}
      description={`How many of your most played songs go in the mix on Home, from ${TOP_MIX.min} to ${TOP_MIX.max}. It rounds to the nearest ${TOP_MIX.step}.`}
      control={
        <input
          className={styles.number}
          type="number"
          inputMode="numeric"
          min={TOP_MIX.min}
          max={TOP_MIX.max}
          step={TOP_MIX.step}
          value={text}
          aria-labelledby={titleId}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
          }}
        />
      }
    />
  )
}

// Adding a folder reads the songs already in it, then Encore watches it for new ones.
function FolderSetting({ folders }: { folders: string[] }) {
  const add = async (): Promise<void> => {
    const folder = await window.encore.preferences.addMusicFolder()
    if (!folder) return
    const result = await library.importMusic([folder], 'No songs in that folder yet. New ones will show up by themselves.')
    if (result) identify.identifyNewSongs(result.added)
  }

  return (
    <Row
      title="Music folders"
      description="New songs saved in these folders show up in Encore by themselves. Removing a folder keeps its songs in your library."
      control={
        <Button size="small" onClick={add}>
          Add folder
        </Button>
      }
    >
      {folders.length > 0 && (
        <ul className={styles.folders} aria-label="Music folders">
          {folders.map((folder) => (
            <li key={folder} className={styles.folder}>
              <FolderIcon size={17} />
              <span className={styles.folderPath} title={folder}>
                {folder}
              </span>
              <button
                className={styles.iconButton}
                aria-label={`Stop watching ${folder}`}
                title="Stop watching this folder"
                onClick={() => window.encore.preferences.removeMusicFolder(folder)}
              >
                <CloseIcon size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Row>
  )
}

// Your own AcoustID key turns on identifying songs by sound. Once saved it's never shown again, only that it's there.
function SoundKeySetting() {
  const inputId = useId()
  const [saved, setSaved] = useState<boolean | null>(null)
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const { preferences } = window.encore

  useEffect(() => {
    preferences.hasSoundKey().then(setSaved, () => setSaved(false))
  }, [preferences])

  const save = async (): Promise<void> => {
    const key = text.trim()
    if (!SOUND_KEY.test(key)) {
      setMessage("That doesn't look like an AcoustID key. It's a short mix of letters and numbers, like 8XaBELgH.")
      return
    }
    const stored = await preferences.setSoundKey(key).catch(() => false)
    if (!stored) {
      setMessage("Windows couldn't lock the key away safely, so it wasn't saved. Try again after restarting Encore.")
      return
    }
    setText('')
    setMessage(null)
    setSaved(true)
  }

  const remove = async (): Promise<void> => {
    await preferences.removeSoundKey()
    setSaved(false)
  }

  return (
    <Row
      title="Identify by sound"
      description="Recognizes songs whose names give nothing to search for, by how they sound. It needs your own free AcoustID key. Only a fingerprint of the song is sent, never the audio."
      control={
        saved ? (
          <>
            <span className={styles.savedKey}>Key saved</span>
            <Button size="small" onClick={remove}>
              Remove
            </Button>
          </>
        ) : (
          saved === false && <a className={styles.link} href={SOUND_KEY_URL} target="_blank" rel="noreferrer">
            Get a free key
          </a>
        )
      }
    >
      {saved === false && (
        <form
          className={styles.keyForm}
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="visually-hidden" htmlFor={inputId}>
            AcoustID key
          </label>
          <input
            id={inputId}
            className={styles.textInput}
            value={text}
            placeholder="Paste your AcoustID key"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value)
              setMessage(null)
            }}
          />
          <Button type="submit" size="small" variant="primary" disabled={!text.trim()}>
            Save key
          </Button>
        </form>
      )}
      {message && <p className={styles.note}>{message}</p>}
    </Row>
  )
}

const ABOUT_LINKS = [
  { label: 'Privacy', url: 'https://vultify.dev/encore/privacy' },
  { label: 'License', url: 'https://github.com/Vultify/encore/blob/main/LICENSE' },
  { label: 'Source code', url: 'https://github.com/Vultify/encore' }
]

// Which version this is, and where to read the privacy note, the license, and the code. Links open in the browser.
function AboutRow() {
  return (
    <Row
      title={`Encore ${__APP_VERSION__}`}
      description="A free, open-source player for the music on your computer, made by Vultify."
      control={
        <nav className={styles.links} aria-label="About Encore">
          {ABOUT_LINKS.map((link) => (
            <a key={link.url} className={styles.link} href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </nav>
      }
    />
  )
}

const releaseNotesUrl = (version: string): string => `https://github.com/Vultify/encore/releases/tag/v${version}`

// The new version waiting at the top of Settings: download it, watch it come in, then restart into it.
function UpdateCard({ update }: { update: NewVersion }) {
  const { updates } = window.encore
  const title = {
    available: `Encore ${update.version} is available`,
    downloading: `Downloading Encore ${update.version}`,
    ready: `Encore ${update.version} is ready`
  }[update.state]
  const description =
    update.state === 'ready'
      ? 'Restart Encore to finish. Music stops for a moment, and your library and settings stay just as they are. It also installs the next time you quit Encore.'
      : 'Download it now and restart Encore when it suits you. Your library and settings stay just as they are.'

  return (
    <section className={styles.updateCard} aria-label="Update">
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowDescription}>{description}</span>
        {update.state === 'available' && update.error && <p className={styles.note}>{update.error}</p>}
      </div>
      <div className={styles.control}>
        <a className={styles.link} href={releaseNotesUrl(update.version)} target="_blank" rel="noreferrer">
          What's new
        </a>
        {update.state === 'available' && (
          <Button variant="primary" size="small" onClick={updates.download}>
            {update.error ? 'Try again' : 'Download'}
          </Button>
        )}
        {update.state === 'downloading' && (
          <span className={styles.progress} role="progressbar" aria-label="Download" aria-valuenow={update.percent} aria-valuemin={0} aria-valuemax={100}>
            <span className={styles.progressFill} style={{ width: `${update.percent}%` }} />
          </span>
        )}
        {update.state === 'ready' && (
          <Button variant="primary" size="small" onClick={updates.install}>
            Restart to update
          </Button>
        )}
      </div>
    </section>
  )
}

const UPDATE_NOTES: Record<Exclude<UpdateStatus['state'], NewVersion['state']>, string> = {
  off: 'Updates work once Encore is installed.',
  idle: 'Encore checks GitHub for new versions.',
  checking: 'Checking for a new version…',
  current: "You're on the newest version.",
  error: "Couldn't reach GitHub to check. Try again in a bit."
}

// Where updating stands, with a way to check right now.
function UpdatesRow({ update, automatic }: { update: UpdateStatus; automatic: boolean }) {
  const description = hasNewVersion(update)
    ? `Encore ${update.version} is waiting at the top of Settings.`
    : update.state === 'idle' && !automatic
      ? 'Encore only checks for new versions when you click Check now.'
      : UPDATE_NOTES[update.state]
  const busy = update.state === 'off' || update.state === 'checking' || hasNewVersion(update)
  return (
    <Row
      title="Updates"
      description={description}
      control={
        <Button size="small" disabled={busy} onClick={window.encore.updates.check}>
          Check now
        </Button>
      }
    />
  )
}

// Starting with Windows needs the installed app, so while developing the switch explains that instead.
function StartupSetting({ on }: { on: boolean }) {
  const [available, setAvailable] = useState(true)
  useEffect(() => {
    void window.encore.preferences.canStartWithWindows().then(setAvailable)
  }, [])

  return (
    <SwitchSetting
      title="Start with Windows"
      description={
        available
          ? 'Encore opens quietly in the tray when you sign in.'
          : 'Encore opens quietly in the tray when you sign in. This works once Encore is installed.'
      }
      checked={on && available}
      disabled={!available}
      onChange={(next) => update({ startWithWindows: next })}
    />
  )
}
