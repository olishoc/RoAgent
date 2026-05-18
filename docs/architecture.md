# RoAgent v3 — Architecture

## Module Overview

The plugin is organized into 10 modules plus 1 entry file. Each module is a
self-contained Lua table with a clean public API. Modules communicate through
direct function calls — no global state except the theme color table.

```
plugin/
  RoAgent.lua              -- Entry point, toolbar, lifecycle
  Services/
    ConfigService.lua      -- Settings persistence
    ThemeService.lua       -- Theme registry and switching
    EventBus.lua           -- Pub/sub event system
    StateStore.lua         -- Centralized reactive state
    SyntaxService.lua      -- Lua tokenizer
    EditorService.lua      -- DockWidget lifecycle, tab management
    AgentService.lua       -- HTTP bridge to agent server
    DiffService.lua        -- Diff computation and formatting
    HistoryService.lua     -- Per-script undo history (20 versions)
    ScriptWriter.lua       -- Write changes to Studio scripts
  UI/
    Components.lua         -- Reusable UI primitives
    EditorWidget.lua       -- Main editor panel UI
    SuggestionPopup.lua    -- Inline suggestion popup
    CommitLogPanel.lua     -- Collapsible commit log
    SettingsPanel.lua      -- Settings modal
    ToolbarDropdown.lua    -- Toolbar button dropdown menu
  tests/
    run.lua                -- Test runner
    test_EventBus.lua
    test_StateStore.lua
    test_ThemeService.lua
    test_ScriptWriter.lua
    test_DiffService.lua
    test_SyntaxService.lua
    test_HistoryService.lua
```

---

## Module Details

### RoAgent.lua (Entry Point)

Owns: Plugin lifecycle, toolbar creation, service initialization order,
unloading cleanup.

Exports: None (top-level script).

Dependencies: All services, all UI modules.

Public API:
- None. This is the script that Roblox Studio loads. It calls
  Services.init(plugin) and UI.init() on load, and cleans up on unload.

---

### ConfigService

Owns: All user settings. Persistence via plugin:GetSetting / plugin:SetSetting.
Defaults for every key. Validation of known keys.

Exports:
- init(plugin) — Initialize with plugin reference
- destroy() — Release plugin reference
- get(key) — Get a setting value (returns default if unset)
- set(key, value) — Persist a setting value
- getAll() — Return all settings as a table
- reset(key?) — Reset one or all settings to defaults
- getDefaults() — Return the defaults table

Dependencies: None.

---

### ThemeService

Owns: Built-in theme definitions (High Contrast, One Dark, Dracula, Gruvbox),
active theme reference, custom theme registry, theme change callback.

Exports:
- init(configService) — Load saved theme from config
- destroy() — Clear state
- getActive() — Return the active theme table
- getTheme(name) — Return a specific theme by name
- setTheme(name) — Switch active theme, persist to config, fire callback
- getThemeNames() — Return sorted list of all theme names
- addCustomTheme(name, themeData) — Register a custom theme
- removeCustomTheme(name) — Remove a custom theme
- onThemeChange(callback) — Register change listener
- validateTheme(themeData) — Check that a theme has all required keys

Dependencies: ConfigService.

Required theme keys: BG, PANEL, SIDEBAR, BORDER, TEXT, SUBTEXT, ACCENT, GREEN,
RED, YELLOW, KEYWORD, STRING, COMMENT, NUMBER, FUNCTION, OPERATOR, LINE_NUMBER,
CURSOR_LINE, SELECTION, DIFF_ADD, DIFF_DEL, DIFF_ADD_LINE, DIFF_DEL_LINE,
SCROLL_BAR.

---

### EventBus

Owns: Event listener registry. Maps event names to arrays of callbacks.

Exports:
- on(event, callback) — Subscribe to an event, returns unsubscribe function
- off(event, callback) — Unsubscribe a specific callback
- emit(event, ...) — Fire an event with arguments
- clear() — Remove all listeners

Dependencies: None.

Events used in the system:
- "themeChanged" — Fired when theme switches. Arg: theme table.
- "connectionStateChanged" — Fired on connect/disconnect. Arg: "connected" | "disconnected" | "error"
- "suggestionReceived" — Fired when agent returns a suggestion. Arg: suggestion table.
- "suggestionApplied" — Fired when user applies a suggestion. Arg: applied change table.
- "suggestionDismissed" — Fired when user dismisses a suggestion.
- "scriptChanged" — Fired when script source changes (user edit or apply). Arg: instance, newSource.
- "cursorMoved" — Fired when cursor position changes. Arg: line, column.
- "historyReverted" — Fired when a history entry is reverted. Arg: entry table.

---

### StateStore

Owns: Centralized reactive state for the UI. Holds current values for all
tracked state. Notifies listeners on change.

Exports:
- init() — Initialize with default state
- destroy() — Clear all state
- get(key) — Get a state value
- set(key, value) — Set a state value, fire "stateChanged" event if value differs
- subscribe(key, callback) — Subscribe to changes for a specific key
- getAll() — Return entire state table

