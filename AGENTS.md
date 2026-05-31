# Repository Guidelines

## Project Shape

- Personal Command Deck is a local-first personal desktop dashboard built with Vite, React, TypeScript, and Electron.
- React app code lives in `src/`.
- Electron main/preload code lives in `electron/`.
- Static browser assets live in `public/`; desktop icons live in `electron/assets/`.
- Build output is ignored and should stay out of Git: `dist/`, `release/`, and `node_modules/`.

## Common Commands

- Install dependencies: `npm install`
- Run web dev server: `npm run dev`
- Run desktop dev app: `npm run dev:desktop`
- Lint: `npm run lint`
- Build renderer: `npm run build`
- Build Windows installer: `npm run dist:desktop`

`npm run dist:desktop` runs `clean:release` first, so it removes the old `release/` directory before rebuilding. It also prunes Electron Builder helper files after packaging, leaving the current installer and `win-unpacked`.

## Build Notes

- `vite.config.ts` intentionally resolves the real project root with `realpathSync`. Keep this in place so builds work from the real folder and from the `C:\Users\syf14\Desktop\code\new` junction.
- `base: './'` is required for Electron file loading.
- If `electron-builder` fails with an access denied error under `release/win-unpacked`, close or stop the running `Personal Command Deck.exe` from that folder, then rerun the build.

## Data And Security

- App data is stored locally in `localStorage`.
- Do not commit exported user data, API keys, generated installers, or build artifacts.
- AI summary API keys are user-provided and should never be written into backups or repository files.
- External links should stay limited to `http:` and `https:` URLs.

## Coding Conventions

- Prefer the existing React component and CSS patterns in `src/App.tsx`, `src/components.tsx`, and `src/App.css`.
- Use lucide-react icons when adding UI controls.
- Keep desktop UI dense, readable, and routine-oriented. Avoid landing-page style sections.
- Preserve localStorage compatibility when changing state shape; add normalization/migration in `src/dashboardState.tsx`.
- Keep reminders sorted by date in the UI.

## Verification

Before handing off code changes, run:

```bash
npm run lint
npm run build
```

For Electron or installer changes, also run:

```bash
npm run dist:desktop
```
