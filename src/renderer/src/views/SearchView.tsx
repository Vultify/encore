import { useState } from 'react'
import { EmptyState, Panel } from '@/components/Panel/Panel'
import { SearchIcon } from '@/components/icons'
import styles from './views.module.css'

export function SearchView() {
  const [query, setQuery] = useState('')

  const header = (
    <label className={styles.search}>
      <SearchIcon size={18} strokeWidth={2} />
      <span className="visually-hidden">Search</span>
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search songs, artists, albums, playlists"
      />
    </label>
  )

  return (
    <Panel label="Search" header={header}>
      <EmptyState icon={<SearchIcon size={26} />} title={query ? 'No matches' : 'Search your music'}>
        {query
          ? 'Nothing in your library matches that yet.'
          : 'Find anything in your local files and Spotify library from one place.'}
      </EmptyState>
    </Panel>
  )
}
