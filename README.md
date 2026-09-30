# jKanban

A simple desktop kanban board for Linux and macOS, with yellow sticky-note cards.

- Up to 8 projects, each on its own tab. Click + to add one, double-click a tab to rename it.
- Drag cards between and within columns; drag a column by its header to reorder.
- Click a card (or press Enter) to edit or delete it. Alt + arrow keys move a focused card.
- Your boards are saved to `~/.local/share/com.jbernadas.jkanban/board.json` on Linux and `~/Library/Application Support/com.jbernadas.jkanban/board.json` on macOS.

## Install

Download the file for your system from the [latest release](https://github.com/jbernadas/jkanban/releases/latest). On Linux, jKanban needs a 64-bit distro from about 2022 or later (for example Ubuntu 22.04, Debian 12, or a current Fedora).

### macOS (.dmg)

`jkanban_<version>_universal.dmg` runs on both Apple Silicon and Intel Macs. Open it and drag **jkanban** into **Applications**.

The app isn't signed with an Apple Developer ID, so the first time you open it macOS says it can't verify the developer. Click **Done**, then go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to the jkanban message. You only need to do this once. Or, from a terminal:

```sh
xattr -dr com.apple.quarantine /Applications/jkanban.app
```

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

It should print `OK` for your file. On macOS, run `grep dmg SHA256SUMS | shasum -a 256 -c` instead.

## Update

Download the newer release and install it the same way. It replaces the old version, and your boards are kept. With the AppImage, just use the new file. On macOS, drag the new version into Applications and choose **Replace**.

## Remove

```sh
sudo apt remove jkanban    # .deb
sudo dnf remove jkanban    # .rpm (openSUSE: sudo zypper remove jkanban)
```

For the AppImage, delete the file. On macOS, drag `jkanban` from Applications to the Trash.

Removing the app keeps your boards. To delete them too:

```sh
rm -rf ~/.local/share/com.jbernadas.jkanban                        # Linux
rm -rf ~/Library/Application\ Support/com.jbernadas.jkanban         # macOS
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

### On macOS

Needs the Xcode Command Line Tools (`xcode-select --install`), [Rust](https://rustup.rs) and Node.js 22 or later. Then:

```sh
npm ci
npx tauri build --bundles app,dmg
```

This writes `jkanban.app` to `src-tauri/target/release/bundle/macos/` and a `.dmg` to `src-tauri/target/release/bundle/dmg/`. Copy the app into Applications. A build made on your own Mac isn't quarantined, so macOS opens it without a warning.

For a universal build like the release's, run `rustup target add aarch64-apple-darwin x86_64-apple-darwin` once, then `npx tauri build --target universal-apple-darwin --bundles app,dmg`. The output lands under `src-tauri/target/universal-apple-darwin/release/bundle/`.

### Offline

Each release also has `jkanban-<version>-vendor.tar.xz`, for builds without network access (such as distro packaging). It holds the Rust dependencies and the prebuilt web UI, so Node isn't needed. Extract it over the release's source tarball (both unpack to `jkanban-<version>/`), install the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux) and Rust, then:

```sh
cd jkanban-<version>/src-tauri
cargo build --release --offline --locked --features tauri/custom-protocol
```

The program is `target/release/jkanban`. `src-tauri/jkanban.desktop` is its app-menu entry and `src-tauri/icons/` has its icons.

### Develop locally

`npm run dev` serves the UI in a browser at http://localhost:1420, saving to localStorage.
`npm run tauri dev` runs the real desktop app; it needs the Rust toolchain and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your system.

## Releasing

Pushing a version tag builds the Linux and macOS bundles on GitHub and attaches them to a draft release (see `.github/workflows/release.yml`):

1. Bump `version` in `package.json` and commit.
2. `git tag v<version> && git push origin main v<version>`. The tag must match `package.json`, or the build stops.
3. When the workflow finishes, open the draft on the [Releases page](https://github.com/jbernadas/jkanban/releases), check it, and click **Publish release**.
4. For SlackBuilds.org, once the release is published: run `packaging/slackware/prepare.sh <version>`, test-build on Slackware 15.0 with `packaging/slackware/jkanban/jkanban.SlackBuild` (as root), then upload `packaging/slackware/jkanban.tar.gz` through the form on slackbuilds.org.

The macOS `.dmg` is only ad-hoc signed. To sign it with a Developer ID and notarize it, add the `APPLE_*` repository secrets listed at the top of `release.yml`; the workflow picks them up automatically. With them set, the Gatekeeper steps under [macOS](#macos-dmg) aren't needed.

## License

Copyright (C) 2026 jbernadas

jKanban is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
