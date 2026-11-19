# Encore privacy

Last updated November 19, 2026

Encore is a music player for the music on your own computer. It has no accounts, no ads, no analytics, and no crash reporting. I don't collect anything about you or your music, and nothing is ever sent to me.

## What stays on your computer

Your library, playlists, likes, listening history and stats, equalizer, and settings are saved on your computer only, in Encore's folder at `%APPDATA%\encore`. Uninstalling Encore leaves that folder in place, so you can delete it yourself if you want it gone.

Encore only changes your song files when you ask it to, with Save tags to file.

## When Encore goes online

Encore only connects to the internet in these cases:

- **Identifying songs.** When you identify a song, Encore searches Apple's iTunes catalog (itunes.apple.com) with the song's artist and title, and loads the cover art Apple returns.
- **Identifying songs by their sound.** If you turn this on with your own free AcoustID key, Encore makes a fingerprint of the song on your computer and sends only that fingerprint and the song's length to AcoustID (acoustid.org). The audio itself never leaves your computer. Cover art for these matches comes from the Cover Art Archive (coverartarchive.org).
- **Checking for updates.** Encore asks GitHub (github.com) whether a newer version is out, and downloads it if you choose to update.

These services have their own privacy policies:

- [Apple](https://www.apple.com/legal/privacy/)
- [Cover Art Archive, run by the MetaBrainz Foundation](https://metabrainz.org/privacy)
- [GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)

AcoustID doesn't publish a privacy policy. Encore sends it only a song's fingerprint and length, plus your AcoustID key.

Like any website you visit, these services can see your IP address when Encore connects to them.

## Questions

Encore is open source, so you can read exactly what it does. If you have a question, open an issue at [github.com/Vultify/encore](https://github.com/Vultify/encore/issues).
