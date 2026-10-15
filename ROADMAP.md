# Encore Roadmap

Build order for Encore. Each phase ends with a working, tested checkpoint that gets committed and pushed.

## Phase 0: Plan
- [x] Name, goals, and must-have features
- [x] Design mockup (Stage layout, floating player dock, mini player, adaptive album color)
- [x] Project folder, roadmap, README, license, changelog

## Phase 1: Foundation
- [ ] Scaffold the app with Electron, React, TypeScript, and Vite
- [ ] Frameless window with a custom title bar (minimize, maximize, close to tray)
- [ ] Design tokens: colors, spacing, radii, and the Manrope font bundled locally
- [ ] Stage layout shell: top nav pill, now playing stage, library panel, player dock
- [ ] Private GitHub repo and first push

## Phase 2: Local music
- [ ] Drag and drop files and folders anywhere in the window
- [ ] Read song tags and album art (MP3, FLAC, WAV, M4A)
- [ ] Save the library in a local SQLite database
- [ ] Play, pause, seek, volume, previous, and next
- [ ] Progress and time in the player dock

## Phase 3: Library and playlists
- [ ] Library tabs: Playlists, Albums, Artists, Local files
- [ ] Create, rename, reorder, and delete playlists
- [ ] Add songs to playlists, plus Liked Songs
- [ ] Search across songs, artists, albums, and playlists

## Phase 4: Playback experience
- [ ] Shuffle and repeat (off, all, one)
- [ ] Queue and Up next panel
- [ ] Now playing view
- [ ] Adaptive accent color pulled from the playing album art, teal at rest

## Phase 5: Desktop integration
- [ ] Close to the system tray and keep playing
- [ ] Tray menu: show Encore, mini player, play/pause, next, quit
- [ ] Mini player window: glass pill at the bottom center of the screen
- [ ] Global keybind Ctrl + Alt + Space to show or hide the mini player
- [ ] Keyboard media keys
- [ ] Remember window size, volume, and last song

## Phase 6: Spotify
- [ ] Spotify developer app (needs Caleb's Spotify login)
- [ ] Sign in with Spotify and keep the session
- [ ] Import playlists and Liked Songs into the library
- [ ] Play Spotify songs inside Encore (Premium, Web Playback SDK)
- [ ] Spotify and local songs side by side in one library and queue

## Phase 7: Polish and 1.0.0
- [ ] Animations, empty states, and loading states
- [ ] Settings: keybind, accent color, music folders, Spotify account
- [ ] App icon and Windows installer
- [ ] Start with Windows option
- [ ] Release 1.0.0

## Later
- [ ] Apple Music source (needs the $99/year Apple developer account)
- [ ] Lyrics
- [ ] Equalizer

## Notes
- **Music sources are plug-ins.** Local files, Spotify, and later Apple Music all follow one shared source interface, so adding a source never touches the rest of the app.
- **Spotify playback inside Encore needs copy protection support (Widevine).** Plain Electron doesn't include it, so Phase 6 switches to the castlabs build of Electron, which does. If that turns out to be blocked, the fallback is Encore controlling the Spotify app in the background through Spotify Connect.
