# Personal Command Deck

Personal Command Deck is a local-first desktop app for people who want one calm place to start the day, choose what matters, stay focused, and close the day with a short review.

It is not a team dashboard, calendar replacement, or heavy productivity system. It is a personal execution desk: open it, see the next useful action, and get moving.

## What You See When You Open It

- Today's focus: the current target, focus timer, start button, completion rate, focus minutes, and nearby reminders.
- Top 3 tasks: the three things that matter most today.
- Normal todos: smaller tasks that should not compete with the Top 3.
- Project next actions: projects are shown as the next concrete step, not vague long-term goals.
- Quick links: your common tools, documents, email, calendar, GitHub, AI tools, and custom links.
- Inbox: a place to drop loose thoughts before organizing them.
- Reminders and countdowns: bills, deadlines, birthdays, interviews, trips, and other dates.
- End-of-day review: today's receipt, what moved, what got stuck, tomorrow's first step, next-day tasks, and recent archives.

## Main Features

- Local dashboard data, no account required.
- Focus timer with project-level time tracking when you pause, reset, finish naturally, or switch projects.
- Manual ordering for priority tasks and projects.
- Daily quote with a local quote pool.
- Weather lookup by location or city.
- Local JSON backup import and export. Exports do not include API keys.
- Optional AI-generated daily review. Without an API, the app still creates a local draft.
- Recent archives with completed items, open items, next-day tasks, focus minutes, and review summaries.
- Local retention settings for daily review archives and completed projects, plus manual deletion for individual review archives.
- Single-instance desktop behavior: opening the shortcut while the app is in the tray brings back the existing window instead of starting a second empty instance.
- Customizable global shortcut for bringing the main window back from the tray or background.
- Windows desktop installer with selectable install location.

## Install

Download the Windows installer from GitHub Releases when a release is available:

[Releases](https://github.com/just1cez/personal-command-deck/releases)

Run the installer and choose the installation folder when prompted.

If there is no release yet, this repository currently provides the source code. A developer can build the installer locally.

## Daily Use

1. Open the app.
2. Check the "Today Focus" area first.
3. Start a focus session from the main focus card or a project card.
4. Put unfinished thoughts into the inbox instead of interrupting the current task.
5. Check reminders when planning your day.
6. At the end of the day, fill in the review fields, plan tomorrow's tasks, and generate a short summary.
7. Archive the day, then revisit it from recent archives.
8. Export a backup occasionally if you care about preserving local data.

## AI Review

AI review is optional. The app works without it and can still create a local review draft.

If enabled, you can choose an OpenAI-compatible provider, API URL, API key, and model. The app automatically builds the prompt from your current tasks, projects, inbox items, reminders, focus time, and review notes.

Supported presets include:

- OpenAI
- DeepSeek
- Moonshot
- Custom OpenAI-compatible endpoint

API keys are stored locally in the app runtime. This is convenient for personal use, but it is not an encrypted password manager.

## Data and Privacy

- Your dashboard data is stored locally in localStorage.
- The app does not require login.
- The app does not use a hosted backend.
- Weather lookup calls public weather/location APIs when you use weather features.
- AI review sends the generated review prompt to your configured AI provider only when AI is enabled and you generate a summary.
- You can export and import local JSON backups from inside the app.
- Importing a backup overwrites current local dashboard data, while keeping the API key already stored on this machine.
- Exported backups do not include API keys.
- Retention settings for daily review archives and completed projects affect only local app data. They do not delete JSON files you already exported.
- Global shortcut settings are stored in the local desktop configuration and are not written to backup files.

## For Developers

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Run the desktop app in development:

```bash
npm run dev:desktop
```

Build the Windows installer:

```bash
npm run dist:desktop
```

Generated build output goes to `dist/` and `release/`. These folders are intentionally ignored by Git.

## License

Personal Command Deck is released under the [MIT License](LICENSE).
