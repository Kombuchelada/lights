# Lumessa Controller

The clinician-facing Angular app (zoneless, signals, standalone components) that
drives the light on the client in realtime. Live at <https://app.lumessa.xyz>.

```bash
npm install
npm start               # http://localhost:4200, proxies /api + /hubs → :5000
npm test -- --watch=false
npm run lint:css        # design-token enforcement (stylelint)
npm run build
```

- Styles consume the design tokens in `src/styles.scss`; see
  [`docs/design-system.md`](../../docs/design-system.md).
- Icons are inline SVG via `<app-icon name="…">` (`src/app/icon.ts`); add a path
  there rather than using emoji or an icon font.
- Shared wire types come from `@lumessa/protocol` via a tsconfig path alias.

See the [root README](../../README.md) for the full picture.
