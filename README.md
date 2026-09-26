# jKanban

A simple desktop kanban board for Linux, with yellow sticky-note cards.

- Up to 8 projects, each on its own tab. Click + to add one, double-click a tab to rename it.
- Drag cards between and within columns; drag a column by its header to reorder.
- Click a card (or press Enter) to edit or delete it. Alt + arrow keys move a focused card.
- Your boards are saved to `~/.local/share/com.jbernadas.jkanban/board.json`.

## Install

Download the file for your distro from the [latest release](https://github.com/jbernadas/jkanban/releases/latest). jKanban needs a 64-bit distro from about 2022 or later (for example Ubuntu 22.04, Debian 12, or a current Fedora).

### Debian, Ubuntu, Linux Mint (.deb)

Double-click `jkanban_<version>_amd64.deb` to open it in your software installer, or run:

```sh
sudo apt install ./jkanban_<version>_amd64.deb
```

apt may print a note that the download was "performed unsandboxed as root". That's normal for a file in your home folder and doesn't affect the install.

### Fedora, RHEL, openSUSE (.rpm)

```sh
sudo dnf install ./jkanban-<version>-1.x86_64.rpm      # Fedora / RHEL
sudo zypper install ./jkanban-<version>-1.x86_64.rpm   # openSUSE
```

### Any distro (.AppImage)

An AppImage runs without installing. It doesn't add an app-menu entry.

```sh
chmod +x jkanban_<version>_amd64.AppImage
./jkanban_<version>_amd64.AppImage
```

If it fails with a FUSE error, install `libfuse2` (`sudo apt install libfuse2t64` on Ubuntu 24.04 and later, `libfuse2` on older releases).

### Checking your download

Each release has a `SHA256SUMS` file. Download it next to the file you picked, then run:

```sh
sha256sum -c SHA256SUMS --ignore-missing
```

It should print `OK` for your file.

## Update

Download the newer release and install it the same way. It replaces the old version, and your boards are kept. With the AppImage, just use the new file.

## Remove

```sh
sudo apt remove jkanban    # .deb
sudo dnf remove jkanban    # .rpm (openSUSE: sudo zypper remove jkanban)
```

For the AppImage, delete the file.

Removing the app keeps your boards. To delete them too:

```sh
rm -rf ~/.local/share/com.jbernadas.jkanban
```

## Troubleshooting

**Crashes when started from VS Code's terminal** (`symbol lookup error ... __libc_pthread_init`): if VS Code is installed as a snap, its library paths leak into programs started from its terminal. Start jKanban from the app menu or a regular terminal instead. The AppImage isn't affected.

## Build from source

### With Docker

Needs only Docker (with BuildKit). No Rust or Node toolchain is required on the host.

```sh
npm run docker:build
```

This writes `.deb`, `.rpm` and `.AppImage` bundles to `release/`. To build only some of them, e.g. if GitHub is down (the AppImage step downloads tools from it), run `docker build --build-arg BUNDLES=deb,rpm --target export --output type=local,dest=release .` Rust and npm caches persist between builds, so rebuilds are much faster.

apt and dnf skip a package whose version is already installed, so bump `version` in `package.json` before rebuilding. To reinstall a build without changing the version, use `sudo apt install --reinstall ./<file>.deb` or `sudo dnf reinstall ./<file>.rpm`.

### Offline

Each release also has `jkanban-<version>-vendor.tar.xz`, for builds without network access (such as distro packaging). It holds the Rust dependencies and the prebuilt web UI, so Node isn't needed. Extract it over the release's source tarball (both unpack to `jkanban-<version>/`), install the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux) and Rust, then:

```sh
cd jkanban-<version>/src-tauri
cargo build --release --offline --locked --features tauri/custom-protocol
```

The program is `target/release/jkanban`. `src-tauri/jkanban.desktop` is its app-menu entry and `src-tauri/icons/` has its icons.

### Develop locally

`npm run dev` serves the UI in a browser at http://localhost:1420, saving to localStorage.
`npm run tauri dev` runs the real desktop app; it needs the Rust toolchain and the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux).

## Releasing

Pushing a version tag builds the bundles on GitHub and attaches them to a draft release (see `.github/workflows/release.yml`):

1. Bump `version` in `package.json` and commit.
2. `git tag v<version> && git push origin main v<version>`. The tag must match `package.json`, or the build stops.
3. When the workflow finishes, open the draft on the [Releases page](https://github.com/jbernadas/jkanban/releases), check it, and click **Publish release**.
4. For SlackBuilds.org, once the release is published: run `packaging/slackware/prepare.sh <version>`, test-build on Slackware 15.0 with `packaging/slackware/jkanban/jkanban.SlackBuild` (as root), then upload `packaging/slackware/jkanban.tar.gz` through the form on slackbuilds.org.

## License

Copyright (C) 2026 jbernadas

jKanban is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
