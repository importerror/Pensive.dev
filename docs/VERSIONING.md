# Versioning Guide

This project uses [Semantic Versioning](https://semver.org/) (SemVer) for all releases.

## Version Format

Versions follow the format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes that are incompatible with previous versions
- **MINOR**: New features that are backward compatible
- **PATCH**: Bug fixes and small improvements that are backward compatible

## Version Files

The project version is tracked in:
- `VERSION` - Root version file (source of truth)
- `backend/pyproject.toml` - Backend Python package version
- `frontend/package.json` - Frontend npm package version

## Release Process

### 1. Update CHANGELOG.md

Before releasing, move items from `[Unreleased]` to a new version section:

```markdown
## [Unreleased]

## [1.0.1] - 2026-02-08

### Fixed
- Description of fixes

### Changed
- Description of changes
```

### 2. Bump Version

Use the version bump script:

```bash
# For patch releases (bug fixes)
./scripts/bump-version.sh patch

# For minor releases (new features)
./scripts/bump-version.sh minor

# For major releases (breaking changes)
./scripts/bump-version.sh major
```

The script will:
- Update `VERSION` file
- Update `backend/pyproject.toml`
- Update `frontend/package.json`
- Add new version section to `CHANGELOG.md`

### 3. Commit and Tag

```bash
git add VERSION backend/pyproject.toml frontend/package.json CHANGELOG.md
git commit -m "Release v1.0.1"
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin main --tags
```

### 4. Deploy

- Backend: Railway will auto-deploy on push
- Frontend: Build and deploy as needed

## Examples

- `1.0.0` → `1.0.1`: Bug fix (patch)
- `1.0.1` → `1.1.0`: New feature (minor)
- `1.1.0` → `2.0.0`: Breaking change (major)
