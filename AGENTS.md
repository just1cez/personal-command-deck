# Repository Guidelines

## Project Shape

- Personal Command Deck is a local-first personal desktop dashboard built with Vite, React, TypeScript, and Electron.
- React app code lives in `src/`.
- Electron main/preload code lives in `electron/`.
- Static browser assets live in `public/`; desktop icons live in `electron/assets/`.
- Build output is ignored and should stay out of Git: `dist/`, `release/`, and `node_modules/`.

## Source Layout

`src/` is organised in layers. Dependencies point downward only — a lower layer must never
import from a higher one.

| Folder | Role | May import |
| --- | --- | --- |
| `config/` | Enumerable options and constants (themes, AI providers, link icons, limits, copy). | `types` |
| `types.ts` `utils.ts` | Shared types and generic helpers (dates, numbers, URL, files). | `config` |
| `domain/` | Pure business rules: focus timing, task carryover, ordering, retention, archive, stats. No React. | `config`, `utils` |
| `services/` | Outside world: weather API, AI summary, Electron bridge. | `config`, `domain`, `utils` |
| `state/` | Store, persistence, normalization/migration, React contexts. | all of the above |
| `actions/` | Hooks that wire domain rules to the store (write operations). | `state`, `domain` |
| `hooks/` | Side effects: timers, network, keyboard. | `state`, `services`, `domain` |
| `components/` | Reusable presentational components (`components/ui/` = primitives). | `config`, `domain`, `utils` |
| `layout/` `views/` `overlays/` | Screen composition. | everything |

Where to make a change:

- New selectable option (theme, AI provider, reminder type, link icon) → `src/config/options.tsx` only.
- New business rule → a pure function in `src/domain/`, then call it from an action hook.
- New state field → `src/types.ts`, `src/state/defaults.ts`, and `src/state/normalize.ts` together.
- New panel → a component under the matching `src/views/<view>/`, mounted in that view.

## Debugging

- Every state write goes through `updateDashboard(updater, actionName)`; the action name is
  printed as `[deck:store] 动作 …`. Pass a meaningful name when adding actions.
- Logging is on automatically under `npm run dev`. In a packaged build, run
  `commandDeckDebug.enable()` in the console (persists across restarts, `disable()` turns it off).
- `commandDeckDebug.state()` prints the current state with the API key redacted.
- High-frequency housekeeping (focus tick, daily quote check, retention sweep) intentionally uses
  the raw `setDashboard` so it does not flood the log.

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

- Prefer the existing component and CSS patterns in `src/components/`, `src/views/`, and `src/App.css`.
- Reuse the shared primitives in `src/components/ui/` (`PanelTitle`, `EditorField`, `ThemedSelect`,
  `ProgressSlider`, `OrderControls`) instead of re-creating the markup.
- Use lucide-react icons when adding UI controls.
- Keep desktop UI dense, readable, and routine-oriented. Avoid landing-page style sections.
- Preserve localStorage compatibility when changing state shape; add normalization/migration in
  `src/state/normalize.ts` (and a default in `src/state/defaults.ts`).
- Keep business rules out of components: put them in `src/domain/` as pure functions so they can be
  reasoned about without rendering.
- Actions that validate input return `boolean`; the caller clears its form only when it is `true`.
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
