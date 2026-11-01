import type { Track } from '@shared/api'
import { ConfirmDialog } from './Dialog'

interface SaveToFileDialogProps {
  songs: Track[]
  onConfirm: () => void
  onCancel: () => void
}

// Asks before writing identified songs' tags into their files, since that changes the files for good.
export function SaveToFileDialog({ songs, onConfirm, onCancel }: SaveToFileDialogProps) {
  const one = songs.length === 1
  return (
    <ConfirmDialog
      title={one ? `Save ${songs[0].title}'s tags into its file?` : `Save the tags into ${songs.length} files?`}
      message={`Encore writes the title, artist, album, track number, year, and cover into ${one ? 'the song file' : 'each song file'}, so iTunes and other apps see them too. The music itself isn't changed. This can't be undone from Encore.`}
      confirmLabel={one ? 'Save to file' : 'Save to files'}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
