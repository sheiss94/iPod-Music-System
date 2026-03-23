# iPod Music System Fullstack v2

This is a Dockerized FastAPI + React starter for managing a local offline music library and interacting with a mounted classic iPod on Linux.

## What changed from v1

- Frontend is forced to bind to `0.0.0.0`, so the browser should open on `http://localhost:5173`
- Added an iPod page and backend endpoints
- Added mount detection, storage stats, and export-to-device copy
- Best for Linux, especially if the iPod is Rockbox-enabled or mounted as a storage device

## Start

```bash
cp .env.example .env
mkdir -p ~/MusicVault/{Library,Incoming,Exports/iPod}
docker compose up --build
```

Frontend: http://localhost:5173  
API docs: http://localhost:8000/docs

## iPod notes

For Linux, the easiest direct interaction is when the iPod mounts like a normal storage device.

- Rockbox: ideal, direct file copy works well
- Apple firmware: mount detection and file copy can still work, but full native iTunesDB management usually needs extra tooling like libgpod/gtkpod

This project currently supports:
- Detect mounted iPod path
- Show storage totals
- Copy exported music packs to the iPod mount
- Browse mounted folders

## Suggested mount path

Use your file manager or `lsblk` / `mount` to find the actual iPod mount. Then update `.env`.

Example:
```bash
IPOD_MOUNT_PATH=/run/media/shain/IPOD
```
# iPod-Music-System
