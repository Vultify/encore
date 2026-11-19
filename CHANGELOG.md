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
- Search across songs, artists, albums, and playlists. Matches the start of any word, ignores case and accents, and ranks exact titles first. Results open their page in the library or play right away.
- Ctrl + F opens search from anywhere.
- Remove from library in every song's menu, with a confirm step. The song leaves Encore, its playlists, and Liked Songs. The file stays on disk.
- Songs whose file has moved or been deleted show greyed out with a "File not found" badge. Files are checked when Encore opens and when its window comes back into focus.
- Roadmap: remove from library and missing file labels added to Phase 3. Song recognition now searches by artist and title first, with sound matching as a backup.
- Identify songs: looks up songs missing an album or cover on Apple's free music search, by artist and title. A review page shows the top matches with covers, best one first, to pick or skip. Picks are saved inside Encore only, and Restore original tags undoes them.
- Matching skips live versions, remixes, karaoke, tribute, and instrumental versions, prefers the original album over compilations, and uses song length to tell recordings apart. When the search misses an album, the artist's own song list is checked too.
- Shuffle and repeat (off, all, one).
- Play next and Add to queue in every song's menu.
- Now Playing view: a large cover, where the song is playing from, a wide progress bar, and an Up next panel with the queue and what comes next.
- The accent color follows the playing album's cover and fades between songs. Covers without real color, or nothing playing, stay teal.
- Save tags to file: writes an identified song's title, artist, album, track number, year, and cover into the file itself, from the song menu or for a whole review at once. It works on a copy, checks the copy, and only then replaces the original.
- Identify by sound: when a song's name gives nothing to search for, Encore fingerprints it with Chromaprint and looks it up on AcoustID and MusicBrainz, with covers from the Cover Art Archive. These matches are marked as possibly wrong.
- `.env.example` showing the optional AcoustID key.
- Music keeps playing while Encore is hidden in the tray, and moves on to the next song on time.
- Tray menu with the song playing, Play or Pause, Next, Previous, Show Encore, and Quit Encore. Hovering the tray icon names the song.
- Media keys, headphone buttons, and the Windows media controls (Win + A) show the song and its cover and control playback.
- Encore reopens at the same size and spot, with the same volume, on the same song paused where it was left. The queue and the rest of the list are still lined up.
- Mini player: a floating glass pill at the bottom center of the screen with the song, previous, play or pause, next, and a progress line in the album's accent color. It stays on top without taking focus from other apps, and clicks pass through the clear space around it.
- Ctrl + Alt + Space shows or hides the mini player from anywhere. The tray menu has a Mini player item, and the dock's pop-out button swaps the full window for it. Clicking the song in the mini player brings Encore back.
- Settings page, opened from the gear in the title bar.
- Change the mini player shortcut by pressing the new keys. Keys show up as they're held, a combination Windows or another app already uses is turned down, and Reset goes back to Ctrl + Alt + Space.
- Accent color: follow the playing album's cover, or stay Teal, Coral, Violet, Pink, or Blue. The mini player follows it too.
- Music folders: songs already in a folder are added, then new songs saved there show up on their own, including whole album folders moved in at once. Songs saved while Encore was closed are caught up when it opens.
- Identify new songs automatically: new songs missing an album or cover are looked up quietly, with matches waiting in Local files for review.
- Start with Windows setting, which opens Encore quietly in the tray. It takes effect in the installed app.
- Home shows listening stats for the last week, month, year, or all time: total listening time with a bar per day or month, top songs by plays, and top artists by listening time.
- Listening is tracked by the real time spent playing, leaving out pauses and skipped parts. A song counts as played after 30 seconds, or halfway through if it's shorter than a minute.
- Your Top 25: a live mix of the top songs on Home that plays or shuffles as a queue and changes as you listen. Its size is set in Settings, rounded to the nearest five.
- Covers fade in as they load, views ease in when switching, and a quiet spinner shows while the library loads instead of an empty message.
- Motion is turned off for anyone who has asked Windows for less of it.
- An equalizer, opened from its button in the player dock: ten bands from deep bass to air, presets (Flat, Bass boost, Treble boost, Vocal, Rock, Pop, Hip-hop, Electronic, Acoustic), and Custom, which keeps your own levels while you try a preset. A curve behind the sliders shows the shape.
- Boosting with the equalizer lowers the volume just enough that loud songs don't crackle. The equalizer, its preset, and Custom are remembered after a restart.
- The mini player has a volume slider and a mute button to the right of its controls, and the mouse wheel works over them. A title or artist too long to fit scrolls slowly, so all of it can be read.
- Motion setting under Look: Match Windows, On, or Off. Matching Windows follows its Animation effects setting, which some performance tools turn off. With motion off, a long name in the mini player ends in an ellipsis and scrolls while the pointer is on the pill, and hovering shows the whole name.
- About section at the bottom of Settings, with the version and links to the privacy note, the license, and the source code.
- A privacy note, `PRIVACY.md`, saying what Encore keeps on your computer and exactly when it goes online.

### Removed
- The "Spotify not connected" badge in the title bar. Encore plays local music only.

### Fixed
- A late progress message could replace the "Added songs" notice after an import finished.
- Tall pages could squeeze the title bar shorter.
- Songs whose files keep their title, artist, and album only in the "sort as" fields, like some iTunes purchases, now show them.
- The player dock showed a song's old details after it was identified or re-read while playing.
- Playing a song from search results could blank the whole window.
- With repeat all, a list where no song could be played skipped through it forever, and pause couldn't stop it. It now stops after trying each song once and says so, and pressing Play tries again once a file is back.
- When the last songs in a list couldn't be played, the player kept showing Pause with nothing playing.
- Albums kept in long folder paths lost the spot to pick up from when Encore reopened.
- Scrolling down on the player's mute button while muted turned the sound back on.
- With shuffle on, liking a song reshuffled Up next.
- The mix on Home didn't show a like or an identified song's new details until it changed order.
- Identifying a song cleared matches still waiting for review, and songs added during a lookup were never looked up. Waiting matches now stay, and new songs are looked up right after as part of the same review.
- Adding a whole drive, or any folder with a subfolder Windows won't open, found no songs. A drive's Recycle Bin is left out, so deleted songs don't come back.

### Changed
- Buttons and switches share one style across the app, and the mini player shows covers and colors the same way as the player dock.

### Security
- Updated Electron to 44.10.1 for its fix to trusted website certificates.
- The mini player can only reach its own controls, not the library or song files.
