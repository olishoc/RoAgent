# RoAgent v3 — UI Plan

## Layout Overview

The plugin consists of four visual regions:
1. Toolbar button (Studio Plugins tab)
2. Editor panel (DockWidgetPluginGui, docked right)
3. Settings panel (modal overlay)
4. Suggestion popup (inline within editor panel)

The editor panel is the primary surface. Default size 800x600, minimum 400x300.
It docks to the right side of Studio by default.

---

## 1. Editor Panel

### 1.1 Root Container

- Type: Frame (DockWidgetPluginGui root)
- Size: 100% x 100% of widget
- Background: theme.BG
- Padding: 0
- Layout: Vertical stack, top to bottom: TabBar, Toolbar, MainArea, StatusBar

Justification: The root fills the entire dock widget. No padding because child
regions manage their own spacing. A single background color prevents gaps.

### 1.2 Tab Bar

- Height: 28px
- Width: 100%
- Background: theme.SIDEBAR
- Padding: 0
- Content: Horizontal list of tab buttons, left-aligned
- Overflow: Horizontal scroll if tabs exceed width, scrollbar hidden

Each tab button:
- Height: 28px
- Width: Automatic (min 80px, max 160px)
- Padding: 8px left, 8px right
- Font: GothamSemibold, 11px
- Default state: TextColor3 = theme.SUBTEXT, BackgroundColor3 = transparent
- Active state: TextColor3 = theme.TEXT, BackgroundColor3 = theme.PANEL
- Hover state: BackgroundColor3 = theme.BORDER at 50% transparency
- Close button: 12x12px "x" text, right-aligned within tab, visible on hover

Justification: 28px matches Studio's native tab height. Max width of 160px
prevents one long filename from consuming the bar. Close button only on hover
reduces visual noise.

### 1.3 Toolbar

- Height: 32px
- Width: 100%
- Background: theme.PANEL
- Padding: 4px left, 4px right
- Border: 1px bottom in theme.BORDER
- Content: Horizontal list of buttons, left-aligned, 4px gap

Toolbar buttons (each):
- Height: 24px
- Width: Automatic (min 60px)
- Padding: 8px left, 8px right
- Font: GothamSemibold, 11px
- Corner radius: 2px
- Default: BackgroundColor3 = theme.ACCENT (or theme.PANEL for secondary), TextColor3 = theme.TEXT
- Hover: BackgroundColor3 lightened 10%
- Active/pressed: BackgroundColor3 darkened 10%

Button labels: APPLY ALL, SAVE, SETTINGS, CONNECT/DISCONNECT, THEME

Justification: 32px keeps the toolbar compact. 24px buttons fit comfortably.
The toolbar groups all global actions; per-line actions live in the suggestion
popup. CONNECT button toggles label between CONNECT (disconnected state) and
DISCONNECT (connected state).

### 1.4 Main Area

- Width: 100%
- Height: 100% minus 82px (28 tab + 32 toolbar + 22 status)
- Background: theme.BG
- Layout: Horizontal split — LineGutter (left) + EditorViewport (right)

#### 1.4.1 Line Gutter

- Width: 48px
- Height: 100%
- Background: theme.PANEL
- Border: 1px right in theme.BORDER
- Padding: 0
- Content: One TextLabel per line, right-aligned

Each line number label:
- Height: 16px (matches line height in editor)
- Width: 40px
- Position: X = 0, Y = (lineIndex - 1) * 16
- Font: Code (monospace), 10px
- TextColor3: theme.LINE_NUMBER
- TextXAlignment: Right
- BackgroundTransparency: 1

Active cursor line number:
- TextColor3: theme.ACCENT
- Font: Code, 10px, Bold

Justification: 48px fits up to 6 digits (999999 lines) with 4px padding on each
side. Right-aligned numbers are standard in every code editor. 16px line height
is readable at 10px monospace.

#### 1.4.2 Editor Viewport

- Width: 100% minus 48px
- Height: 100%
- Background: theme.BG
- ClipsDescendants: true
- ScrollBarThickness: 6px
- ScrollBarImageColor3: theme.SCROLL_BAR

