# Security Policy

## Supported Versions

PixelDeck is pre-1.0. Security fixes are supported for the current `main` branch only.

## Reporting a Vulnerability

Please report suspected security vulnerabilities through GitHub's private vulnerability reporting flow:

1. Open the repository on GitHub.
2. Go to **Settings → Security → Advisories**.
3. Create a private vulnerability report.

Do **not** open a public issue for security bugs. Public reports can expose users before a fix is available.

## Security Scope

### In Scope

- Importing untrusted `Project` JSON, which is a browser-side parsing trust boundary.
- CLI export paths that execute Playwright against arbitrary project data.

### Out of Scope

- Vulnerabilities in Chromium itself. Please report those to Google.
- Google Fonts CDN availability, privacy, or delivery issues.
- `node_modules` vulnerabilities with no PixelDeck-specific impact or exploit path.

## Response Commitment

Maintainers aim to acknowledge reports within 72 hours and patch confirmed issues within 14 days.

## Past Vulnerabilities

There are no known past vulnerabilities.
