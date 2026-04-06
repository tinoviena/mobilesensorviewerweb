#!/bin/bash

# Merge current branch to gh-pages branch
set -e

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"

# Stash any uncommitted changes
git stash

# Checkout gh-pages branch
git checkout gh-pages
echo "Switched to gh-pages branch"

# Merge from current branch
git merge $CURRENT_BRANCH
echo "Merged $CURRENT_BRANCH into gh-pages"

# Push merged branch to origin
git push origin gh-pages
echo "Pushed gh-pages to origin"

# Go back to original branch
git checkout $CURRENT_BRANCH
echo "Switched back to $CURRENT_BRANCH"

# Restore stashed changes
git stash pop

echo "Merge to gh-pages branch complete!"
