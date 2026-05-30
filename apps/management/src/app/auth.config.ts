/**
 * Auth0 SPA configuration. All three values are **public** (safe to commit) —
 * the SPA is a public client, so there's no secret here.
 *
 * Fill `domain` and `clientId` from your Auth0 tenant once the SPA Application is
 * created (Dashboard → Applications → your SPA → Settings). `audience` is the
 * API Identifier you set on the Auth0 API (resource server); it must match the
 * server's `Auth0__Audience`.
 *
 * `redirectUri` is resolved at runtime from the page origin, so the same build
 * works on http://localhost:4200 (dev) and https://app.lumessa.xyz (prod) — both
 * must be registered as Allowed Callback / Logout / Web Origin URLs in Auth0.
 */
export const authConfig = {
  domain: 'dev-en23jhoni7eu3ibw.us.auth0.com',
  clientId: 'yTdTbnDzjOOjtDht55Q4pXOAVKXaQe5c',
  audience: 'https://api.lumessa.xyz',
} as const;

/** True once real tenant values have been filled in (guards login UI in dev). */
export const isAuthConfigured =
  !authConfig.domain.startsWith('YOUR_') && !authConfig.clientId.startsWith('YOUR_');
