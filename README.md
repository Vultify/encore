# Encore

A free, open-source music player for Windows, for the music on your own computer.

I built Encore because I wanted a music app laid out the way I like, instead of the way streaming apps are. It plays the songs you already have, keeps your library tidy, and stays out of the way in the tray.

## Download

Get the newest version from [Releases](https://github.com/Vultify/encore/releases/latest), or download the installer directly: [Encore-Setup.exe](https://github.com/Vultify/encore/releases/latest/download/Encore-Setup.exe).

It installs for your account only, with no admin prompt, and updates itself when a new version comes out.

Encore isn't code signed yet, so Windows may show "Windows protected your PC" the first time. Click **More info**, then **Run anyway**.

## What it does

- Plays the music on your PC: MP3, FLAC, WAV, and M4A. Drag in files or whole folders, or pick music folders and new songs saved there show up on their own.
- Playlists, Liked Songs, shuffle, repeat, a queue, and search across everything.
- A ten-band equalizer with presets and your own Custom setting.
- A Home page of listening stats: how long you've listened, your top songs and artists, and a mix of your top songs that changes as you listen.
- Fixes songs with missing info. It looks them up by artist and title, or by listening to them when the name is no help, and you review every match before it's used. Fixes can be saved into the files too.
- The accent color follows the album that's playing, or stays one color you pick.
- Closing the window keeps music playing from the system tray.
- Ctrl + Alt + Space shows a mini player at the bottom of the screen. The shortcut can be changed in Settings.
- Media keys, headphone buttons, and the Windows media controls all work.

### Identifying songs by their sound

This is optional. Get a free key from [AcoustID](https://acoustid.org/new-application) and paste it under Music in Settings. Without one, everything else still works.

## Privacy

Encore has no accounts, ads, or analytics, and it doesn't collect anything about you. Your library and settings stay on your computer. It only goes online to identify songs and to check for updates. [`PRIVACY.md`](PRIVACY.md) says exactly what it sends and where.

## Building it yourself

Needs Windows and Node 24.

```
npm install
npm run dev
```

- `npm test` checks the types, builds the app, and runs the app tests.
- `npm run dist` builds the installer into `dist`.
- To try identifying by sound while developing, copy `.env.example` to `.env` and add your AcoustID key there, or save one in Settings.

[`ROADMAP.md`](ROADMAP.md) shows what's done and what's next, and [`CHANGELOG.md`](CHANGELOG.md) lists every change.

## Feedback

Found a bug or have an idea? [Open an issue](https://github.com/Vultify/encore/issues).

## Credits

- Song fingerprints come from Chromaprint's `fpcalc` (LGPL 2.1, with FFmpeg), bundled in `resources/bin` with its license. Source: https://github.com/acoustid/chromaprint
- Tags are read with music-metadata (MIT) and written with node-taglib-sharp (LGPL 2.1).
- Song lookups use Apple's iTunes Search, AcoustID, MusicBrainz, and the Cover Art Archive.
- Built with Electron, React, and TypeScript.

## License

MIT. See [`LICENSE`](LICENSE).
