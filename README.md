# Quiet Time

A Windows tray app built with Rust, Tauri, TypeScript, and SQLite.

## Run

Install Node.js and the Visual Studio **Desktop development with C++** workload
(MSVC x64/x86 tools plus a Windows SDK). Tauri also needs the WebView2 runtime,
normally already present on Windows 10/11.

```powershell
npm install
npm run desktop
```

The normal launcher builds a standalone executable on first launch or when source
files change, then opens the saved executable directly on subsequent launches.
It does not start Vite or invoke Cargo on an unchanged launch. The one-time build
uses a separate target directory so it does not conflict with development builds.
Quit the app from its tray menu before rebuilding a running standalone copy.

Use `npm run desktop:dev` for development with hot reload, or
`npm run desktop:build` to rebuild the standalone app without launching it.

The launcher uses `.tools/cargo` and `.tools/rustup` when the project-local Rust
installation exists; otherwise it uses Rust from PATH. These tool directories
are ignored by Git. On another machine, install Rust using rustup with the
default MSVC toolchain. Remove the project-local Rust overrides in
`.vscode/settings.json` if using a global toolchain.

Use **Ctrl+Alt+T** to show/hide the HUD. Each time it opens, it centers in the
work area of the monitor containing your mouse pointer, accounting for display
scaling and taskbar space. Escape or the minus button hides it to the tray.
Left-click the clock tray icon to show/hide the HUD. Right-click it for **Open
Quiet Time**, **Start tracking**, **Stop tracking**, and **Quit**. The icon is
green while tracking and amber while stopped; its tooltip also shows the state.
Start/Stop changes activity capture without exiting the app. If Windows puts the
icon under the taskbar's **^** overflow menu, drag it into the visible tray area.
Under **Preferences & local storage**, enable **Start with Windows, hidden in
the tray** in the standalone app. This registers only the current Windows user
and starts the saved executable directly at sign-in with `--background`; it does
not launch npm, Cargo, Vite, or a terminal. Disable the checkbox to remove the
startup entry. The app preserves your last tracking state when it starts.
Normal manual launches open the HUD; background launches keep it hidden from
window creation, including when another instance is already running.

Startup registration uses the current executable path, so re-enable the setting
if you move the app. This option is disabled in hot-reload development mode.
There is no automatic timesheet submission in this version.

Tracking starts paused on first launch. Click **Start tracking** to enable it.
The app remembers the tracking preference across launches.

## Entries and capture

- The main HUD asks **What are you working on?**. Its visible **Default values**
  section stores project/task, time slot, and quick note automatically on this
  computer and restores them between launches. Type a project/task to get
  autocomplete, or use **Browse projects** to choose from the full entry history.
- Pressing **Enter** in either Project or task field saves the name to a separate
  SQLite `projects` table without logging time. Names are trimmed and deduplicated
  without regard to letter case. Existing entry names migrate automatically;
  projects remain available even if all of their time entries are deleted.
- Click **Log** explicitly to record time from defaults. Enter in the defaults
  form does not submit a time entry. The manual dialog still has its own Save.
- **Time slot** offers 15min, 30min, 1h, 2h, 4h, and 8h buttons, plus a custom
  textbox accepting any whole number of minutes from 1 to 480.
- The main form logs the chosen duration immediately before now.
- **Manual entry** opens a modal dialog prefilled from **Default values**, with
  project/task, **Time spent**, **Starting at**, **Ending at**, and a quick note.
  Ending at initially uses now; starting at subtracts the default time slot.
  Changing the duration uses the last edited start/end as its anchor. Changing
  the end recalculates duration. Manual entries must end in the past.
- Edits inside the dialog never change defaults. Cancel or Escape closes the
  dialog without saving; Escape closes an open project picker first. Focus
  returns to the Manual entry button. Tab stays within the open modal.
- Overlapping manual entries are rejected; remove an incorrect entry and re-enter it.
- Windows capture samples foreground process name and optional window title every
  five seconds. After 60 seconds without input, samples are labelled idle.
- Sampling is approximate: transitions may differ by up to one sampling interval.
  Long gaps over ten seconds, inaccessible windows, and the HUD itself are skipped.
- Raw activity and manual entries are separate tables; capture does not yet infer
  projects or generate timesheets.
- Data stays in the local application data directory, in `quiet-time.sqlite3`.
  The exact path is shown under Preferences. This is a normal unencrypted SQLite
  file; treat it as private because titles can contain document or website names.
- Disabling title capture affects future records. No screenshots, keystrokes,
  network upload, Git integration, or Calendar integration are implemented.

## Development

Frontend markup lives in `index.html`, behavior in `src/main.ts`, and styles in
the formatted `src/style.css`. Rust database operations use named queries from
`src-tauri/sql/`, with constants in `src-tauri/src/sql.rs`. SQL files are embedded
at compile time; changes to them trigger a rebuild of the standalone app.
Shared TypeScript DOM and time helpers live in `src/utils/`; saved-default
serialization lives in `src/storage/defaults.ts`, and data types in `src/types.ts`.
Rust timestamp and positioning helpers live in `src-tauri/src/utils.rs`.
UI controllers live in `src/ui/`: `default-values.ts`, `manual-entry.ts`,
`project-selection.ts`, and `settings.ts` own their controls and event handlers;
`records.ts` renders entries and activity. They receive a shared `UIContext`
for refreshes and serialized actions. `src/main.ts` initializes the controllers,
coordinates dashboard refreshes, and handles window-level events.
The Rust entry point wires together `commands.rs` (frontend commands),
`activity.rs` (capture loop and tracking transitions), `hud.rs` (window visibility
and placement), and `tray.rs` (tray icon, menu, and clicks). `state.rs` owns shared
state and storage initialization; Windows sampling remains in `platform.rs`.

```powershell
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

VS Code includes recommended extensions and tasks. Its integrated terminal is
configured to use the project-local Rust installation.
Rust analyzer uses offline dependency checks to avoid holding Cargo's package
cache while contacting the registry. After adding a new Rust dependency, fetch
it once with Cargo before the editor can analyze it.

`npm run desktop:dev` starts Vite automatically. Do not also run `npm run dev` in
another terminal: both use port **1420**. If the port is occupied, stop the
existing preview with Ctrl+C in the terminal that launched it, then retry.

`npm run dev` alone is a browser UI preview; it cannot capture Windows activity
or save entries. Closing the desktop panel leaves the tray app running; use the
tray **Quit** action to end it.

The Windows icon is committed under `src-tauri/icons`. Regenerate it with
`node scripts/generate-icon.mjs` if changing the code-drawn glyph.