Dependencies: EventBus.

Default state:
- connected: false
- connecting: false
- activeScript: nil (Instance or nil)
- activeSource: ""
- cursorLine: 1
- cursorColumn: 1
- suggestionQueue: {} (array)
- activeSuggestion: nil (suggestion table or nil)
- theme: "HighContrast"
- commitLog: {} (array of commit entries)
- panelVisible: true

---

### SyntaxService

Owns: Lua tokenizer. Converts source code into an array of typed tokens.

Exports:
- tokenize(source) — Return array of {type, text} tokens
- getTokenType(token) — Return the theme color key for a token type

Dependencies: None.

Token types: KEYWORD, STRING, COMMENT, NUMBER, FUNCTION, OPERATOR, IDENTIFIER,
WHITESPACE.

---

### EditorService

Owns: DockWidgetPluginGui lifecycle, tab management, script event bindings
(SelectionService, ScriptEditorService), coordination between agent and UI.

Exports:
- init(plugin) — Create dock widget, initialize UI
- destroy() — Destroy widget, unbind events
- toggle() — Show/hide the editor panel
- isOpen() — Return boolean
- getWidget() — Return the DockWidgetPluginGui
- bindEvents() — Connect to SelectionService and ScriptEditorService
- openScript(instance) — Open a script in a new tab
- closeTab(instance) — Close a tab
- switchTab(index) — Switch to a tab by index
- getActiveTab() — Return the active tab data

Dependencies: ConfigService, ThemeService, StateStore, EventBus, EditorWidget,
AgentService.

---

### AgentService

Owns: HTTP communication with the agent server. Connection state management.
Request debouncing. Suggestion queue management. Heartbeat.

Exports:
- init(configService, stateStore, eventBus) — Initialize with dependencies
- destroy() — Cancel pending requests, clear state
- connect() — Test connection to server
- disconnect() — Mark as disconnected
- isConnected() — Return boolean
- requestSuggestion(source, cursorLine, cursorColumn, scriptPath) — Send
  suggestion request (debounced)
- getHealth() — GET /health endpoint
- setServerUrl(url) — Update server URL

Dependencies: ConfigService, StateStore, EventBus.

HTTP endpoints used:
- GET /health — Returns {ok: true} when server is reachable
- POST /suggest — Body: {source, cursorLine, cursorColumn, scriptPath}.
  Returns {suggestion: {diff: {additions: [], removals: [], context: []},
  explanation: string, targetLine: number}}

---

### DiffService

Owns: Diff computation between original and suggested source. Formats diffs
for display.

Exports:
- computeDiff(original, suggested) — Return diff table
- formatDiff(diff) — Return array of {type: "add"|"del"|"context", text: string}
- applyDiff(source, diff) — Apply a diff to source, return new source
- revertDiff(source, diff) — Revert a diff from source, return new source

Dependencies: None.

Diff table structure:
{
  targetLine: number,
  additions: {string},
  removals: {string},
  context: {string},
  explanation: string
}

---

### HistoryService

Owns: Per-script undo history. Keeps last 20 versions in memory per script.
Each version stores the full source, a timestamp, and a label.

Exports:
- init() — Initialize empty history
- destroy() — Clear all history
- push(scriptPath, source, label, diff?) — Record a new version
- getHistory(scriptPath) — Return array of version entries for a script
- getVersion(scriptPath, index) — Return a specific version
- revertTo(scriptPath, index) — Return the source at that version
- getLatest(scriptPath) — Return the most recent version entry
- clear(scriptPath) — Remove all history for a script

Dependencies: None.

Version entry structure:
{
  timestamp: number (os.clock()),
  label: string,
  source: string,
  diff: diff table or nil
}

---

### ScriptWriter

Owns: Writing changes back to Studio script instances. Uses
ScriptEditorService to apply text edits safely.

Exports:
- writeScript(instance, newSource) — Replace entire script source
- applyChange(instance, change) — Apply a diff change to a script
- revertChange(instance, change) — Revert a diff change
- isWritable(instance) — Check if instance is a valid script

Dependencies: DiffService.

---

### Components (UI)

Owns: Reusable UI primitive constructors. All primitives read colors from the
active theme at creation time.

Exports:
- frame(parent, size, pos, name) — Create a Frame
- label(parent, text, fontSize, font, size, pos) — Create a TextLabel
- button(parent, text, size, pos, name) — Create a TextButton
- textbox(parent, placeholder, size, pos) — Create a TextBox
- scroll(parent, size, pos, name) — Create a ScrollingFrame
- vlist(parent, gap, padding) — Add vertical UIListLayout
- hlist(parent, gap, padding) — Add horizontal UIListLayout
- pad(parent, px) — Add UIPadding
- corner(parent, radius) — Add UICorner
- stroke(parent, color, thickness) — Add UIStroke
- applyTheme(element, theme) — Recursively apply theme colors to an element

