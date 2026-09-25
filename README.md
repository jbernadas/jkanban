# jkanban

A Tauri desktop kanban board with yellow sticky-note cards.

- Drag cards between and within columns; drag a column by its header to reorder.
- Click a card (or press Enter) to edit or delete it. Alt + arrow keys move a focused card.
- The board is saved to `board.json` in the app data directory (`~/.local/share/com.jbernadas.jkanban/` on Linux).

## Build with Docker

Needs only Docker (with BuildKit). No Rust or Node toolchain is required on the host.

```sh
npm run docker:build   # or: docker build --target export --output type=local,dest=release .
```

This writes `.deb`, `.rpm` and `.AppImage` bundles to `release/`. To build only some of them, e.g. if GitHub is down (the AppImage step downloads tools from it), run `docker build --build-arg BUNDLES=deb,rpm --target export --output type=local,dest=release .` Rust and npm caches persist between builds, so rebuilds are much faster.

## Develop locally

`npm run dev` serves the UI in a browser at http://localhost:1420, saving to localStorage.
`npm run tauri dev` runs the real desktop app; it needs the Rust toolchain and the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux).