Content: One TextLabel per rendered token, arranged per line.
Each line is a horizontal row of token labels.

Token label:
- Height: 16px
- Width: Calculated via TextService:GetTextSize
- Font: Code (monospace), 11px
- BackgroundTransparency: 1
- TextColor3: Determined by token type and theme:
  - KEYWORD: theme.KEYWORD
  - STRING: theme.STRING
  - COMMENT: theme.COMMENT
  - NUMBER: theme.NUMBER
  - FUNCTION: theme.FUNCTION
  - OPERATOR: theme.OPERATOR
  - IDENTIFIER: theme.TEXT
  - WHITESPACE: theme.TEXT

Cursor line highlight:
- Full-width Frame behind the active line
- Height: 16px
- BackgroundColor3: theme.CURSOR_LINE
- BackgroundTransparency: 0

Selection highlight:
- Full-width Frame behind selected lines
- BackgroundColor3: theme.SELECTION

Justification: 16px line height with 11px monospace font gives comfortable
readability without wasting space. ClipsDescendants prevents tokens from
rendering outside the viewport during scroll.

### 1.5 Status Bar

- Height: 22px
- Width: 100%
- Background: theme.PANEL
- Border: 1px top in theme.BORDER
- Padding: 4px left, 4px right
- Layout: Horizontal, three zones

Left zone (connection status):
- Width: 80px
- Content: Single TextLabel
- Font: GothamSemibold, 10px
- Text: "CONNECTED" / "IDLE" / "THINKING" / "ERR"
- TextColor3: theme.GREEN when CONNECTED, theme.SUBTEXT when IDLE,
  theme.YELLOW when THINKING, theme.RED when ERR

Center zone (cursor position):
- Width: remaining space minus 160px
- Content: TextLabel "Ln X, Col Y"
- Font: Gotham, 10px
- TextColor3: theme.SUBTEXT

Right zone (agent indicator):
- Width: 80px
- Content: TextLabel
- Font: Code, 10px
- Default: empty
- When agent processing: blinking "_" character (toggles visible every 500ms)
- TextColor3: theme.ACCENT

Justification: 22px is enough for 10px text with 4px padding. Three zones give
the developer constant awareness of connection state, cursor position, and agent
activity without needing to look away from the editor. The blinking cursor is
the only animation — no spinner.

---

## 2. Suggestion Popup

### 2.1 Container

- Width: 100% of editor viewport (minus 8px margin each side)
- Height: Automatic, max 200px
- Position: Anchored below the affected line's Y position + 16px
- BackgroundColor3: theme.PANEL
- Border: 1px solid theme.BORDER
- Corner radius: 2px
- Padding: 8px
- Z-index: Above all editor content

Justification: Positioned below the affected line so it never obscures code
above. Max height of 200px prevents the popup from consuming the entire viewport.
2px corner radius is the only rounding in the entire UI. No shadow — the border
and background differentiate it from the editor surface.

### 2.2 Diff Section

- Width: 100%
- Height: Automatic, max 120px
- BackgroundColor3: theme.BG
- Padding: 4px
- Corner radius: 2px
- ClipsDescendants: true
- Scroll: Vertical if content exceeds 120px

Each diff line:
- Height: 14px
- Font: Code, 10px
- Layout: Horizontal — indicator (16px) + code text (remaining)

Removed line:
- Indicator: "-" in theme.RED
- TextColor3: theme.RED
- BackgroundColor3: theme.DIFF_DEL_LINE (full width behind line)

Added line:
- Indicator: "+" in theme.GREEN
- TextColor3: theme.GREEN
- BackgroundColor3: theme.DIFF_ADD_LINE (full width behind line)

Context line (unchanged):
- Indicator: " " (space)
- TextColor3: theme.SUBTEXT
- BackgroundTransparency: 1

Justification: Dim red/green (desaturated) keeps the diff readable without
being visually aggressive. The +/- indicators on the left match standard diff
conventions. 14px line height is compact enough to show multiple changed lines.

