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
Under **Preferences**, enable **Start with Windows, hidden in
the tray** in the standalone app. This registers only the current Windows user
and starts the saved executable directly at sign-in with `--background`; it does
not launch npm, Cargo, Vite, or a terminal. Disable the checkbox to remove the
startup entry. The app preserves your last tracking state when it starts.
Normal manual launches open the HUD; background launches keep it hidden from
window creation, including when another instance is already running.

Startup registration uses the current executable path, so re-enable the setting
if you move the app. This option is disabled in hot-reload development mode.
There is no automatic timesheet submission in this version.

## Local Git integration

The HUD has five tabs: **Manual entries**, **Timeline**, **Git**, **Activity**,
and **Preferences**. Manual entries contains the entry defaults, Quick note,
Manual entry dialog and recent manual entries. Git contains repository management
and recent commits. Activity contains today’s recent application groups and the
Start/Pause recording control.
Git commits do not create time entries or link to manual entries.

In Manual entries, type a Quick note and press Enter to save a manual time entry using
the selected project/task and time slot, ending now. Enter waits for an in-progress save instead of discarding the action.
A successful save clears
the note and updates the manual preview and Timeline. Failed saves keep the draft. The Manual entry
button remains available for choosing exact start and end times.

Activity is grouped into expandable app sections with total recorded time.
Each section shows separate time blocks for returning to the app, idle breaks,
or capture gaps. Consecutive repeated titles within a block are combined. Slack
notification counters are ignored for display; the original titles remain in
the database. Expanded sections stay expanded across dashboard refreshes.

In **Git**, choose **Add repository** to open the repository dialog, then type a
path or choose **Browse folder**. **Edit** opens the same dialog with saved
settings. Cancel or Escape discards changes; saving closes it and starts import.
**Read Git settings** validates the path, resolves its repository root,
and reads configured `user.email` values. Previously added folders appear in the
path suggestions and repository selector; external editor/client history is not
scanned. Choose an existing project/task from the suggestions or type a new name.
Manual entries, Manual entry, and the repository dialog use one shared project selector:
open the dropdown for saved projects, type to filter, or choose **Add new
project/task…**. A typed new name offers **Add “name”**. Arrow keys select an
option, Enter chooses/adds it, and Escape closes the dropdown before the dialog.
Adding through the selector saves only the project/task and refreshes all three
pickers. New names can also be saved atomically with the repository; Cancel
discards names that have not been saved.

**Import commits from** initially uses Monday of the current local week at
midnight. The selected calendar date and cutoff are saved per repository and do
not roll forward automatically. Author emails default to the repository's Git
configuration and can be edited; **All authors** disables author filtering.

Saving a repository starts a local import. A separate worker refreshes local
history every minute by default while tracking is active. Change the interval
under **Preferences → Timing**. **Refresh now** also works while
tracking is paused. Only locally available refs are read, including local
branches and already-present remote-tracking refs. The app never fetches, pulls,
contacts origin, or changes repository files. Empty repositories are supported.
Git for Windows must be installed and available on PATH.

The Git preview can be filtered by repository and local calendar date. Import
cutoffs and displayed commit times use Git's committer timestamp; author filtering
uses the author's email. Both author and committer timestamps are stored. The
Git preview defaults to the latest 10 commits. **Preferences → Recent items**
configures manual entries (3), Git commits (10), and today’s activity groups (10),
each from 1 to 100. Preview counts are stored locally alongside appearance
preferences. **View all in Timeline** enables the source alongside existing filters and opens the week
containing its latest displayed record. It never assigns commits a work duration.

Repeated imports atomically replace the repository's cached snapshot, preventing
duplicates across branches. Changed settings clear the old cache; an in-flight
import cannot overwrite newer settings. A failed import retains the last
successful snapshot and shows a repository error. Git subprocesses have runtime
and output limits and do not hold the activity database lock. Removing a
repository removes its Quiet Time configuration and cached commits, leaving the
Git folder untouched.

Git code is split across `src-tauri/src/git/` (commands, reader, process runner,
storage, worker, types, native Windows folder picker), `src-tauri/sql/git_*.sql`,
`src/git/` (frontend types, API, dates), and `src/ui/git/` (form, timeline, controller).

