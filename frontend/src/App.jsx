import React, { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function Card({ title, children, right }) {
  return (
    <div style={{background:'#131a2e', border:'1px solid #26304d', borderRadius:20, padding:20, marginBottom:16, boxShadow:'0 10px 30px rgba(0,0,0,.25)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <h2 style={{margin:0, fontSize:20}}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

function fmtBytes(n) {
  if (n == null) return '-'
  const units = ['B','KB','MB','GB','TB']
  let i = 0
  let x = n
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024
    i++
  }
  return `${x.toFixed(1)} ${units[i]}`
}

function Stat({label, value}) {
  return (
    <div style={{background:'#0d1427', borderRadius:16, padding:16, border:'1px solid #202b46'}}>
      <div style={{fontSize:12, color:'#93a4c3'}}>{label}</div>
      <div style={{fontSize:18, fontWeight:700, marginTop:6, wordBreak:'break-word'}}>{String(value)}</div>
    </div>
  )
}

const btn = {
  background:'#60a5fa',
  color:'#0b1020',
  border:'none',
  padding:'10px 14px',
  borderRadius:12,
  cursor:'pointer',
  fontWeight:700
}

const btnSecondary = {
  background:'#1b2440',
  color:'#e5e7eb',
  border:'1px solid #2d3b63',
  padding:'10px 14px',
  borderRadius:12,
  cursor:'pointer',
  fontWeight:700
}

const btnDanger = {
  background:'#7f1d1d',
  color:'#fee2e2',
  border:'1px solid #991b1b',
  padding:'8px 12px',
  borderRadius:10,
  cursor:'pointer',
  fontWeight:700
}

const input = {
  background:'#0d1427',
  color:'#e5e7eb',
  border:'1px solid #24314d',
  padding:'10px 12px',
  borderRadius:12,
  flex:1
}

const row = {
  display:'flex',
  gap:12,
  alignItems:'center',
  padding:'8px 0',
  borderBottom:'1px solid #24314d'
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`)
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!res.ok) throw new Error(data.detail || data.error || `GET ${path} failed`)
  return data
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body || {})
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!res.ok) throw new Error(data.detail || data.error || `POST ${path} failed`)
  return data
}

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [tracks, setTracks] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [playlistName, setPlaylistName] = useState('Car')
  const [selected, setSelected] = useState({})
  const [ipod, setIpod] = useState(null)
  const [ipodItems, setIpodItems] = useState([])
  const [ipodCurrentPath, setIpodCurrentPath] = useState('')
  const [ipodParentPath, setIpodParentPath] = useState('')
  const [ipodAudio, setIpodAudio] = useState([])
  const [ipodAudioPath, setIpodAudioPath] = useState('iPod_Control/Music')
  const [ipodSearch, setIpodSearch] = useState('')
  const [ipodSearchResults, setIpodSearchResults] = useState([])
  const [syncMsg, setSyncMsg] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [settings, setSettings] = useState(null)
  const [globalError, setGlobalError] = useState('')
  const [globalInfo, setGlobalInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const loadDashboard = async () => {
    try { setDashboard(await apiGet('/dashboard')) }
    catch (e) { setGlobalError(`Dashboard: ${e.message}`) }
  }

  const loadTracks = async () => {
    try {
      const data = await apiGet('/library/tracks')
      setTracks(data.items || [])
    } catch (e) {
      setGlobalError(`Library: ${e.message}`)
    }
  }

  const loadPlaylists = async () => {
    try {
      const data = await apiGet('/playlists')
      setPlaylists(data.items || [])
    } catch (e) {
      setGlobalError(`Playlists: ${e.message}`)
    }
  }

  const loadIpod = async () => {
    try { setIpod(await apiGet('/ipod/status')) }
    catch (e) { setGlobalError(`iPod status: ${e.message}`) }
  }

  const browseIpod = async (sub='') => {
    try {
      const data = await apiGet(`/ipod/browse?subpath=${encodeURIComponent(sub)}`)
      setIpodItems(data.items || [])
      setIpodCurrentPath(data.current || '')
      setIpodParentPath(data.parent || '')
    } catch (e) {
      setGlobalError(`iPod browse: ${e.message}`)
      setIpodItems([])
    }
  }

  const loadIpodAudio = async (sub='iPod_Control/Music') => {
    try {
      const data = await apiGet(`/ipod/audio?subpath=${encodeURIComponent(sub)}`)
      setIpodAudio(data.items || [])
    } catch (e) {
      setGlobalError(`iPod audio: ${e.message}`)
      setIpodAudio([])
    }
  }

  const loadSettings = async () => {
    try { setSettings(await apiGet('/settings')) }
    catch (e) { setGlobalError(`Settings: ${e.message}`) }
  }

  const refreshAll = async () => {
    setLoading(true)
    setGlobalError('')
    try {
      await Promise.all([
        loadDashboard(),
        loadTracks(),
        loadPlaylists(),
        loadIpod(),
        loadSettings(),
        browseIpod(''),
        loadIpodAudio(ipodAudioPath),
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
  }, [])

  const createPlaylist = async () => {
    try {
      setGlobalError('')
      await apiPost('/playlists', { name: playlistName })
      await loadPlaylists()
      await loadDashboard()
    } catch (e) {
      setGlobalError(`Create playlist: ${e.message}`)
    }
  }

  const addSelectedToPlaylist = async (name) => {
    try {
      setGlobalError('')
      const relative_paths = Object.keys(selected).filter(k => selected[k])
      await apiPost('/playlists/add', { playlist: name, relative_paths })
      await loadPlaylists()
      await loadDashboard()
    } catch (e) {
      setGlobalError(`Add to playlist: ${e.message}`)
    }
  }

  const syncToIpod = async () => {
    try {
      setGlobalError('')
      setSyncMsg('Syncing...')
      const data = await apiPost('/ipod/sync', { source_subdir:'', target_subdir:'Music' })
      setSyncMsg(`Copied ${data.copied_files} files to ${data.target}`)
      await loadIpod()
      await browseIpod('Music')
    } catch (e) {
      setSyncMsg('')
      setGlobalError(`Sync to iPod: ${e.message}`)
    }
  }

  const importFromIpod = async () => {
    try {
      setGlobalError('')
      setImportMsg('Importing from iPod...')
      const data = await apiPost('/ipod/import', {
        source_subdir: ipodAudioPath,
        flatten_folders: false,
        skip_existing: true
      })
      setImportMsg(`Imported ${data.copied_files} files, skipped ${data.skipped_files}`)
      await loadTracks()
      await loadDashboard()
    } catch (e) {
      setImportMsg('')
      setGlobalError(`Import from iPod: ${e.message}`)
    }
  }

  const searchIpod = async () => {
    try {
      setGlobalError('')
      const data = await apiGet(`/ipod/search?query=${encodeURIComponent(ipodSearch)}`)
      setIpodSearchResults(data.items || [])
    } catch (e) {
      setGlobalError(`Search iPod: ${e.message}`)
    }
  }

  const deleteIpodPath = async (relativePath) => {
    const ok = window.confirm(`Delete this iPod item?\n\n${relativePath}`)
    if (!ok) return

    try {
      setGlobalError('')
      await apiPost('/ipod/delete', { relative_path: relativePath })
      setGlobalInfo(`Deleted: ${relativePath}`)
      await browseIpod(ipodCurrentPath)
      await loadIpod()
      await loadDashboard()
      if (ipodSearchResults.length > 0) {
        await searchIpod()
      }
    } catch (e) {
      setGlobalError(`Delete from iPod: ${e.message}`)
    }
  }

  const backupIpod = async () => {
    try {
      setGlobalError('')
      setGlobalInfo('Backing up iPod...')
      const data = await apiPost('/ipod/backup', {})
      setGlobalInfo(`iPod backup created at: ${data.backup_path}`)
    } catch (e) {
      setGlobalError(`Backup iPod: ${e.message}`)
    }
  }

  return (
    <div style={{maxWidth:1200, margin:'0 auto', padding:24}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <div>
          <div style={{fontSize:12, color:'#93a4c3', letterSpacing:2, textTransform:'uppercase'}}>Ultimate iPod Music System</div>
          <h1 style={{margin:'6px 0 0 0', fontSize:34}}>Offline library, playlists, and iPod sync</h1>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {['dashboard','library','playlists','ipod','settings'].map(x => (
            <button
              key={x}
              onClick={() => setTab(x)}
              style={{
                background: tab===x ? '#60a5fa' : '#1b2440',
                color: tab===x ? '#0b1020' : '#e5e7eb',
                border:'none',
                padding:'10px 16px',
                borderRadius:14,
                cursor:'pointer'
              }}
            >
              {x[0].toUpperCase()+x.slice(1)}
            </button>
          ))}
          <button onClick={refreshAll} style={btnSecondary}>
            {loading ? 'Refreshing...' : 'Refresh all'}
          </button>
        </div>
      </div>

      {globalError && (
        <div style={{background:'#3b1220', color:'#fecdd3', border:'1px solid #7f1d1d', padding:'12px 14px', borderRadius:12, marginBottom:16}}>
          {globalError}
        </div>
      )}

      {globalInfo && (
        <div style={{background:'#10243f', color:'#bfdbfe', border:'1px solid #1d4ed8', padding:'12px 14px', borderRadius:12, marginBottom:16}}>
          {globalInfo}
        </div>
      )}

      {tab==='dashboard' && (
        <>
          <Card title="Overview" right={<button onClick={loadDashboard} style={btnSecondary}>Refresh</button>}>
            {dashboard ? (
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16}}>
                <Stat label="Library Tracks" value={dashboard.track_count} />
                <Stat label="Export Tracks" value={dashboard.export_track_count} />
                <Stat label="Playlists" value={dashboard.playlist_count} />
                <Stat label="iPod Mounted" value={dashboard.ipod_mounted} />
              </div>
            ) : <div style={{color:'#93a4c3'}}>Dashboard data not loaded yet.</div>}
          </Card>

          <Card title="Paths snapshot">
            {dashboard ? (
              <div style={{lineHeight:2}}>
                <div><b>Library:</b> <code>{dashboard.library_path}</code></div>
                <div><b>Incoming:</b> <code>{dashboard.incoming_path}</code></div>
                <div><b>Export:</b> <code>{dashboard.export_path}</code></div>
                <div><b>iPod:</b> <code>{dashboard.ipod_mount_path}</code></div>
              </div>
            ) : <div style={{color:'#93a4c3'}}>No dashboard path data yet.</div>}
          </Card>
        </>
      )}

      {tab==='library' && (
        <Card title="Library" right={<button onClick={loadTracks} style={btnSecondary}>Refresh</button>}>
          <div style={{maxHeight:500, overflow:'auto'}}>
            {tracks.length > 0 ? tracks.map(t => (
              <label key={t.relative_path} style={row}>
                <input
                  type="checkbox"
                  checked={!!selected[t.relative_path]}
                  onChange={e => setSelected({...selected, [t.relative_path]: e.target.checked})}
                />
                <div style={{flex:1}}>
                  <div>{t.relative_path}</div>
                  <div style={{fontSize:12, color:'#93a4c3'}}>{fmtBytes(t.size)}</div>
                </div>
              </label>
            )) : <div style={{color:'#93a4c3'}}>No library tracks yet.</div>}
          </div>
        </Card>
      )}

      {tab==='playlists' && (
        <>
          <Card title="Create playlist">
            <div style={{display:'flex', gap:8}}>
              <input value={playlistName} onChange={e=>setPlaylistName(e.target.value)} style={input} />
              <button onClick={createPlaylist} style={btn}>Create</button>
            </div>
          </Card>

          <Card title="Playlists" right={<button onClick={loadPlaylists} style={btnSecondary}>Refresh</button>}>
            {playlists.length > 0 ? playlists.map(p => (
              <div key={p.name} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #24314d'}}>
                <div>{p.name}</div>
                <button onClick={()=>addSelectedToPlaylist(p.name)} style={btn}>Add selected tracks</button>
              </div>
            )) : <div style={{color:'#93a4c3'}}>No playlists yet.</div>}
          </Card>
        </>
      )}

      {tab==='ipod' && (
        <>
          <Card title="iPod status" right={<button onClick={async()=>{await loadIpod(); await browseIpod(ipodCurrentPath); await loadIpodAudio(ipodAudioPath)}} style={btnSecondary}>Refresh</button>}>
            {ipod ? (
              <div>
                <div style={{marginBottom:8}}>Mounted: <b>{String(ipod.mounted)}</b></div>
                <div style={{marginBottom:8}}>Mount path: <code>{ipod.mount_path}</code></div>
                <div style={{marginBottom:8}}>Mode: {ipod.mode_hint}</div>

                {ipod.usage && (
                  <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, margin:'12px 0'}}>
                    <Stat label="Used" value={fmtBytes(ipod.usage.used)} />
                    <Stat label="Free" value={fmtBytes(ipod.usage.free)} />
                    <Stat label="Total" value={fmtBytes(ipod.usage.total)} />
                  </div>
                )}

                <div style={{display:'flex', gap:8, marginTop:12, flexWrap:'wrap'}}>
                  <button onClick={syncToIpod} style={btn}>Sync export folder to iPod</button>
                  <button onClick={backupIpod} style={btnSecondary}>Backup entire iPod</button>
                </div>

                <div style={{marginTop:8, color:'#93a4c3'}}>{syncMsg}</div>
              </div>
            ) : <div style={{color:'#93a4c3'}}>No iPod status data yet.</div>}
          </Card>

          <Card title="Import music from iPod to Library">
            <div style={{display:'flex', gap:8, marginBottom:12}}>
              <input value={ipodAudioPath} onChange={e=>setIpodAudioPath(e.target.value)} style={input} />
              <button onClick={()=>loadIpodAudio(ipodAudioPath)} style={btnSecondary}>Preview audio</button>
              <button onClick={importFromIpod} style={btn}>Import to library</button>
            </div>

            <div style={{marginBottom:8, color:'#93a4c3'}}>
              Try <code>iPod_Control/Music</code> for stock Apple firmware or another folder if your device layout differs.
            </div>

            <div style={{marginBottom:8, color:'#93a4c3'}}>{importMsg}</div>

            <div style={{maxHeight:220, overflow:'auto', borderTop:'1px solid #24314d', paddingTop:8}}>
              {ipodAudio.length > 0 ? ipodAudio.map(item => (
                <div key={item.relative_path} style={{padding:'6px 0', borderBottom:'1px solid #24314d'}}>
                  🎵 {item.relative_path} <span style={{color:'#93a4c3'}}>({fmtBytes(item.size)})</span>
                </div>
              )) : <div style={{color:'#93a4c3'}}>No audio found at this path yet.</div>}
            </div>
          </Card>

          <Card title="iPod search">
            <div style={{display:'flex', gap:8, marginBottom:12}}>
              <input
                value={ipodSearch}
                onChange={e=>setIpodSearch(e.target.value)}
                placeholder="Search filenames on iPod"
                style={input}
              />
              <button onClick={searchIpod} style={btnSecondary}>Search</button>
            </div>

            <div style={{maxHeight:220, overflow:'auto', borderTop:'1px solid #24314d', paddingTop:8}}>
              {ipodSearchResults.length > 0 ? ipodSearchResults.map(item => (
                <div key={item.relative_path} style={row}>
                  <div style={{flex:1}}>
                    🎵 {item.relative_path} <span style={{color:'#93a4c3'}}>({fmtBytes(item.size)})</span>
                  </div>
                  <button onClick={()=>deleteIpodPath(item.relative_path)} style={btnDanger}>Delete</button>
                </div>
              )) : <div style={{color:'#93a4c3'}}>No search results yet.</div>}
            </div>
          </Card>

          <Card title="iPod explorer">
            <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
              <button onClick={()=>browseIpod('')} style={btnSecondary}>Root</button>
              <button onClick={()=>browseIpod(ipodParentPath)} style={btnSecondary} disabled={ipodCurrentPath === ''}>Up</button>
              <div style={{padding:'10px 12px', color:'#93a4c3'}}>Current: /{ipodCurrentPath}</div>
            </div>

            <div style={{maxHeight:320, overflow:'auto', borderTop:'1px solid #24314d', paddingTop:8}}>
              {ipodItems.length > 0 ? ipodItems.map(item => (
                <div key={item.relative_path || item.name} style={row}>
                  <div style={{flex:1}}>
                    {item.is_dir ? (
                      <span style={{cursor:'pointer'}} onClick={()=>browseIpod(item.relative_path)}>
                        📁 {item.name}
                      </span>
                    ) : (
                      <span>
                        🎵 {item.name} <span style={{color:'#93a4c3'}}>({fmtBytes(item.size)})</span>
                      </span>
                    )}
                  </div>

                  <button onClick={()=>deleteIpodPath(item.relative_path)} style={btnDanger}>
                    Delete
                  </button>
                </div>
              )) : <div style={{color:'#93a4c3'}}>No iPod browser items yet.</div>}
            </div>
          </Card>
        </>
      )}

      {tab==='settings' && (
        <Card title="Paths and availability" right={<button onClick={loadSettings} style={btnSecondary}>Refresh</button>}>
          {settings ? (
            <>
              <div style={{lineHeight:2}}>
                <div><b>Library:</b> <code>{settings.library}</code></div>
                <div><b>Incoming:</b> <code>{settings.incoming}</code></div>
                <div><b>Export:</b> <code>{settings.export}</code></div>
                <div><b>iPod mount:</b> <code>{settings.ipod_mount}</code></div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginTop:16}}>
                <Stat label="Library exists" value={settings.library_exists} />
                <Stat label="Incoming exists" value={settings.incoming_exists} />
                <Stat label="Export exists" value={settings.export_exists} />
                <Stat label="iPod path exists" value={settings.ipod_exists} />
              </div>
            </>
          ) : <div style={{color:'#93a4c3'}}>Settings data not loaded yet.</div>}
        </Card>
      )}
    </div>
  )
}
