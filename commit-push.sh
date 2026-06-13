#!/bin/bash
# Commit and push all changes in the Folio-Library-Server repo
#
# Usage:
#   ./commit-push.sh "commit message"

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Verify we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "ERROR: Not a git repository"
    exit 1
fi

MESSAGE="${1:-"Update from $(date +%Y-%m-%d)"}"

echo "Adding all changes..."
git add -A

echo "Committing with message: $MESSAGE"
git commit -m "$MESSAGE"

# Check if there's a remote
if git remote -v > /dev/null 2>&1 && [[ -n "$(git remote)" ]]; then
    echo "Pushing to remote..."
    git push
else
    echo "No remote configured. Commit saved locally."
fi

echo "Done!"
