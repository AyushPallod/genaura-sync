# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-01-26

### Added
- **Auto-Pruning:** `gsync sync` now automatically removes stale or unqualified symlinks from target directories.
- **Smart Target Filtering:** Skills can now specify a `targets` list in `skill.yaml` to limit which tools they sync to.
- **Referential Integrity Check:** The scorer now verifies that delegation targets actually exist in the local library.
- **Executable Permissions:** Added `postbuild` script to ensure `dist/cli.js` has correct permissions after building.

### Changed
- **Stricter Scoring:**
    - Placeholder content (like "TODO") now results in a score penalty.
    - Markdown files must have meaningful content (> 50 bytes) to count toward the score.
    - Validation patterns are now checked for valid Regex syntax.
- **Internal:** Using `lstatSync` for more reliable symlink handling during pruning.

## [1.0.0] - 2025
- Initial release.