Dependencies: ThemeService.

---

### EditorWidget (UI)

Owns: The main editor panel layout. Tab bar, toolbar, line gutter, editor
viewport, status bar. Renders syntax-highlighted code. Manages cursor
position tracking.

Exports:
- init(dockWidget, editorService) — Build the full editor UI
- applyTheme(theme) — Reapply all colors
- newTab(scriptData) — Add and switch to a new tab
- switchTab(index) — Switch active tab
- updateLineNumbers(source) — Rebuild line number gutter
- updateEditorContent(source) — Rebuild syntax-highlighted content
- updateCursorPosition(line, column) — Update cursor line highlight
- updateStatus(text) — Update status bar text
- getEditorViewport() — Return the viewport frame (for popup anchoring)

Dependencies: Components, SyntaxService, ThemeService, StateStore.

---

### SuggestionPopup (UI)

Owns: The inline suggestion popup. Diff display, explanation text, APPLY and
DISMISS buttons. Queue management.

Exports:
- init(parent) — Create popup container (hidden)
- show(suggestion, anchorY) — Display popup at Y position with suggestion data
- hide() — Hide popup
- isVisible() — Return boolean
- setQueueDepth(max) — Set maximum queue depth

Dependencies: Components, DiffService, ThemeService, StateStore, EventBus.

---

### CommitLogPanel (UI)

Owns: The collapsible commit log at the bottom of the editor. Entry list,
expand/collapse, revert functionality.

Exports:
- init(parent) — Create commit log panel (collapsed by default)
- applyTheme(theme) — Reapply colors
- addEntry(entry) — Add a new commit entry
- clear() — Remove all entries
- expand() — Show full panel
- collapse() — Show header only
- isExpanded() — Return boolean

Dependencies: Components, ThemeService, StateStore, EventBus.

---

### SettingsPanel (UI)

Owns: The settings modal overlay. Input fields for server URL, polling interval,
queue depth, script type toggles.

Exports:
- init(parent) — Create settings modal (hidden)
- show() — Display modal
- hide() — Hide modal
- isVisible() — Return boolean
- applyTheme(theme) — Reapply colors

Dependencies: Components, ConfigService, ThemeService.

---

### ToolbarDropdown (UI)

Owns: The dropdown menu on the toolbar button. Connect/disconnect, theme picker,
settings toggle, editor toggle.

Exports:
- init(toolbarButton, plugin) — Create dropdown attached to toolbar button
- show() — Display dropdown
- hide() — Hide dropdown
- destroy() — Clean up

Dependencies: Components, ConfigService, ThemeService, StateStore.

---

## Dependency Graph

```
RoAgent.lua
  |-- ConfigService
  |-- ThemeService --> ConfigService
  |-- EventBus
  |-- StateStore --> EventBus
  |-- SyntaxService
  |-- DiffService
  |-- HistoryService
  |-- ScriptWriter --> DiffService
  |-- AgentService --> ConfigService, StateStore, EventBus
  |-- EditorService --> ConfigService, ThemeService, StateStore, EventBus,
  |                     EditorWidget, AgentService
  |-- Components --> ThemeService
  |-- EditorWidget --> Components, SyntaxService, ThemeService, StateStore
  |-- SuggestionPopup --> Components, DiffService, ThemeService, StateStore, EventBus
  |-- CommitLogPanel --> Components, ThemeService, StateStore, EventBus
  |-- SettingsPanel --> Components, ConfigService, ThemeService
  |-- ToolbarDropdown --> Components, ConfigService, ThemeService, StateStore
```

---

## Data Flow

1. User selects a script in Explorer
2. SelectionService fires selection changed event
3. EditorService detects script instance, calls openScript
4. EditorService reads source via ScriptEditorService
5. StateStore.set("activeScript", instance) and set("activeSource", source)
6. EditorWidget renders syntax-highlighted content
7. AgentService sends source + cursor to server (debounced)
8. Server returns suggestion
9. StateStore.set("suggestionQueue", updated)
10. SuggestionPopup shows if no popup is currently visible
11. User clicks APPLY
12. ScriptWriter applies change to script instance
13. HistoryService.push records the change
14. CommitLogPanel.addEntry shows the commit
15. StateStore.set("activeSource", newSource)
16. EditorWidget re-renders

---

## Extension Guide

To add a new feature:
1. Create a new module in plugin/Services/ or plugin/UI/
2. Define a table with init/destroy functions
3. Add it to RoAgent.lua initialization sequence
4. Subscribe to relevant events via EventBus if needed
5. Add tests in plugin/tests/test_YourModule.lua

To add a new theme:
1. Call ThemeService.addCustomTheme(name, themeData)
2. Theme data must include all required keys listed in ThemeService
3. Theme is persisted via ConfigService automatically

To add a new event:
1. Call EventBus.on("yourEvent", handler) in the consuming module
2. Call EventBus.emit("yourEvent", args) in the producing module
3. Document the event and its arguments in the EventBus section above
