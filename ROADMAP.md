# Encore Roadmap

Build order for Encore. Each phase ends with a working, tested checkpoint that gets committed and pushed.

## Phase 0: Plan
- [x] Name, goals, and must-have features
- [x] Design mockup (Stage layout, floating player dock, mini player, adaptive album color)
- [x] Project folder, roadmap, README, license, changelog

## Phase 1: Foundation
- [x] Scaffold the app with Electron, React, TypeScript, and Vite
- [x] Frameless window with a custom title bar (minimize, maximize, close to tray)
- [x] Design tokens: colors, spacing, radii, and the Manrope font bundled locally
- [x] Stage layout shell: top nav pill, now playing stage, library panel, player dock
- [x] Private GitHub repo and first push

## Phase 2: Local music
- [x] Drag and drop files and folders anywhere in the window
- [x] Read song tags and album art (MP3, FLAC, WAV, M4A)
- [x] Fallbacks for untagged songs: artist and title from "Artist - Title" file names, cover from a cover.jpg or folder.jpg beside the song
- [x] Save the library in a local SQLite database
- [x] Play, pause, seek, volume, previous, and next
- [x] Progress and time in the player dock

## Phase 3: Library and playlists
- [x] Library tabs: Playlists, Albums, Artists, Local files
- [x] Create, rename, reorder, and delete playlists
- [x] Add songs to playlists, plus Liked Songs
- [x] Search across songs, artists, albums, and playlists
- [x] Remove from library (right-click a song). Only removes it from Encore, never deletes the file
- [x] Songs whose file is missing show greyed out with "File not found"

## Phase 4: Song recognition
- [x] "Identify songs" button that looks up songs missing an album or cover, in the background with progress
- [x] Search by artist and title (from tags or the file name) on the free iTunes search, no account needed
- [x] Review screen showing the top few matches side by side with covers, to pick one or skip
- [x] Save the picked album, track number, year, and cover in Encore's library
- [x] Optional "Save to file" that writes the tags into the song file itself
- [x] Backup for songs with meaningless names: identify by sound with AcoustID (needs a free AcoustID key in `.env`), marked as "may be wrong"

## Phase 5: Playback experience
- [x] Shuffle and repeat (off, all, one)
- [x] Queue and Up next panel
- [x] Now playing view
- [x] Adaptive accent color pulled from the playing album art, teal at rest

## Phase 6: Desktop integration
- [x] Close to the system tray and keep playing
- [x] Tray menu: show Encore, mini player, play/pause, next, quit
- [x] Mini player window: glass pill at the bottom center of the screen
- [x] Global keybind Ctrl + Alt + Space to show or hide the mini player
- [x] Media keys and the Windows media controls
- [x] Remember window size, volume, and last song

## Phase 7: Polish and 1.0.0
- [x] Home: listening stats and a live mix of top songs
- [x] Animations, empty states, and loading states
- [x] Settings: keybind, accent color, music folders, identify new songs automatically
- [x] Equalizer: ten bands, presets, and Custom, opened from the player dock
- [x] App icon and Windows installer: installs per user with no admin prompt, installs silently with `/S`, and upgrades cleanly over older versions, so it works with winget
- [ ] Start with Windows option, tested in the installed app
- [x] In-app updates: Encore checks GitHub Releases for new versions and offers to update itself. Tested against a local stand-in for GitHub; checks reach the real Releases once the repo is public
- [x] AcoustID key in Settings, so anyone can turn on identify by sound with their own free key
- [x] Open source: MIT license, a README written for everyone, a project audit, then make the repo public
- [x] About section in Settings and a privacy note (`PRIVACY.md`)
- [ ] Release 1.0.0 on GitHub Releases. Before publishing, check that what the About section and `PRIVACY.md` promise is all true: update checks work, the repo is public under MIT, vultify.dev/encore/privacy is live, and the License and Source code links open
- [ ] winget: submit `Vultify.Encore` to Microsoft's winget catalog

## Later
- [ ] Code signing (Azure Trusted Signing, about $10 a month), so Windows stops warning about an unknown publisher
- [ ] Apple Music source (needs the $99/year Apple developer account)
- [ ] Lyrics

## Notes
- **Local files are the only music source for now.** The library already records where each song comes from, so a second source like Apple Music has a place to go. Its shared source interface gets designed when that work starts, with the second source in hand, since playing protected streams likely needs a different path than local files.
- **Spotify was left out on purpose.** A test in November 2026 showed Spotify can play inside Encore using the castlabs build of Electron, signed through castlabs. But it needs a Premium subscription, re-signing after every Electron update, and Spotify's API keeps shrinking, so Encore stays local music only.
- **Song recognition never overwrites files on its own.** Matches are reviewed first and saved inside Encore. Writing tags into the file is a separate choice per song.
- **Recognition searches by name first, sound second.** Picard's sound matching got 4 out of 4 of my songs wrong (a mashup, a tribute cover, two compilations), likely because lyric-video downloads are slightly altered. Searching the iTunes catalog by artist and title is far more accurate when the name is known.
- **Apple's song search skips some albums, often explicit ones.** When the best result is a compilation or not a near-perfect fit, Encore also checks the artist's own song list, where those albums still show up. That's how *Welcome Home* finds *Good Apollo I'm Burning Star IV*.
