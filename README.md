# jKanban

A simple Tauri desktop kanban board with yellow sticky-note cards.

- Up to 8 projects, each on its own tab. Click + to add one, double-click a tab to rename it.
- Drag cards between and within columns; drag a column by its header to reorder.
- Click a card (or press Enter) to edit or delete it. Alt + arrow keys move a focused card.
- The board is saved to `board.json` in the app data directory (`~/.local/share/com.jbernadas.jkanban/` on Linux).

## Build with Docker

Needs only Docker (with BuildKit). No Rust or Node toolchain is required on the host.

```sh
npm run docker:build   # or: docker build --target export --output type=local,dest=release .
```

This writes `.deb`, `.rpm` and `.AppImage` bundles to `release/`. To build only some of them, e.g. if GitHub is down (the AppImage step downloads tools from it), run `docker build --build-arg BUNDLES=deb,rpm --target export --output type=local,dest=release .` Rust and npm caches persist between builds, so rebuilds are much faster.

## Install, update and remove

Build the bundles first (see above), then use the one that fits your distro. All three leave your board alone: it lives in `~/.local/share/com.jbernadas.jkanban/`, outside the package.

To update, bump `version` in `src-tauri/tauri.conf.json` before rebuilding. apt and dnf skip a package whose version is already installed. To reinstall a rebuild without changing the version, use `sudo apt install --reinstall ./release/<file>.deb` or `sudo dnf reinstall ./release/<file>.rpm`.

### Debian / Ubuntu (.deb)

Installs `/usr/bin/jkanban` and a jKanban entry in the app menu.

```sh
# Install
sudo apt install ./release/jkanban_0.1.0_amd64.deb

# Update: rebuild, then install the new .deb over the old one
sudo apt install ./release/jkanban_<version>_amd64.deb

# Remove
sudo apt remove jkanban
```

### Fedora / RHEL / openSUSE (.rpm)

```sh
# Install
sudo dnf install ./release/jkanban-0.1.0-1.x86_64.rpm

# Update: rebuild, then upgrade to the new .rpm
sudo dnf upgrade ./release/jkanban-<version>-1.x86_64.rpm

# Remove
sudo dnf remove jkanban
```

On openSUSE, use `sudo zypper install` / `sudo zypper remove` instead.

### Any distro (.AppImage)

An AppImage is a single file that runs without installing. It doesn't add an app-menu entry.

```sh
# Install
mkdir -p ~/Applications
cp release/jkanban_0.1.0_amd64.AppImage ~/Applications/jkanban.AppImage
chmod +x ~/Applications/jkanban.AppImage
~/Applications/jkanban.AppImage

# Update: rebuild, then copy the new AppImage over the old one
cp release/jkanban_<version>_amd64.AppImage ~/Applications/jkanban.AppImage

# Remove
rm ~/Applications/jkanban.AppImage
```

If it fails to start with a FUSE error, install `libfuse2` (`sudo apt install libfuse2t64` on Ubuntu 24.04+, `libfuse2` on older releases).

### Deleting your board

Removing the app keeps your board. To delete it too:

```sh
rm -rf ~/.local/share/com.jbernadas.jkanban
```

### Launching from VS Code's terminal

If VS Code is installed as a snap, the .deb/.rpm build may crash when started from its integrated terminal (`symbol lookup error ... __libc_pthread_init`), because the snap's library paths leak into it. Start it from the app menu or a regular terminal instead. The AppImage isn't affected.

## Develop locally

`npm run dev` serves the UI in a browser at http://localhost:1420, saving to localStorage.
`npm run tauri dev` runs the real desktop app; it needs the Rust toolchain and the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux).
