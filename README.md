# Encore

Encore is my own desktop music player for Windows. I built it because I wanted a music app laid out the way I like, instead of Spotify's or Apple Music's layout.

## What it does
- Plays music saved on my PC. Drag and drop files or whole folders to add them, or pick music folders and new songs saved there show up on their own.
- Playlists, shuffle, repeat, a queue, search, and album art.
- Fixes songs with missing info. It looks them up by name, or by listening to them when the name is no help, and can save the fixes into the files.
- The app's accent color changes to match the album that's playing, or stays one color I pick.
- Closing the window keeps it running in the system tray.
- Ctrl + Alt + Space pops up a mini player at the bottom of my screen. The shortcut can be changed in Settings.

## Running it
Needs Node 24.

```
npm install
npm run dev
```

`npm test` checks the types, builds the app, and runs the app tests.

To identify songs by their sound, copy `.env.example` to `.env` and add a free key from https://acoustid.org/new-application. Without one, everything else still works.

## Status
In development. See `ROADMAP.md` for progress.

## Credits
- Song fingerprints come from Chromaprint's `fpcalc` (LGPL 2.1), bundled in `resources/bin`. Source: https://github.com/acoustid/chromaprint
- Tags are read with music-metadata (MIT) and written with node-taglib-sharp (LGPL 2.1).
- Song lookups use Apple's iTunes Search, AcoustID, MusicBrainz, and the Cover Art Archive.

## License
All rights reserved. See `LICENSE`.
