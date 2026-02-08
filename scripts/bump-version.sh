#!/bin/bash
# Bump version script for semantic versioning
# Usage: ./scripts/bump-version.sh [major|minor|patch]

set -e

VERSION_FILE="VERSION"
CHANGELOG_FILE="CHANGELOG.md"

if [ ! -f "$VERSION_FILE" ]; then
    echo "Error: VERSION file not found"
    exit 1
fi

CURRENT_VERSION=$(cat "$VERSION_FILE")
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

BUMP_TYPE=${1:-patch}

case $BUMP_TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    *)
        echo "Error: Invalid bump type. Use: major, minor, or patch"
        exit 1
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
DATE=$(date +%Y-%m-%d)

echo "Bumping version from $CURRENT_VERSION to $NEW_VERSION"

# Update VERSION file
echo "$NEW_VERSION" > "$VERSION_FILE"

# Update backend pyproject.toml
if [ -f "backend/pyproject.toml" ]; then
    sed -i.bak "s/version = \".*\"/version = \"$NEW_VERSION\"/" backend/pyproject.toml
    rm backend/pyproject.toml.bak 2>/dev/null || true
fi

# Update frontend package.json
if [ -f "frontend/package.json" ]; then
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" frontend/package.json
    rm frontend/package.json.bak 2>/dev/null || true
fi

# Update CHANGELOG.md
if [ -f "$CHANGELOG_FILE" ]; then
    # Replace [Unreleased] with new version section
    sed -i.bak "s/## \[Unreleased\]/## \[Unreleased\]\n\n## \[$NEW_VERSION\] - $DATE/" "$CHANGELOG_FILE"
    rm "$CHANGELOG_FILE.bak" 2>/dev/null || true
fi

echo "Version bumped to $NEW_VERSION"
echo "Don't forget to:"
echo "  1. Review and update CHANGELOG.md with release notes"
echo "  2. Commit changes: git add VERSION backend/pyproject.toml frontend/package.json CHANGELOG.md"
echo "  3. Tag release: git tag -a v$NEW_VERSION -m \"Release v$NEW_VERSION\""