Tracking starts paused on first launch. Open **Activity** and click
**Start tracking** to enable it.
The app remembers the tracking preference across launches.

## Unified Timeline

Timeline combines manual entries, imported local Git commits and application
activity sessions, ordered by time within Monday–Sunday groups. It starts on the
current week with today expanded. Previous/next week, Today and a date picker
navigate history without changing source-tab filters or repository import dates.
The weekly query includes all matching records, independent of preview limits.

The filter icon opens source checkboxes; deselecting everything intentionally
shows no items. Its badge indicates how many sources remain selected. The other
icons expand/collapse all days and toggle notes, window titles, authors and hashes.
Individual days expand separately. Filters, detail visibility and the most recent
70 day-expansion choices persist locally; changing tabs and background refreshes
preserve them. Escape closes the filter panel before hiding the HUD.

Only manual entries contribute to logged-time totals. Entries crossing midnight
are allocated to each local day; activity, commits and manual time can overlap.
Activity is shown as recorded app sessions, with successive titles deduplicated.
Manual entries can be deleted from either their preview or the Timeline.
Calendar and Azure DevOps integrations are planned and are not included yet.

Timeline data shaping and local dates live in `src/timeline/`; controls, rendering
and loading are in `src/ui/timeline/`, with styling in `src/timeline.css`.
`src-tauri/src/history.rs` reads a bounded week of SQLite history in a background
task. SQL remains in `src-tauri/sql/`. Run `npm test` for timeline date, grouping,
filter and preference checks, and `npm run build` for TypeScript and production
frontend validation. Source snapshots for the two implementation checkpoints are
under `output/checkpoints/`; they contain source/configuration only, no user data.

## Entries and capture

- The main HUD asks **What are you working on?**. Its visible **Default values**
  section stores project/task and time slot automatically on this
  computer and restores them between launches. **Quick note** is a separate
  section with its own saved text. Type a project/task to get
  autocomplete, or use **Browse projects** to choose from the full entry history.
- Pressing **Enter** in either Project or task field saves the name to a separate
  SQLite `projects` table without logging time. Names are trimmed and deduplicated
  without regard to letter case. Existing entry names migrate automatically;
  projects remain available even if all of their time entries are deleted.
- Changing defaults does not log time. Press Enter in Quick note to save using
  the defaults, or use **Manual entry** to choose exact start/end times.
- **Time slot** offers 15min, 30min, 1h, 2h, 4h, and 8h buttons, plus a custom
  textbox accepting any whole number of minutes from 1 to 480.
- **Manual entry** opens a modal dialog prefilled from **Default values** and
  **Quick note**, with
  project/task, **Time spent**, **Starting at**, **Ending at**, and a quick note.
  Ending at initially uses now; starting at subtracts the default time slot.
  Changing the duration uses the last edited start/end as its anchor. Changing
  the end recalculates duration. Manual entries must end in the past.
- Edits inside the dialog never change defaults. Cancel or Escape closes the
  dialog without saving; Escape closes an open project picker first. Focus
  returns to the Manual entry button. Tab stays within the open modal.
- Overlapping entries are supported for parallel tasks. Saving succeeds and shows
  a warning in the footer. Logged totals add task durations, including parallel
  work; the Timeline also shows elapsed coverage when these differ.
- By default, Windows capture samples foreground process name and optional window
  title every five seconds. After 60 seconds without input, samples are labelled idle.
- Sampling is approximate: transitions may differ by up to one sampling interval.
  Gaps longer than twice the configured sampling interval, inaccessible windows,
  and the HUD itself are skipped.
- Raw activity and manual entries are separate tables; capture does not yet infer
  projects or generate timesheets.
- Data stays in the local application data directory, in `quiet-time.sqlite3`.
  The exact path is shown under Preferences. This is a normal unencrypted SQLite
  file; treat it as private because titles can contain document or website names.
- Disabling title capture affects future records. No screenshots, keystrokes,
  network upload, or Calendar integration are implemented.

## Development

