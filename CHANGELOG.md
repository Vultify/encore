# Changelog

All notable changes to Encore are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Project plan and roadmap.
- README and license.
- Desktop app foundation built on Electron, React, and TypeScript.
- Frameless window with a custom title bar. Closing it sends Encore to the system tray.
- Tray icon with Show Encore and Quit Encore.
- Stage layout: nav pill, now playing stage, glass library panel, and the floating player dock.
- Home, Library, and Search views with empty states.
- Encore logo, app icon, and tray icon.
- Automated app tests with Playwright.
- Drag and drop songs or whole folders anywhere in the window. Encore finds every MP3, FLAC, WAV, and M4A inside and lists them under Local files.
- Song tags and cover art: title, artist, album, track number, year, and length, with progress while a big folder is read.
- Untagged songs get their artist and title from "Artist - Title" file names, and their cover from a cover or folder image beside them.
- Song recognition planned as its own phase on the roadmap.
- The library is saved in a local SQLite database and loads when Encore opens.
- Adding a folder again skips songs that haven't changed and re-reads ones that have.
- Playback: play a song from the list by double-clicking it or with the play button on its cover. The rest of the list plays after it, including songs added while it plays.
- Player dock controls: play and pause, previous (restarts the song after the first 3 seconds), next, a seekable progress line, elapsed and total time, and a volume slider with mute.
- The Now playing stage shows the current song's cover, title, and artist.
- Space plays and pauses.
- A notice when a song's file has moved or been deleted, then playback skips to the next song.
- Albums tab: a grid of album covers. Each album opens to its songs in track order, with a Play button. Compilations stay together as one album.
- Artists tab: a grid of artists. Each artist opens to their albums and all their songs.
- Playlists: create, name, rename, delete (with a confirm step), and drag into any order. Songs inside a playlist can be dragged into a new order too.
- Liked Songs: like a song from the heart in the player dock or from a song's menu. Liked songs show a small heart in every list.
- Song menu on right-click or the ⋯ button: Like, Add to playlist (including a new one, named up front), and Remove from this playlist.
- Text selection uses the accent color.
- Roadmap: remove from library and missing file labels added to Phase 3. Song recognition now searches by artist and title first, with sound matching as a backup.

### Fixed
- A late progress message could replace the "Added songs" notice after an import finished.
