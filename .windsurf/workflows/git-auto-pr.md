---
description: Git automation - add/commit/push/PR/auto-merge in one command
---

# Git Auto-PR Workflow

One-command git workflow: stage → commit → push → PR → auto-merge.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated: `gh auth login`
- Repo must have auto-merge enabled in GitHub settings

## Usage

```bash
# Run from repo root
git-auto-pr "Your commit message here"
```

## What it does

1. `git add -A` - Stage all changes
2. `git commit -m "message"` - Commit with provided message
3. `git push origin $(current_branch)` - Push to current branch
4. `gh pr create --fill` - Create PR with auto-generated title/body
5. `gh pr merge --auto --squash` - Enable auto-merge (squash strategy)

## Setup

Add to `~/.bashrc` or `~/.zshrc`:

```bash
git-auto-pr() {
  if [ -z "$1" ]; then
    echo "Usage: git-auto-pr \"commit message\""
    return 1
  fi

  local branch=$(git branch --show-current)
  local has_changes=$(git status --porcelain)

  if [ -z "$has_changes" ]; then
    echo "No changes to commit"
    return 0
  fi

  echo "[1/5] Staging changes..."
  git add -A

  echo "[2/5] Committing: $1"
  git commit -m "$1" || return 1

  echo "[3/5] Pushing to $branch..."
  git push origin "$branch" || return 1

  echo "[4/5] Creating PR..."
  local pr_url=$(gh pr create --fill 2>&1)
  if [ $? -ne 0 ]; then
    echo "PR creation failed: $pr_url"
    return 1
  fi
  echo "PR created: $pr_url"

  echo "[5/5] Enabling auto-merge..."
  gh pr merge --auto --squash || echo "Auto-merge may require PR checks to pass first"

  echo "Done. Check status with: gh pr view --web"
}
```

Then reload: `source ~/.bashrc`

## Check Status

```bash
# View PR status in terminal
gh pr view

# Open PR in browser
gh pr view --web

# Watch checks until complete (alias this too)
gh-watch() {
  while true; do
    clear
    gh pr checks
    sleep 10
  done
}
```