**Preferences → Timing** saves Git import, activity sampling, idle threshold,
and HUD refresh intervals in SQLite. Defaults are 60, 5, 60, and 5 seconds,
respectively. Changes apply without restart; the workers use condition-variable
notifications to recalculate their deadlines. Pausing/resuming tracking wakes
the workers, and HUD refreshes are suspended while the window is hidden.
Unsaved timing edits survive dashboard refreshes; invalid values are rejected.
Capture/shortcut health warnings are separate from action errors and clear when
the corresponding condition recovers.

Frontend markup lives in `index.html`, behavior in `src/main.ts`, and styles in
the formatted `src/style.css`. Rust database operations use named queries from
`src-tauri/sql/`, with constants in `src-tauri/src/sql.rs`. SQL files are embedded
at compile time; changes to them trigger a rebuild of the standalone app.
Shared TypeScript DOM and time helpers live in `src/utils/`; saved-default
serialization lives in `src/storage/defaults.ts`, and data types in `src/types.ts`.
Rust timestamp and positioning helpers live in `src-tauri/src/utils.rs`.
UI controllers live in `src/ui/`: `default-values.ts`, `manual-entry.ts`,
`project-selection.ts`, `quick-note.ts`, and `settings.ts` own their controls and event handlers;
`records.ts` renders recent manual entries and activity previews. `tabs.ts` owns the
top-level Manual entries, Timeline, Git, Activity, and Preferences navigation,
keyboard navigation, and per-panel scroll positions. Manual entries opens first; switching tabs
keeps unsaved form values. `tooltips.ts` handles the information icons next to
labels (hover, focus, or click; Escape dismisses). `project-selector.ts` mounts
the shared HTML template and owns filtering, selection, adding, and keyboard
interaction; `project-selection.ts` shares project data and save callbacks
between the three instances. `status.ts` sends action
confirmations to the footer. Errors remain visible next to the relevant controls.
Controllers receive a shared `UIContext`
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
Press **F5** (or **Ctrl+F5**) and select **Quiet Time: development app** to run
the desktop app through the built-in JavaScript Debug Terminal. No additional
debugger extension is required for this launch configuration. It starts Vite
and Tauri together: frontend edits reload automatically, and Rust edits rebuild
and restart the app. Compiler output and Rust backtraces appear in the terminal.
This configuration launches development mode; it does not attach a debugger to
the Rust backend or the WebView frontend.

Quit any existing Quiet Time instance from its tray menu before starting F5;
otherwise the single-instance app will open that existing copy. Stop the dev
command with **Shift+F5** or **Ctrl+C** in its terminal when finished. Ending the
F5 session stops the workspace's development launcher. The app waits on a
Windows handle to that launcher and exits cleanly, including its tray icon,
when Windows signals that the launcher has exited. This also handles launcher
crashes without polling or session files. Process creation times guard against
PID reuse; a Windows mutex prevents duplicate launchers for one workspace.
Hiding the HUD alone does not stop the development command. This session
handling is excluded from standalone builds.

Rust analyzer uses offline dependency checks to avoid holding Cargo's package
cache while contacting the registry. After adding a new Rust dependency, fetch
it once with Cargo before the editor can analyze it.

`npm run desktop:dev` starts Vite automatically. Do not also run `npm run dev` in
another terminal: both use port **1420**. If the port is occupied, stop the
existing preview with Ctrl+C in the terminal that launched it, then retry.

Vite's watcher excludes `src-tauri`, `.tools`, and `output`; Rust watches its own
sources. This avoids scanning build outputs and the project-local Rust toolchain
during frontend startup. The main frontend modules and styles are warmed up.
The HUD is revealed only once its frontend is initialized. Development terminal
lines prefixed `[startup +… ms]` show native setup, navigation, and frontend-ready
timings measured from the executable's startup (excluding Cargo compilation).

`npm run dev` alone is a browser UI preview; it cannot capture Windows activity
or save entries. Closing the desktop panel leaves the tray app running; use the
tray **Quit** action to end it.

Choose Green, Light, Dark, or Dreamy under **Preferences → Colour
scheme**. The choice is saved on this computer; Green is the initial default.
Theme palettes live in `src/themes.css`, separate from layout styles.

The supplied artwork is stored in `src/assets/quiet-time.png` and used in the
HUD, favicon, Windows executable, and tray. Regenerate the packaged icons in
`src-tauri/icons` with `node scripts/generate-icon.mjs` after replacing the artwork.
