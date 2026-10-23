# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through GitHub:
**[Security → Report a vulnerability](https://github.com/Kombuchelada/lights/security/advisories/new)**.

Include what you found, how to reproduce it, and the impact you expect. You'll
get an acknowledgement within a few days. Only the live deployment and the
current `main` branch are supported.

## Scope

In scope:

- The API and SignalR hub: session creation, joining, state relay, and
  authorization of the controller role.
- The controller (`app.lumessa.xyz`) and the client (`join.lumessa.xyz`).
- Safety-relevant bypasses, such as rendering flicker or A/B alternation without
  the client's consent, or getting past the server-side limits in
  `ProtocolLimits`.

Out of scope: Auth0, Railway, and other third-party infrastructure (report those
to the vendor); denial-of-service by volume; and findings that need a
compromised device.
