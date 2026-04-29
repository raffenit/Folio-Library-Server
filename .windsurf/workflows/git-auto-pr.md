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
  local pr_output=$(gh pr create --fill 2>&1)
  local pr_exit=$?
  local pr_num=""
  
  if [ $pr_exit -ne 0 ]; then
    # Check if PR already exists
    if echo "$pr_output" | grep -qi "already exists"; then
      echo "ℹ️  PR already exists, extracting PR number..."
      pr_num=$(echo "$pr_output" | grep -oE '/pull/[0-9]+' | head -1 | cut -d'/' -f3)
      if [ -z "$pr_num" ]; then
        echo "❌ Could not extract PR number from: $pr_output"
        return 1
      fi
      echo "✅ Using existing PR #$pr_num (your push already updated it)"
    else
      echo "❌ PR creation failed: $pr_output"
      return 1
    fi
  else
    echo "✅ PR created: $pr_output"
    # Extract PR number from URL (e.g., https://github.com/owner/repo/pull/35 -> 35)
    pr_num=$(echo "$pr_output" | grep -oE '/pull/[0-9]+$' | cut -d'/' -f3)
  fi

  echo "[5/5] Enabling auto-merge for PR #$pr_num..."
  local merge_output=$(gh pr merge --auto --squash 2>&1)
  local merge_exit=$?
  
  if [ $merge_exit -ne 0 ]; then
    echo "⚠️  Auto-merge setup failed: $merge_output"
    echo "   This usually means:"
    echo "   - Auto-merge is not enabled in repo settings"
    echo "   - Branch protection requires checks that haven't passed"
    echo "   - You don't have merge permissions"
    echo ""
    echo "   Check PR status manually: gh pr view $pr_num"
  else
    echo "✅ Auto-merge enabled for PR #$pr_num"
    echo "   It will merge once all required checks pass."
  fi
  
  echo ""
  echo "📊 Quick status: gh pr-status $pr_num"
}

# Helper to check PR status with checks
git-pr-status() {
  local pr_num=$1
  if [ -z "$pr_num" ]; then
    # Try to get current PR
    pr_num=$(gh pr view --json number -q '.number' 2>/dev/null)
    if [ -z "$pr_num" ]; then
      echo "Usage: git-pr-status <PR-number>"
      return 1
    fi
  fi
  
  echo "🔍 PR #$pr_num Status:"
  gh pr view $pr_num --json state,merged,mergeStateStatus,statusCheckRollup \
    -q '"State: " + .state + " | Merged: " + (.merged|tostring) + " | Merge Status: " + .mergeStateStatus'
  
  echo ""
  echo "🔧 Required Checks:"
  gh pr checks $pr_num 2>&1 || echo "   No checks found or still pending"
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
