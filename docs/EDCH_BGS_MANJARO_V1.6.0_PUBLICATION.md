# EDCH BGS Manjaro — incremental additions v1.5.0 to v1.6.0

**Unofficial experimental contribution**, based on [BKNadir/edch](https://github.com/BKNadir/edch) at EDCH v0.10.11. The local tags v1.5.x–v1.6.0 are **not upstream releases**.

The BGS and French HOTAS/keyboard features from v1.0–v1.4.9.2 are retained on the parent branch. This continuation adds:

| Internal patch | Added functionality |
| --- | --- |
| v1.5.0 | Journal-event observer, safe action protocol and an opt-in local background worker |
| v1.5.1 | Four-tab BGS workspace and COG agent console with read-only worker diagnostics |
| v1.5.2 | Durable IndexedDB queue with acknowledgements, bounded retry and recovery |
| v1.5.3 | Local SQLite agent memory via constrained Rust commands |
| v1.5.4 | Local BGS alerts using deterministic rules, user-editable thresholds and deduplication |
| v1.6.0 | Three sequential logical roles: Observer, Rule Analyst, Independent Verifier, in one Web Worker |

**Not AI agents.** There are no Mistral/API calls and no game input automation. BGS changes are not attributed as precise influence earned by an individual CMDR. No personal journals, Commander history, API secrets, databases or `.binds` are committed.

## Build / verification

```bash
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
npm run app:build
```

On Manjaro/NVIDIA, if WebKitGTK triggers GBM buffer errors:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 src-tauri/target/release/edch
```

**Validation status:** source logic from the v1.6.0 archive passed 51 isolated JS tests, 10 patch-install tests, and TypeScript fixture strict checks; that does not establish that this GitHub branch has passed its full build or live game testing. GitHub CI and real Manjaro/Proton tests remain necessary. The integration is published for review, not declared production-ready. Please review safety, storage boundaries, browser compatibility, Rust integration, translations, and platform compatibility before merging upstream.

This branch preserves the upstream MIT license and credits; it is **not an official EDCH release**.
