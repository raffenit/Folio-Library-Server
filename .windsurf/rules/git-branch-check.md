# Git Branch Safety Check

## Description

Verify the current git branch before making code changes to prevent accidental commits to feature branches. This rule helps avoid deployment confusion when changes are committed to the wrong branch.

## When to Apply

- Before proposing ANY file edits
- Before creating new files
- Before running `git commit` commands
- When user asks to "save" or "commit" changes

## Rule

1. **Check Current Branch**
   ```bash
   git branch --show-current
   ```

2. **If NOT on `main` or `master`:**
   
   **WARN the user with:**
   ```
   ⚠️  You are currently on branch: `feature-branch-name`
   
   Changes will be committed to this branch, NOT main.
   
   Options:
   1. Switch to main: `git checkout main && git pull`
   2. Stay on this branch and merge later
   3. Create a PR from this branch
   
   How would you like to proceed?
   ```

3. **Only proceed after user confirmation**

4. **Memory Creation**
   - If user chooses option 2 or 3, create a memory: "User prefers to work on feature branch X, remind about merging to main before deployment"

## Rationale

This prevents the common mistake of:
- Making changes on a feature branch
- Forgetting to merge to main
- Wondering why deployments don't include the changes
- Creating confusion about which branch has the latest code

## History

This rule was created after the user made this exact mistake multiple times, leading to the quote:
> "Ohh, I need to pull request it into main. Make a note to warn me if we are on a feature branch in the future, I keep confusing myself"
