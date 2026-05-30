#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Installs everything a fresh, ephemeral web container needs to build, test, and
# run this repo: the .NET SDK 10 for the ASP.NET Core + SignalR backend, and the
# npm dependencies for the shared protocol package and the two front-ends.
#
# Synchronous (no `{"async": true}`): the session waits until deps are ready, so
# Claude never races ahead and runs `dotnet`/`ng`/`vite` before they exist.
# Idempotent and safe to run repeatedly.
set -euo pipefail

# Web-only: on a developer's own machine the toolchain is already present.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# --- .NET SDK 10 -----------------------------------------------------------
# dot.net / aka.ms are network-blocked in this environment, so install from the
# packages.microsoft.com apt repo instead. NuGet (api.nuget.org) is reachable.
if ! command -v dotnet >/dev/null 2>&1; then
  echo "[session-start] Installing .NET SDK 10 from packages.microsoft.com…"
  # shellcheck disable=SC1091
  . /etc/os-release
  deb="/tmp/packages-microsoft-prod.deb"
  url="https://packages.microsoft.com/config/${ID}/${VERSION_ID}/packages-microsoft-prod.deb"
  if curl -fsSL "$url" -o "$deb" || wget -qO "$deb" "$url"; then
    dpkg -i "$deb" || true
    apt-get update -y
    # Prefer .NET 10; fall back to 9 if only that is published for this distro.
    apt-get install -y dotnet-sdk-10.0 || apt-get install -y dotnet-sdk-9.0 || \
      echo "[session-start] WARN: dotnet-sdk install failed; build the server locally." >&2
  else
    echo "[session-start] WARN: could not fetch the Microsoft apt repo; skipping .NET." >&2
  fi
fi

# --- npm dependencies ------------------------------------------------------
# `npm install` (not `ci`) so the post-hook container cache reuses node_modules.
for dir in packages/protocol apps/client apps/management; do
  if [ -f "$ROOT/$dir/package.json" ]; then
    echo "[session-start] npm install — $dir"
    npm install --prefix "$ROOT/$dir"
  fi
done

# --- warm the NuGet restore (faster first server build) --------------------
if command -v dotnet >/dev/null 2>&1 && [ -f "$ROOT/server/Lumessa.sln" ]; then
  echo "[session-start] dotnet restore — server/Lumessa.sln"
  dotnet restore "$ROOT/server/Lumessa.sln" || true
fi

echo "[session-start] done."
