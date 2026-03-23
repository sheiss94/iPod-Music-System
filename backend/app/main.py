from typing import Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import os
import shutil
import datetime

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


class ImportRequest(BaseModel):
    source_subdir: Optional[str] = "iPod_Control/Music"
    flatten_folders: bool = False
    skip_existing: bool = True


def audio_files_in(root: Path):
    out = []
    if not root.exists():
        return out
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTS:
            out.append(
                {
                    "name": path.name,
                    "relative_path": str(path.relative_to(root)),
                    "size": path.stat().st_size,
                }
            )
    return sorted(out, key=lambda x: x["relative_path"].lower())


def safe_resolve(base: Path, subpath: str = "") -> Path:
    candidate = (base / (subpath or "")).resolve()
    base_resolved = base.resolve()
    if not str(candidate).startswith(str(base_resolved)):
        raise HTTPException(status_code=400, detail="Invalid path")
    return candidate


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/dashboard")
def dashboard():
    tracks = audio_files_in(LIBRARY)
    export_tracks = audio_files_in(EXPORT)
    playlists_dir = EXPORT / "playlists"
    playlists = list(playlists_dir.glob("*.m3u8")) if playlists_dir.exists() else []
    ipod_mounted = IPOD.exists() and IPOD.is_dir()

    return {
        "library_path": str(LIBRARY),
        "incoming_path": str(INCOMING),
        "export_path": str(EXPORT),
        "ipod_mount_path": str(IPOD),
        "track_count": len(tracks),
        "export_track_count": len(export_tracks),
        "playlist_count": len(playlists),
        "ipod_mounted": ipod_mounted,
    }


@app.get("/library/tracks")
def library_tracks():
    return {"items": audio_files_in(LIBRARY)}


@app.post("/library/scan")
def library_scan():
    items = audio_files_in(LIBRARY)
    return {"items": items, "count": len(items)}


@app.get("/export/tracks")
def export_tracks():
    return {"items": audio_files_in(EXPORT)}


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
    items = [{"name": p.stem, "path": str(p)} for p in sorted(playlists_dir.glob("*.m3u8"))]
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

        m3u_rel = (Path("..") / "music" / rel_path).as_posix()
        if m3u_rel not in lines:
            lines.append(m3u_rel)

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
        try:
            for p in sorted(IPOD.iterdir()):
                top.append({"name": p.name, "is_dir": p.is_dir()})
        except Exception:
            pass

    return {
        "mounted": mounted,
        "mount_path": str(IPOD),
        "usage": usage,
        "entries": top,
        "mode_hint": "Direct copy works best with Rockbox or storage-mode use.",
    }


@app.get("/ipod/browse")
def ipod_browse(subpath: str = ""):
    root = safe_resolve(IPOD, subpath)
    if not root.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    items = []
    for p in sorted(root.iterdir()):
        items.append(
            {
                "name": p.name,
                "is_dir": p.is_dir(),
                "size": p.stat().st_size if p.is_file() else None,
                "relative_path": str(p.relative_to(IPOD)),
            }
        )

    parent = ""
    if root != IPOD:
        parent = str(root.parent.relative_to(IPOD)) if root.parent != IPOD else ""

    return {
        "items": items,
        "current": str(root.relative_to(IPOD)) if root != IPOD else "",
        "parent": parent,
    }


@app.get("/ipod/audio")
def ipod_audio(subpath: str = "iPod_Control/Music"):
    root = safe_resolve(IPOD, subpath)
    if not root.exists():
        return {"items": [], "count": 0, "subpath": subpath}

    items = audio_files_in(root)
    return {"items": items, "count": len(items), "subpath": subpath}


@app.get("/ipod/search")
def ipod_search(query: str):
    if not IPOD.exists():
        raise HTTPException(status_code=400, detail="iPod not mounted")

    q = query.strip().lower()
    if not q:
        return {"items": []}

    results = []
    for path in IPOD.rglob("*"):
        if path.is_file() and q in path.name.lower():
            results.append(
                {
                    "name": path.name,
                    "relative_path": str(path.relative_to(IPOD)),
                    "size": path.stat().st_size,
                }
            )
            if len(results) >= 500:
                break

    return {"items": results}


@app.post("/ipod/import")
def ipod_import(payload: ImportRequest):
    if not IPOD.exists():
        raise HTTPException(status_code=400, detail=f"iPod mount path not found: {IPOD}")

    source = safe_resolve(IPOD, payload.source_subdir or "")
    if not source.exists():
        raise HTTPException(status_code=404, detail=f"Source not found: {source}")

    copied = 0
    skipped = 0

    for path in source.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in AUDIO_EXTS:
            continue

        rel = path.relative_to(source)
        dest = (LIBRARY / path.name) if payload.flatten_folders else (LIBRARY / rel)
        dest.parent.mkdir(parents=True, exist_ok=True)

        if dest.exists() and payload.skip_existing:
            skipped += 1
            continue

        shutil.copy2(path, dest)
        copied += 1

    return {
        "ok": True,
        "copied_files": copied,
        "skipped_files": skipped,
        "source": str(source),
        "library": str(LIBRARY),
    }


@app.post("/ipod/delete")
def ipod_delete(relative_path: str = Body(..., embed=True)):
    if not IPOD.exists():
        raise HTTPException(status_code=400, detail="iPod not mounted")

    target = safe_resolve(IPOD, relative_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File or folder not found")

    if target.is_file():
        target.unlink()
    else:
        shutil.rmtree(target)

    return {"ok": True, "deleted": relative_path}


@app.post("/ipod/backup")
def ipod_backup():
    if not IPOD.exists():
        raise HTTPException(status_code=400, detail="iPod not mounted")

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = LIBRARY / f"_ipod_backup_{timestamp}"

    shutil.copytree(IPOD, backup_dir)
    return {"ok": True, "backup_path": str(backup_dir)}


@app.post("/ipod/sync")
def ipod_sync(payload: SyncRequest):
    if not IPOD.exists():
        raise HTTPException(status_code=400, detail=f"iPod mount path not found: {IPOD}")

    source = safe_resolve(EXPORT, payload.source_subdir or "")
    if not source.exists():
        raise HTTPException(status_code=404, detail="Export source not found")

    target = safe_resolve(IPOD, payload.target_subdir or "Music")
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
        "library_exists": LIBRARY.exists(),
        "incoming_exists": INCOMING.exists(),
        "export_exists": EXPORT.exists(),
        "ipod_exists": IPOD.exists(),
    }