### 2.3 Explanation Text

- Width: 100%
- Height: Automatic, max 32px (2 lines)
- Font: Gotham, 10px
- TextColor3: theme.SUBTEXT
- TextWrapped: true
- Padding: 4px top

Justification: One-line explanation keeps the popup compact. Truncating at 2
lines prevents the explanation from dominating the diff.

### 2.4 Action Buttons

- Width: 100%
- Height: 24px
- Layout: Horizontal, right-aligned, 4px gap

APPLY button:
- Width: 60px
- Height: 20px
- Font: GothamSemibold, 10px
- Text: "APPLY"
- Default: BackgroundColor3 = theme.GREEN, TextColor3 = theme.TEXT
- Hover: BackgroundColor3 lightened 15%
- Active: BackgroundColor3 darkened 10%
- Corner radius: 2px

DISMISS button:
- Width: 60px
- Height: 20px
- Font: GothamSemibold, 10px
- Text: "DISMISS"
- Default: BackgroundColor3 = theme.PANEL, TextColor3 = theme.SUBTEXT
- Hover: BackgroundColor3 = theme.BORDER, TextColor3 = theme.TEXT
- Active: BackgroundColor3 darkened 10%
- Corner radius: 2px

Justification: APPLY uses the accent green to signal the primary action.
DISMISS is visually secondary. Both are small enough to not distract from the
diff content. Right-aligned follows the pattern of action buttons at the bottom
right.

---

## 3. Commit Log Panel

### 3.1 Container

- Position: Bottom of the editor panel, above the status bar
- Width: 100%
- Height: Collapsed 28px, Expanded 200px
- BackgroundColor3: theme.SIDEBAR
- Border: 1px top in theme.BORDER
- Transition: Height animates over 150ms ease-out

Justification: Collapsed by default so it doesn't consume editor space. 200px
expanded shows ~8 entries at 24px each. Positioned above the status bar so
connection status is always visible.

### 3.2 Header (always visible)

- Height: 28px
- Width: 100%
- BackgroundColor3: theme.PANEL
- Padding: 4px left, 4px right
- Layout: Horizontal

Label:
- Text: "COMMIT LOG"
- Font: GothamSemibold, 10px
- TextColor3: theme.SUBTEXT

Toggle button (right side):
- Width: 20px, Height: 20px
- Text: "v" (collapsed) or "^" (expanded)
- Font: Code, 10px
- TextColor3: theme.SUBTEXT
- BackgroundTransparency: 1

Justification: Uppercase label matches the terminal-inspired visual language.
The toggle button is small and unobtrusive.

### 3.3 Entry List (visible when expanded)

- Width: 100%
- Height: 172px (200 - 28)
- Padding: 4px
- Scroll: Vertical, ScrollBarThickness: 4px

Each entry:
- Height: 24px
- Width: 100%
- Padding: 2px left, 4px right
- Layout: Horizontal

Entry content:
- Timestamp: Font Code 9px, TextColor3 theme.SUBTEXT, width 60px
- Label: Font Gotham 10px, TextColor3 theme.TEXT, width remaining minus 50px
- REVERT button: Width 48px, Height 18px, Font GothamSemibold 9px,
  TextColor3 theme.RED, BackgroundColor3 theme.PANEL, visible on hover

Entry states:
- Default: BackgroundTransparency 1
- Hover: BackgroundColor3 theme.PANEL
- Expanded (showing full diff): Height auto, max 100px, shows full diff
  in a sub-panel with the same styling as the suggestion popup diff section

Justification: 24px per entry is compact. REVERT only on hover reduces visual
noise. Expanding an entry to show the full diff lets the developer review what
was changed before reverting.

---

## 4. Settings Panel

### 4.1 Overlay

- Size: 100% x 100% of editor panel
- BackgroundColor3: theme.BG at 80% opacity
- Z-index: Above all editor content

### 4.2 Modal

- Width: 360px
- Height: 400px
- Position: Centered in overlay
- BackgroundColor3: theme.PANEL
- Border: 1px solid theme.BORDER
- Corner radius: 2px
- Padding: 16px

