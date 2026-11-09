#!/usr/bin/env bash
# One task = one branch = one worktree folder (course requirement: git worktree).
#
#   npm run wt:new  -- p2/events            # new branch from origin/main, in its own folder
#   npm run wt:new  -- p3/webhook main      # ...or from another base
#   npm run wt:open -- origin/p3/webhook    # check out someone's branch to review/run it (detached)
#   npm run wt:list                          # every worktree + its branch
#   npm run wt:rm   -- p2/events            # remove the folder (the branch stays)
#
# Folders live NEXT TO the repo, never inside it:
#   PRD_HELPDESK/                 ← main clone (stay on main: pull, review, merge)
#   PRD_HELPDESK.worktrees/p2-events/
#   PRD_HELPDESK.worktrees/review-p3-webhook/
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
# Always resolve the MAIN clone (works when run from inside a worktree too)
MAIN="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
BASE_DIR="${MAIN}.worktrees"

usage() { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
folder_for() { echo "$BASE_DIR/$(echo "$1" | sed 's#^origin/##; s#[/ ]#-#g')"; }

setup() { # $1 = worktree path — make it runnable on its own
  local dir="$1"
  if [ -f "$MAIN/.dev.vars" ]; then cp "$MAIN/.dev.vars" "$dir/.dev.vars"; else cp "$dir/dev.vars.example" "$dir/.dev.vars"; fi
  (cd "$dir" && npm ci --silent && npm run db:local:fresh --silent >/dev/null)
  echo
  echo "Ready: $dir"
  echo "  cd \"$dir\""
  echo "  npm run dev -- --port 8788      # use a different port from your main folder (8787)"
}

cmd="${1:-}"; shift || true
case "$cmd" in
  new)
    branch="${1:-}"; base="${2:-origin/main}"
    [ -n "$branch" ] || usage
    git fetch --quiet origin
    dir="$(folder_for "$branch")"
    mkdir -p "$BASE_DIR"
    if git show-ref --verify --quiet "refs/heads/$branch"; then
      git worktree add "$dir" "$branch"              # branch exists locally → reuse it
    else
      git worktree add -b "$branch" "$dir" "$base"   # new branch from base
    fi
    setup "$dir"
    echo "  (when done)  git push -u origin $branch  → open a Pull Request"
    ;;
  open)
    ref="${1:-}"; [ -n "$ref" ] || usage
    git fetch --quiet origin
    dir="$BASE_DIR/review-$(echo "$ref" | sed 's#^origin/##; s#[/ ]#-#g')"
    mkdir -p "$BASE_DIR"
    git worktree add --detach "$dir" "$ref"
    setup "$dir"
    echo "  (review)  npm test && npm run typecheck && bash scripts/smoke.sh"
    ;;
  list)
    git worktree list
    ;;
  rm)
    target="${1:-}"; [ -n "$target" ] || usage
    dir="$target"
    [ -d "$dir" ] || dir="$(folder_for "$target")"
    [ -d "$dir" ] || dir="$BASE_DIR/review-$(echo "$target" | sed 's#^origin/##; s#[/ ]#-#g')"
    git worktree remove "$dir"
    git worktree prune
    echo "Removed $dir (the branch is still there: git branch -a)"
    ;;
  *) usage ;;
esac
