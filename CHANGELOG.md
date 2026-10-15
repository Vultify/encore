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

### Fixed
- A late progress message could replace the "Added songs" notice after an import finished.
