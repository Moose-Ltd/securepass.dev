# Security policy

SecurePass exists to be trustworthy, so security reports are welcome and taken seriously.

## Reporting a vulnerability

Please report privately through [GitHub's private vulnerability reporting](https://github.com/Moose-Ltd/securepass.dev/security/advisories/new). Do not open a public issue for a security problem.

Include what you found, how to reproduce it, and what an attacker could do with it. You will get an acknowledgement within two working days and a decision on severity within seven.

## In scope

- Anything that could make the site send, store or log a generated or typed password, or more than the five-character hash prefix used by the breach check.
- Weaknesses in how randomness is drawn or turned into characters, words or digits, including bias.
- Ways around the Content Security Policy, Trusted Types policy or other response headers.
- Script injection, clickjacking, or loading of third-party resources.
- Inaccurate security claims on the site itself.

## Out of scope

- Attacks that need a compromised device, a malicious browser extension or physical access. The site's FAQ says plainly that it can't protect against these.
- Missing headers on the `www` redirect.
- Denial of service, rate limiting and volumetric attacks against Cloudflare.
- Findings from automated scanners without a demonstrated impact.

## Design

The site is a set of static files served by an assets-only Cloudflare Worker: no server code runs for a page request. The full security model is described on [securepass.dev](https://securepass.dev/#how), and the headers are defined in [`src/security/headers.ts`](src/security/headers.ts).