Justification: 360px is wide enough for labeled input fields. Centered modal
is the standard pattern for settings. 2px corner radius matches the rest of the UI.

### 4.3 Title

- Font: GothamSemibold, 14px
- TextColor3: theme.TEXT
- Text: "SETTINGS"
- Padding: 0 bottom 12px

### 4.4 Settings Fields

Each field row:
- Height: 48px
- Layout: Label (top) + Input (bottom)

Label:
- Font: GothamSemibold, 10px
- TextColor3: theme.SUBTEXT
- Height: 16px

Input fields:

Server URL:
- Type: TextBox
- Width: 100%, Height: 28px
- Font: Code, 11px
- BackgroundColor3: theme.BG
- TextColor3: theme.TEXT
- Placeholder: "http://127.0.0.1:8765"
- Border: 1px solid theme.BORDER
- Corner radius: 2px

Polling Interval:
- Type: TextBox (numeric)
- Width: 80px, Height: 28px
- Font: Code, 11px
- BackgroundColor3: theme.BG
- TextColor3: theme.TEXT
- Placeholder: "1000"
- Suffix label: "ms", Font Gotham 10px, TextColor3 theme.SUBTEXT

Max Queue Depth:
- Type: TextBox (numeric)
- Width: 80px, Height: 28px
- Font: Code, 11px
- BackgroundColor3: theme.BG
- TextColor3: theme.TEXT
- Placeholder: "5"

Script Types to Watch:
- Type: Three toggle buttons in a row
- Labels: "Script", "LocalScript", "ModuleScript"
- Each: Width 100px, Height 24px
- Active: BackgroundColor3 theme.ACCENT, TextColor3 theme.TEXT
- Inactive: BackgroundColor3 theme.BG, TextColor3 theme.SUBTEXT
- Border: 1px solid theme.BORDER
- Corner radius: 2px

### 4.5 Close Button

- Width: 80px, Height: 28px
- Position: Bottom-right of modal
- Font: GothamSemibold, 11px
- Text: "CLOSE"
- BackgroundColor3: theme.ACCENT
- TextColor3: theme.TEXT
- Corner radius: 2px

---

## 5. Toolbar Dropdown

### 5.1 Trigger

- Location: Studio Plugins tab, RoAgent button
- Click opens dropdown below the button

### 5.2 Dropdown Menu

- Width: 180px
- Height: Automatic
- BackgroundColor3: theme.PANEL
- Border: 1px solid theme.BORDER
- Corner radius: 2px
- Padding: 4px

### 5.3 Menu Items

Each item:
- Height: 28px
- Width: 100%
- Padding: 8px left
- Font: Gotham, 11px
- TextColor3: theme.TEXT
- BackgroundTransparency: 1 (default)

Items:
- CONNECT / DISMISS (toggles based on connection state)
- THEME (opens theme sub-menu)
- SETTINGS (opens settings panel)
- TOGGLE EDITOR (shows/hides the editor panel)

States:
- Default: as above
- Hover: BackgroundColor3 theme.BORDER, TextColor3 theme.ACCENT
- Disabled: TextColor3 theme.SUBTEXT at 50% transparency

Justification: 180px fits the longest label ("TOGGLE EDITOR") with padding.
28px per item is comfortable for mouse targeting. The dropdown groups all
high-level actions that don't belong in the editor toolbar.

---

## 6. Theme Picker (inside dropdown)

### 6.1 Sub-menu

- Width: 140px
- Position: Right edge of parent dropdown
- BackgroundColor3: theme.PANEL
- Border: 1px solid theme.BORDER
- Corner radius: 2px
- Padding: 4px

### 6.2 Theme Items

Each item:
- Height: 24px
- Padding: 8px left
- Font: Gotham, 11px

Default: TextColor3 theme.TEXT, BackgroundTransparency 1
Hover: BackgroundColor3 theme.BORDER, TextColor3 theme.ACCENT
Active (current theme): TextColor3 theme.ACCENT

