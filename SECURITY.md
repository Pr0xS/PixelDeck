# Security Policy

## Supported Versions

PixelDeck is pre-1.0. Security fixes are supported for the current `main` branch only.

## Reporting a Vulnerability

Please report suspected security vulnerabilities through GitHub's private vulnerability reporting feature:

1. Open the repository on GitHub.
2. Click the **Security** tab (visible to all users).
3. Click **"Report a vulnerability"**.
4. Fill in the private advisory form.

> If the "Report a vulnerability" button is not visible, private reporting may not yet be enabled. In that case, contact the maintainers by opening a GitHub Discussion tagged **[security]** or via the contact listed in the repository profile — **do not** create a public issue.

Do **not** open a public issue for security bugs. Public disclosure before a fix is ready puts all users at risk.

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
