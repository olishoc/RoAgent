# RoAgent Feature Roadmap

## Core Improvements

- [x] **Watch local `.lua` files** — edit locally, auto-sync to Studio
- [x] **Git versioning** — track changes, revert to earlier versions
- [ ] **Bidirectional diff** — show what changed before applying

## Studio → Pi

- [x] **Console capture** — stream Studio `print()` output to Pi terminal
- [x] **Error forwarding** — push script errors/exceptions to Pi
- [ ] **Game state inspection** — query workspace, players, parts via API
- [ ] **Selection sync** — Pi sees what you have selected in Studio

## Pi → Studio

- [ ] **Batch operations** — push multiple scripts in one request
- [ ] **Templates** — Pi can create scripts from templates/snippets
- [ ] **Search & replace** — find scripts by name/content, modify in bulk
- [ ] **Dependency graph** — show which scripts require() which

## Workflow

- [ ] **Auto-restart scripts** — after pushing, hot-reload without re-running manually
- [ ] **Dry-run mode** — preview changes before applying
- [ ] **Team sync** — multiple people pushing without conflicts
- [ ] **Backup on sync** — keep history of script versions

## UX

- [x] **Script browser** — list/search all scripts from Pi
- [ ] **Inline errors** — show push failures in Studio output
- [x] **Status indicator** — toolbar shows live feed status

---

## Implementation Order

1. ~~Console capture~~
2. ~~Error forwarding~~
3. ~~Status indicator in toolbar~~
4. ~~Script browser API~~
5. ~~Watch local .lua files~~
6. ~~Git versioning~~ ← DONE
7. **Bidirectional diff** ← NEXT
8. Batch operations
9. Search & replace
10. Auto-restart scripts
11. Game state inspection
12. Dependency graph
13. Templates
14. Dry-run mode
15. Team sync
16. Backup on sync