from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import os
import shutil
import mimetypes

app = FastAPI(title="iPod Music System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIBRARY = Path(os.getenv("MUSIC_LIBRARY_PATH", "/music/Library"))
INCOMING = Path(os.getenv("MUSIC_INCOMING_PATH", "/music/Incoming"))
EXPORT = Path(os.getenv("MUSIC_EXPORT_PATH", "/music/Exports/iPod"))
IPOD = Path(os.getenv("IPOD_MOUNT_PATH", "/media/IPOD"))

for p in [LIBRARY, INCOMING, EXPORT]:
    p.mkdir(parents=True, exist_ok=True)

AUDIO_EXTS = {".mp3", ".m4a", ".aac", ".flac", ".wav", ".ogg", ".alac"}

class PlaylistCreate(BaseModel):
    name: str

class PlaylistTrackAdd(BaseModel):
    playlist: str
    relative_paths: list[str]

class SyncRequest(BaseModel):
    source_subdir: Optional[str] = ""
    target_subdir: Optional[str] = "Music"

def audio_files_in(root: Path):
    out = []
    if not root.exists():
        return out
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTS:
            out.append({
                "name": path.name,
                "relative_path": str(path.relative_to(root)),
                "size": path.stat().st_size
            })
    return sorted(out, key=lambda x: x["relative_path"].lower())

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/dashboard")
def dashboard():
    tracks = audio_files_in(LIBRARY)
    playlists_dir = EXPORT / "playlists"
    playlists = list(playlists_dir.glob("*.m3u8")) if playlists_dir.exists() else []
    return {
        "library_path": str(LIBRARY),
        "incoming_path": str(INCOMING),
        "export_path": str(EXPORT),
        "track_count": len(tracks),
        "playlist_count": len(playlists),
    }

@app.get("/library/tracks")
def library_tracks():
    return {"items": audio_files_in(LIBRARY)}

@app.get("/export/tracks")
def export_tracks():
    return {"items": audio_files_in(EXPORT)}

@app.post("/library/scan")
def library_scan():
    return {"items": audio_files_in(LIBRARY), "count": len(audio_files_in(LIBRARY))}

@app.post("/playlists")
def create_playlist(payload: PlaylistCreate):
    playlists_dir = EXPORT / "playlists"
    playlists_dir.mkdir(parents=True, exist_ok=True)
    playlist = playlists_dir / f"{payload.name}.m3u8"
    if not playlist.exists():
        playlist.write_text("#EXTM3U\n", encoding="utf-8")
    return {"ok": True, "path": str(playlist)}

@app.get("/playlists")
def list_playlists():
    playlists_dir = EXPORT / "playlists"
    playlists_dir.mkdir(parents=True, exist_ok=True)
    items = []
    for p in sorted(playlists_dir.glob("*.m3u8")):
        items.append({"name": p.stem, "path": str(p)})
    return {"items": items}

@app.post("/playlists/add")
def add_to_playlist(payload: PlaylistTrackAdd):
    playlists_dir = EXPORT / "playlists"
    playlists_dir.mkdir(parents=True, exist_ok=True)
    playlist = playlists_dir / f"{payload.playlist}.m3u8"
    if not playlist.exists():
        playlist.write_text("#EXTM3U\n", encoding="utf-8")
    existing = playlist.read_text(encoding="utf-8").splitlines()
    lines = [x for x in existing if x.strip()]
    if not lines or lines[0] != "#EXTM3U":
        lines = ["#EXTM3U"] + lines
    for rel in payload.relative_paths:
        rel_path = Path(rel)
        src = LIBRARY / rel_path
        if not src.exists():
            continue
        dest = EXPORT / "music" / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copy2(src, dest)
        m3u_rel = Path("..") / "music" / rel_path
        line = str(m3u_rel).replace("\\", "/")
        if line not in lines:
            lines.append(line)
    playlist.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return {"ok": True, "count": len(lines) - 1}

@app.get("/ipod/status")
def ipod_status():
    mounted = IPOD.exists() and IPOD.is_dir()
    usage = None
    if mounted:
        try:
            total, used, free = shutil.disk_usage(IPOD)
            usage = {"total": total, "used": used, "free": free}
        except Exception:
            usage = None
    top = []
    if mounted:
        for p in sorted(IPOD.iterdir()):
            top.append({"name": p.name, "is_dir": p.is_dir()})
    return {
        "mounted": mounted,
        "mount_path": str(IPOD),
        "usage": usage,
        "entries": top,
        "mode_hint": "Direct copy works best with Rockbox or storage-mode use."
    }

@app.get("/ipod/browse")
def ipod_browse(subpath: str = ""):
    root = (IPOD / subpath).resolve()
    if not str(root).startswith(str(IPOD.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not root.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    items = []
    for p in sorted(root.iterdir()):
        items.append({
            "name": p.name,
            "is_dir": p.is_dir(),
            "size": p.stat().st_size if p.is_file() else None,
            "relative_path": str(p.relative_to(IPOD))
        })
    return {"items": items, "current": str(root.relative_to(IPOD)) if root != IPOD else ""}

@app.post("/ipod/sync")
def ipod_sync(payload: SyncRequest):
    if not IPOD.exists():
        raise HTTPException(status_code=400, detail=f"iPod mount path not found: {IPOD}")
    source = (EXPORT / (payload.source_subdir or "")).resolve()
    if not source.exists():
        raise HTTPException(status_code=404, detail="Export source not found")
    target = (IPOD / (payload.target_subdir or "Music")).resolve()
    if not str(target).startswith(str(IPOD.resolve())):
        raise HTTPException(status_code=400, detail="Invalid target path")
    copied = 0
    for path in source.rglob("*"):
        if path.is_file():
            rel = path.relative_to(source)
            dest = target / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)
            copied += 1
    return {"ok": True, "copied_files": copied, "target": str(target)}

@app.get("/settings")
def settings():
    return {
        "library": str(LIBRARY),
        "incoming": str(INCOMING),
        "export": str(EXPORT),
        "ipod_mount": str(IPOD),
    }
