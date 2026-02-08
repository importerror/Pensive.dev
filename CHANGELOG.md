# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed infinite loop in Google Docs add-on when API calls hang - added 5-minute timeout to API requests
- Added client-side timeout handling (6 minutes) to show error messages instead of hanging indefinitely
- Improved error messages to show detailed API error responses
- Fixed dnspython version constraint for Python 3.9 compatibility

### Changed
- Improved OpenAI error messages to detect blocked requests (proxy/firewall issues)

## [1.0.0] - 2026-02-08

### Added
- Initial release of RCA Reviewer Google Docs Add-on
- Backend API with OpenAI integration for RCA analysis
- Frontend preview application
- Google Docs add-on with inline comment creation
- Chat functionality for RCA discussions
