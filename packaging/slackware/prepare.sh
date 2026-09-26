#!/bin/bash
# Prepares the SlackBuilds.org submission for a published GitHub release:
#
#   packaging/slackware/prepare.sh 0.1.8
#
# Sets the version in jkanban.info and jkanban.SlackBuild, downloads both
# sources into jkanban/ (so you can test-build right there), fills in their
# MD5SUMs, and writes jkanban.tar.gz, the file to upload to slackbuilds.org.

set -euo pipefail

VERSION=${1:?usage: $0 <version, e.g. 0.1.8>}
cd "$(dirname "$0")"

REPO=https://github.com/jbernadas/jkanban
SRC_URL=$REPO/archive/v$VERSION/jkanban-$VERSION.tar.gz
VENDOR_URL=$REPO/releases/download/v$VERSION/jkanban-$VERSION-vendor.tar.xz

for url in "$SRC_URL" "$VENDOR_URL"; do
  echo "Downloading $url"
  curl -fL --progress-bar -o "jkanban/$(basename "$url")" "$url" || {
    echo "Download failed. Is release v$VERSION published on GitHub?" >&2
    exit 1
  }
done
SRC_MD5=$(md5sum "jkanban/jkanban-$VERSION.tar.gz" | cut -d' ' -f1)
VENDOR_MD5=$(md5sum "jkanban/jkanban-$VERSION-vendor.tar.xz" | cut -d' ' -f1)

# Keep the maintainer fields as they are.
# shellcheck source=/dev/null
. jkanban/jkanban.info

cat > jkanban/jkanban.info <<EOF
PRGNAM="jkanban"
VERSION="$VERSION"
HOMEPAGE="$REPO"
DOWNLOAD="$SRC_URL \\
          $VENDOR_URL"
MD5SUM="$SRC_MD5 \\
        $VENDOR_MD5"
DOWNLOAD_x86_64=""
MD5SUM_x86_64=""
REQUIRES="$REQUIRES"
MAINTAINER="$MAINTAINER"
EMAIL="$EMAIL"
EOF

sed -i "s/^VERSION=\${VERSION:-.*}\$/VERSION=\${VERSION:-$VERSION}/" jkanban/jkanban.SlackBuild

echo "jkanban.info and jkanban.SlackBuild set to $VERSION; sources are in jkanban/."

if [ "$EMAIL" = "CHANGE-ME" ]; then
  echo "EMAIL in jkanban/jkanban.info is still CHANGE-ME, so no submission tarball was made." >&2
  exit 1
fi

tar -czf jkanban.tar.gz --exclude='*.tar.gz' --exclude='*.tar.xz' jkanban
echo "Upload this to slackbuilds.org: $(pwd)/jkanban.tar.gz"
