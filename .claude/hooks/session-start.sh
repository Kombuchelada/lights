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

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# --- enforce the repo's committed git hooks --------------------------------
# Point git at .githooks/ (committed, so the pre-commit lint:css guard travels
# with the repo). Runs on every machine — git hooks aren't shared via clone, so
# this is the only thing that turns them on. Cheap and idempotent.
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" config core.hooksPath .githooks || true
fi

# Web-only below: on a developer's own machine the toolchain is already present.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# --- sync the working branch with main -------------------------------------
# `main` is the deploy trunk (push to main → Railway auto-rebuilds). New web
# sessions fork from the repo's default branch, which can drift behind `main`
# as other sessions land work there — so a session would start on stale code
# and its changes would later "need to be merged". Catch the branch up to
# `origin/main` here, at session start, before any work exists to conflict.
#
# Scope is deliberately conservative: fast-forward only. If the branch is
# *behind* main (the drift we're fixing) it advances cleanly with no merge
# commit and no git identity required. Anything riskier — a dirty tree or a
# branch that has truly diverged — is left untouched with a loud warning so a
# human (or Claude) resolves it intentionally. Never fatal to the hook.
sync_branch_with_main() {
  command -v git >/dev/null 2>&1 || return 0
  git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0

  echo "[session-start] git fetch origin (sync with main)…"
  git -C "$ROOT" fetch --quiet origin 2>/dev/null || {
    echo "[session-start] WARN: git fetch failed; skipping branch sync." >&2; return 0; }

  git -C "$ROOT" rev-parse --verify --quiet origin/main >/dev/null || {
    echo "[session-start] no origin/main; skipping branch sync." >&2; return 0; }

  local branch
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  if [ "$branch" = "main" ] || [ "$branch" = "HEAD" ]; then
    echo "[session-start] on '$branch'; skipping branch sync."; return 0
  fi

  # Don't touch a branch that already carries uncommitted work.
  if ! git -C "$ROOT" diff --quiet || ! git -C "$ROOT" diff --cached --quiet; then
    echo "[session-start] WARN: working tree dirty; skipping branch sync." >&2; return 0
  fi

  # Already current?
  if git -C "$ROOT" merge-base --is-ancestor origin/main HEAD; then
    echo "[session-start] '$branch' already up to date with main."; return 0
  fi

  # Strictly behind → clean fast-forward. Diverged → leave for a human.
  if git -C "$ROOT" merge --ff-only origin/main >/dev/null 2>&1; then
    echo "[session-start] fast-forwarded '$branch' to origin/main."
  else
    echo "[session-start] WARN: '$branch' has diverged from main; not auto-merging." >&2
    echo "[session-start]       Run 'git merge origin/main' (or rebase) and resolve manually." >&2
  fi
}
sync_branch_with_main

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
