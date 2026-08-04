<!-- taurus-dev-rules -->
## Before doing anything in this repo

**GitHub is the source of truth. This machine is a cache.** Rules live in one place:
`github.com/sheiss94/taurus-ops` → `DEV_PROCESS.md`. Read it; it wins over anything here.

```sh
cd ~/taurus-ops && git pull -q && ./bin/repo-status   # what is at risk right now
git pull -q && git status -sb                         # what am I standing on
```

- **Edit on the dell** (`ssh home`). It is the only machine with GitHub credentials.
- **Push before switching machines.** An unpushed commit is not saved.
- **Never `git add -A` without reading what it staged** — it once staged 11,189 venv files.
- **Dry-run every deploy** (`rsync -avnc`). Production has been ahead of git before; deploying
  the repo copy over it deletes work.
- **Update this file in the same commit as the change it describes** — the version in git is the
  one the next session reads.
<!-- /taurus-dev-rules -->