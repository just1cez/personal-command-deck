# Personal Command Deck

A local-first personal execution desktop built with React, Vite, TypeScript, and Electron.

Personal Command Deck is designed as a small daily command center: open it, see what matters now, start focus, collect loose ideas, track upcoming dates, and close the day with a lightweight review.

## Features

- Today focus: one clear current target, focus timer, completion rate, focus minutes, and nearby reminders.
- Top 3 and todos: separate priority tasks from normal tasks, with manual ordering.
- Project progress: each project shows the next action instead of a long-term goal.
- Quick launcher: custom links for tools, documents, mail, calendar, GitHub, AI tools, and more.
- Weather: local or city-based weather lookup through public weather APIs.
- Daily quote pool: local quote management with one fixed quote per day.
- Inbox: a fast scratchpad for ideas before organizing them.
- Reminders and countdowns: bills, deadlines, birthdays, interviews, and other dates.
- Daily review: local summary by default, with optional AI API integration.
- Local backup: export and import dashboard data as JSON.

## Local First

The app stores dashboard data in browser localStorage inside the desktop/web runtime. It does not require an account or hosted backend.

API keys for optional AI summaries are also stored locally. This is convenient for a personal local app, but it is not an encrypted secret vault.

## AI Summary

The review panel can optionally call an OpenAI-compatible chat completions API.

Supported presets include:

- OpenAI
- DeepSeek
- Moonshot
- Custom OpenAI-compatible endpoint

When enabled, the app automatically builds a prompt from the current dashboard state, including tasks, projects, inbox items, reminders, focus minutes, and review inputs. When disabled, it falls back to a local summary.

## Development

Install dependencies:

```bash
npm install
```

Run the web app:

```bash
npm run dev
```

Run the Electron desktop app in development:

```bash
npm run dev:desktop
```

Lint:

```bash
npm run lint
```

Build the web assets:

```bash
npm run build
```

Build the Windows desktop installer:

```bash
npm run dist:desktop
```

The installer and unpacked desktop app are generated under `release/`. That folder is intentionally ignored by Git.

## Repository Hygiene

The repository tracks source code and project configuration only. It does not commit:

- `node_modules/`
- `dist/`
- `release/`
- local API keys
- local dashboard data

If you want to distribute an installer, upload the generated `.exe` through GitHub Releases instead of committing it to the repository.

## Tech Stack

- React
- TypeScript
- Vite
- Electron
- electron-builder
- lucide-react
