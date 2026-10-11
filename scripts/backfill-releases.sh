#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== Backfilling GitHub Releases with CHANGELOG notes ==="
echo ""

# Function to generate release notes for a version
generate_notes() {
  local TAG_VERSION="$1"
  local PREV_TAG="$2"
  local VERSION_NUMBER="${TAG_VERSION#v}"
  
  echo "Generating notes for $TAG_VERSION (prev: $PREV_TAG)"
  
  # Extract CHANGELOG section (from this version's header to the next ## header)
  CHANGELOG_SECTION=$(awk "/^## \[${VERSION_NUMBER}\]/,/^## \[/" CHANGELOG.md | sed '1d;$d')
  
  if [ -z "$CHANGELOG_SECTION" ]; then
    echo "ERROR: No CHANGELOG section found for $VERSION_NUMBER"
    echo "Trying alternate extraction..."
    CHANGELOG_SECTION=$(awk "/^## \[${VERSION_NUMBER}\]/,/^---/" CHANGELOG.md | sed '1d;$d')
  fi
  
  if [ -z "$CHANGELOG_SECTION" ]; then
    echo "ERROR: Still no CHANGELOG section found"
    return 1
  fi
  
  # Start release notes
  cat > /tmp/release-notes-$VERSION_NUMBER.md << 'NOTES_EOF'
## What's Changed

NOTES_EOF
  
  echo "$CHANGELOG_SECTION" >> /tmp/release-notes-$VERSION_NUMBER.md
  
  cat >> /tmp/release-notes-$VERSION_NUMBER.md << 'NOTES_EOF'

## Commits

NOTES_EOF
  
  # Add commits
  git log $PREV_TAG..$TAG_VERSION --pretty=format:"%h %s" --reverse 2>/dev/null | while read sha msg; do
    PR_NUM=$(gh pr list --state merged --search "$sha" --json number -q '.[0].number' 2>/dev/null || echo "")
    if [ -n "$PR_NUM" ]; then
      PR_LINK=" ([#$PR_NUM](https://github.com/luodaoyi/pi-bot/pull/$PR_NUM))"
    else
      PR_LINK=""
    fi
    echo "- [\`$sha\`](https://github.com/luodaoyi/pi-bot/commit/$sha) $msg$PR_LINK" >> /tmp/release-notes-$VERSION_NUMBER.md
  done
  
  cat >> /tmp/release-notes-$VERSION_NUMBER.md << 'NOTES_EOF'

## Installation

```bash
# Using npm
npm install -g pi-agent-bot@beta

# Using pnpm
pnpm add -g pi-agent-bot@beta

# Using Pi CLI
pi install npm:pi-agent-bot
```

NOTES_EOF

  echo "**Full Changelog**: https://github.com/luodaoyi/pi-bot/compare/$PREV_TAG...$TAG_VERSION" >> /tmp/release-notes-$VERSION_NUMBER.md
  
  echo "Generated $(wc -l < /tmp/release-notes-$VERSION_NUMBER.md) lines"
}

# Backfill beta.1
echo "=== v0.1.0-beta.1 ==="
if gh release view v0.1.0-beta.1 &>/dev/null; then
  if generate_notes "v0.1.0-beta.1" "844346b"; then
    gh release edit v0.1.0-beta.1 --notes-file /tmp/release-notes-0.1.0-beta.1.md
    echo "✓ Updated v0.1.0-beta.1"
  fi
else
  echo "Release v0.1.0-beta.1 not found, skipping"
fi
echo ""

# Backfill beta.2
echo "=== v0.1.0-beta.2 ==="
if gh release view v0.1.0-beta.2 &>/dev/null; then
  if generate_notes "v0.1.0-beta.2" "v0.1.0-beta.1"; then
    gh release edit v0.1.0-beta.2 --notes-file /tmp/release-notes-0.1.0-beta.2.md
    echo "✓ Updated v0.1.0-beta.2"
  fi
else
  echo "Release v0.1.0-beta.2 not found, skipping"
fi
echo ""

# Backfill beta.3
echo "=== v0.1.0-beta.3 ==="
if gh release view v0.1.0-beta.3 &>/dev/null; then
  if generate_notes "v0.1.0-beta.3" "v0.1.0-beta.2"; then
    gh release edit v0.1.0-beta.3 --notes-file /tmp/release-notes-0.1.0-beta.3.md
    echo "✓ Updated v0.1.0-beta.3"
  fi
else
  echo "Release v0.1.0-beta.3 not found, skipping"
fi
echo ""

# Backfill beta.4
echo "=== v0.1.0-beta.4 ==="
if gh release view v0.1.0-beta.4 &>/dev/null; then
  if generate_notes "v0.1.0-beta.4" "v0.1.0-beta.3"; then
    gh release edit v0.1.0-beta.4 --notes-file /tmp/release-notes-0.1.0-beta.4.md
    echo "✓ Updated v0.1.0-beta.4"
  fi
else
  echo "Release v0.1.0-beta.4 not found, skipping"
fi
echo ""

echo "=== Backfill complete ==="
echo ""
echo "Updated releases:"
gh release list --limit 5
