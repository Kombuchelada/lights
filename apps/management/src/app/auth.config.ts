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
  domain: 'login.lumessa.xyz',
  clientId: 'yTdTbnDzjOOjtDht55Q4pXOAVKXaQe5c',
  audience: 'https://api.lumessa.xyz',
} as const;

/** True once real Auth0 tenant values have been filled in (vs. the placeholders). */
const usingRealTenant =
  !authConfig.domain.startsWith('YOUR_') && !authConfig.clientId.startsWith('YOUR_');

/**
 * Local dev (localhost/loopback) runs **without** Auth0 so the controller is
 * reachable without a tenant login — the server is the authority and there's no
 * real protection to bypass locally. Deployed origins (app.lumessa.xyz, Railway)
 * are unaffected and remain fully authenticated.
 */
const isLocalDev =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);

/**
 * ⚠️ DEMO SWITCH — leave `false` for normal operation.
 *
 * Flip to `true` to disable Auth0 login for a demo: the login UI is suppressed
 * and "Start session" works without signing in. Redeploy the controller after
 * changing this. Re-enable auth by setting it back to `false` and redeploying.
 *
 * MUST be kept in sync with the server flag `DemoDisableAuth` in
 * server/Lumessa.Api/Program.cs — flip both together, or the SPA and server
 * will disagree about whether auth is required.
 */
const DEMO_DISABLE_AUTH = true;

/** True when the SPA should enforce Auth0 (real tenant values AND not local dev). */
export const isAuthConfigured = !DEMO_DISABLE_AUTH && usingRealTenant && !isLocalDev;
