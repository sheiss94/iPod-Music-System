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
  let i = 0; let x = n
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++ }
  return `${x.toFixed(1)} ${units[i]}`
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
  const [syncMsg, setSyncMsg] = useState('')
  const [settings, setSettings] = useState(null)

  const loadDashboard = async () => setDashboard(await fetch(`${API}/dashboard`).then(r => r.json()))
  const loadTracks = async () => setTracks((await fetch(`${API}/library/tracks`).then(r => r.json())).items)
  const loadPlaylists = async () => setPlaylists((await fetch(`${API}/playlists`).then(r => r.json())).items)
  const loadIpod = async () => setIpod(await fetch(`${API}/ipod/status`).then(r => r.json()))
  const browseIpod = async (sub='') => setIpodItems((await fetch(`${API}/ipod/browse?subpath=${encodeURIComponent(sub)}`).then(r => r.json())).items)
  const loadSettings = async () => setSettings(await fetch(`${API}/settings`).then(r => r.json()))

  useEffect(() => {
    loadDashboard(); loadTracks(); loadPlaylists(); loadIpod(); loadSettings()
  }, [])

  const createPlaylist = async () => {
    await fetch(`${API}/playlists`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name: playlistName})})
    loadPlaylists()
  }

  const addSelectedToPlaylist = async (name) => {
    const relative_paths = Object.keys(selected).filter(k => selected[k])
    await fetch(`${API}/playlists/add`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({playlist:name, relative_paths})})
    loadPlaylists()
    loadDashboard()
  }

  const syncToIpod = async () => {
    setSyncMsg('Syncing...')
    const data = await fetch(`${API}/ipod/sync`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({source_subdir:'', target_subdir:'Music'})}).then(r => r.json())
    setSyncMsg(data.ok ? `Copied ${data.copied_files} files to ${data.target}` : JSON.stringify(data))
    loadIpod()
    browseIpod('Music')
  }

  return (
    <div style={{maxWidth:1200, margin:'0 auto', padding:24}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <div>
          <div style={{fontSize:12, color:'#93a4c3', letterSpacing:2, textTransform:'uppercase'}}>Ultimate iPod Music System</div>
          <h1 style={{margin:'6px 0 0 0', fontSize:34}}>Offline library, playlists, and iPod sync</h1>
        </div>
        <div style={{display:'flex', gap:8}}>
          {['dashboard','library','playlists','ipod','settings'].map(x => (
            <button key={x} onClick={() => setTab(x)} style={{
              background: tab===x ? '#60a5fa' : '#1b2440',
              color: tab===x ? '#0b1020' : '#e5e7eb',
              border:'none', padding:'10px 16px', borderRadius:14, cursor:'pointer'
            }}>{x[0].toUpperCase()+x.slice(1)}</button>
          ))}
        </div>
      </div>

      {tab==='dashboard' && dashboard && (
        <>
          <Card title="Overview">
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16}}>
              <Stat label="Tracks" value={dashboard.track_count} />
              <Stat label="Playlists" value={dashboard.playlist_count} />
              <Stat label="Library" value={dashboard.library_path} />
              <Stat label="Export" value={dashboard.export_path} />
            </div>
          </Card>
          <Card title="Recommended flow">
            <div style={{lineHeight:1.7, color:'#c8d1e4'}}>
              Import music into your library, select tracks into themed playlists like Car, Boat, and Walks, export them, then sync the export folder to a mounted iPod on Linux.
            </div>
          </Card>
        </>
      )}

      {tab==='library' && (
        <Card title="Library" right={<button onClick={loadTracks} style={btn}>Refresh</button>}>
          <div style={{maxHeight:500, overflow:'auto'}}>
            {tracks.map(t => (
              <label key={t.relative_path} style={row}>
                <input type="checkbox" checked={!!selected[t.relative_path]} onChange={e => setSelected({...selected, [t.relative_path]: e.target.checked})} />
                <div style={{flex:1}}>
                  <div>{t.relative_path}</div>
                  <div style={{fontSize:12, color:'#93a4c3'}}>{fmtBytes(t.size)}</div>
                </div>
              </label>
            ))}
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
          <Card title="Playlists">
            {playlists.map(p => (
              <div key={p.name} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #24314d'}}>
                <div>{p.name}</div>
                <button onClick={()=>addSelectedToPlaylist(p.name)} style={btn}>Add selected tracks</button>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab==='ipod' && (
        <>
          <Card title="iPod status" right={<button onClick={async()=>{await loadIpod(); await browseIpod('')}} style={btn}>Refresh</button>}>
            {ipod && (
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
                <button onClick={syncToIpod} style={btn}>Sync export folder to iPod</button>
                <div style={{marginTop:8, color:'#93a4c3'}}>{syncMsg}</div>
              </div>
            )}
          </Card>
          <Card title="Mounted iPod browser">
            {ipodItems.map(item => (
              <div key={item.relative_path || item.name} style={{padding:'8px 0', borderBottom:'1px solid #24314d'}}>
                {item.is_dir ? '📁' : '🎵'} {item.relative_path || item.name} {!item.is_dir && <span style={{color:'#93a4c3'}}>({fmtBytes(item.size)})</span>}
              </div>
            ))}
          </Card>
        </>
      )}

      {tab==='settings' && settings && (
        <Card title="Paths">
          <div style={{lineHeight:2}}>
            <div><b>Library:</b> <code>{settings.library}</code></div>
            <div><b>Incoming:</b> <code>{settings.incoming}</code></div>
            <div><b>Export:</b> <code>{settings.export}</code></div>
            <div><b>iPod mount:</b> <code>{settings.ipod_mount}</code></div>
          </div>
          <div style={{marginTop:14, color:'#93a4c3'}}>Edit these in your <code>.env</code> file, then restart Docker Compose.</div>
        </Card>
      )}
    </div>
  )
}

function Stat({label, value}) {
  return <div style={{background:'#0d1427', borderRadius:16, padding:16, border:'1px solid #202b46'}}><div style={{fontSize:12, color:'#93a4c3'}}>{label}</div><div style={{fontSize:18, fontWeight:700, marginTop:6, wordBreak:'break-word'}}>{String(value)}</div></div>
}

const btn = {background:'#60a5fa', color:'#0b1020', border:'none', padding:'10px 14px', borderRadius:12, cursor:'pointer', fontWeight:700}
const input = {background:'#0d1427', color:'#e5e7eb', border:'1px solid #24314d', padding:'10px 12px', borderRadius:12, flex:1}
const row = {display:'flex', gap:12, alignItems:'center', padding:'8px 0', borderBottom:'1px solid #24314d'}