Items: High Contrast, One Dark, Dracula, Gruvbox, + Add Custom...

Justification: Sub-menu to the right follows standard menu conventions. Active
theme highlighted with accent color so the developer always knows which is
selected.

---

## 7. Connection Status States

| State | Status Bar Text | Color | Agent Indicator |
|-------|----------------|-------|-----------------|
| Connected, idle | IDLE | theme.SUBTEXT | empty |
| Connected, agent processing | THINKING | theme.YELLOW | Blinking "_" |
| Connected, suggestion ready | IDLE | theme.SUBTEXT | empty |
| Disconnected | ERR | theme.RED | empty |
| Reconnecting | THINKING | theme.YELLOW | Blinking "_" |

Justification: Four states cover all scenarios. The blinking cursor is the only
animation — it signals "waiting for response" without a spinner. ERR in the
status bar is immediately visible.

---

## 8. Dimensions Summary

| Element | Width | Height | Position |
|---------|-------|--------|----------|
| Editor panel (default) | 800px | 600px | Docked right |
| Editor panel (minimum) | 400px | 300px | — |
| Tab bar | 100% | 28px | Top |
| Toolbar | 100% | 32px | Below tab bar |
| Main area | 100% | minus 82px | Below toolbar |
| Line gutter | 48px | 100% | Left of main area |
| Editor viewport | minus 48px | 100% | Right of gutter |
| Status bar | 100% | 22px | Bottom |
| Commit log (collapsed) | 100% | 28px | Above status bar |
| Commit log (expanded) | 100% | 200px | Above status bar |
| Suggestion popup | viewport - 16px | max 200px | Below affected line |
| Settings modal | 360px | 400px | Centered |
| Toolbar dropdown | 180px | auto | Below toolbar button |
| Theme picker | 140px | auto | Right of dropdown |

---

## 9. Font Summary

| Usage | Font | Size | Weight |
|-------|------|------|--------|
| Code / tokens | Code (monospace) | 11px | Normal |
| Line numbers | Code (monospace) | 10px | Normal |
| Status bar | Gotham | 10px | Normal |
| Status bar labels | GothamSemibold | 10px | Bold |
| Tab buttons | GothamSemibold | 11px | Bold |
| Toolbar buttons | GothamSemibold | 11px | Bold |
| Settings labels | GothamSemibold | 10px | Bold |
| Settings title | GothamSemibold | 14px | Bold |
| Menu items | Gotham | 11px | Normal |
| Diff text | Code (monospace) | 10px | Normal |
| Explanation | Gotham | 10px | Normal |
| Commit log entries | Gotham | 10px | Normal |
| Commit log timestamps | Code (monospace) | 9px | Normal |

---

## 10. Color Role Mapping

| Role | Usage |
|------|-------|
| BG | Editor background, input backgrounds |
| PANEL | Toolbar, status bar, tab bar bg, popup bg, modal bg |
| SIDEBAR | Commit log bg, tab bar |
| BORDER | All 1px borders, scroll bars |
| TEXT | Primary text, code identifiers, button text |
| SUBTEXT | Secondary text, line numbers, placeholders, labels |
| ACCENT | Active states, cursor line number, buttons, highlights |
| GREEN | Diff additions, APPLY button, CONNECTED status |
| RED | Diff removals, DISMISS button, REVERT, ERR status |
| YELLOW | THINKING status, warnings |
| KEYWORD | Lua keywords |
| STRING | String literals |
| COMMENT | Comments |
| NUMBER | Numeric literals |
| FUNCTION | Function names |
| OPERATOR | Operators and punctuation |
| LINE_NUMBER | Gutter line numbers |
| CURSOR_LINE | Background of active line |
| SELECTION | Background of selected lines |
| DIFF_ADD | Diff added text foreground |
| DIFF_DEL | Diff deleted text foreground |
| DIFF_ADD_LINE | Diff added line background |
| DIFF_DEL_LINE | Diff deleted line background |
| SCROLL_BAR | Scrollbar thumb color |
