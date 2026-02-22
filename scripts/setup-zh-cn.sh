#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd || pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd || pwd)"

SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build)
      SKIP_BUILD=1
      ;;
    *)
      echo "error: unknown argument: $arg" >&2
      echo "usage: ./scripts/setup-zh-cn.sh [--skip-build]" >&2
      exit 1
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm is required" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required" >&2
  exit 1
fi

cd "$REPO_ROOT"

if [[ ! -d .git ]]; then
  echo "error: this script must be run inside the zeroclaw git repository" >&2
  exit 1
fi

echo "==> configuring git hooks path"
git config core.hooksPath .githooks

if [[ ! -x .githooks/post-merge ]]; then
  echo "warning: .githooks/post-merge is missing or not executable" >&2
  echo "         auto zh sync after pull may not run until this file exists." >&2
fi

echo "==> installing web dependencies"
npm --prefix web install

echo "==> syncing zh-CN locale"
npm --prefix web run i18n:sync:zh

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "==> building web for verification"
  npm --prefix web run build
else
  echo "==> skip build (--skip-build)"
fi

echo "==> done"
echo "   - hooksPath: $(git config --get core.hooksPath)"
echo "   - zh sync command: npm --prefix web run i18n:sync:zh"
