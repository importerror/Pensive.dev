# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed Railway 502 error by using PORT environment variable in Dockerfile instead of hardcoded port
- Added validation for missing OPENAI_API_KEY to prevent startup failures
- Fixed IndentationError in server.py chat exception block (line 284) that caused container crash
- Added run.sh entrypoint to read PORT at runtime (fixes Railway 502 when using Docker)
- Dockerfile CMD switched to exec form with sh -c so PORT is expanded at runtime (fixes connection refused)
- Safer OpenAI client init so startup does not crash on missing key
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
