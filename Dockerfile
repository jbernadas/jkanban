# syntax=docker/dockerfile:1.7
#
# Builds jKanban's Linux desktop bundles (.deb, .rpm, .AppImage) in a container.
#
#   docker build --target export --output type=local,dest=release .
#
# The bundles land in ./release on the host.
# Add --build-arg BUNDLES=deb,rpm to skip the AppImage.

FROM rust:1-bookworm AS build

# Tauri v2 Linux build deps: https://v2.tauri.app/start/prerequisites/#linux
RUN apt-get update && apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev \
      librsvg2-dev build-essential curl wget file rpm xdg-utils ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

# Comma-separated bundle types, e.g. --build-arg BUNDLES=deb to skip the rest.
ARG BUNDLES=deb,rpm,appimage

# linuxdeploy (used for the AppImage) is itself an AppImage and there's no FUSE
# in a container, so it has to extract-and-run.
ENV APPIMAGE_EXTRACT_AND_RUN=1 NO_STRIP=true
# /root/.cache/tauri keeps the AppImage tooling Tauri downloads from GitHub.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/src-tauri/target \
    --mount=type=cache,target=/root/.cache/tauri \
    rm -rf src-tauri/target/release/bundle \
 && npx tauri build --bundles "$BUNDLES" \
 && mkdir -p /out \
 && find src-tauri/target/release/bundle -maxdepth 2 \
      \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' \) -exec cp {} /out/ \;

FROM scratch AS export
COPY --from=build /out /
