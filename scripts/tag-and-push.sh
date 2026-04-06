#!/bin/bash

# Read build number from buildnr.txt
BUILD_NR=$(cat buildnr.txt)

# Create git tag with the build number
git tag "snapshot-v$BUILD_NR"

# Push the tag to remote
git push origin "v$BUILD_NR"
