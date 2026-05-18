# RoAgent v3 — Theme System

## Theme Table Schema

A theme is a Lua table with the following fields. All fields are Color3 values
unless noted otherwise.

### Required Fields

| Field | Type | Usage |
|-------|------|-------|
| name | string | Display name (e.g. "High Contrast") |
| BG | Color3 | Editor background, input backgrounds |
| PANEL | Color3 | Toolbar, status bar, popup background, modal background |
| SIDEBAR | Color3 | Tab bar background, commit log background |
| BORDER | Color3 | All 1px borders, scrollbars |
| TEXT | Color3 | Primary text, code identifiers, button text |
| SUBTEXT | Color3 | Secondary text, line numbers, placeholders, labels |
| ACCENT | Color3 | Active states, cursor line number, buttons, highlights |
| GREEN | Color3 | Diff additions, APPLY button, CONNECTED status |
| RED | Color3 | Diff removals, DISMISS button, REVERT, ERR status |
| YELLOW | Color3 | THINKING status, warnings |
| KEYWORD | Color3 | Lua keywords (local, function, if, etc.) |
| STRING | Color3 | String literals |
| COMMENT | Color3 | Comments |
| NUMBER | Color3 | Numeric literals |
| FUNCTION | Color3 | Function names |
| OPERATOR | Color3 | Operators and punctuation |
| LINE_NUMBER | Color3 | Gutter line numbers |
| CURSOR_LINE | Color3 | Background of the active cursor line |
| SELECTION | Color3 | Background of selected lines |
| DIFF_ADD | Color3 | Diff added text foreground |
| DIFF_DEL | Color3 | Diff deleted text foreground |
| DIFF_ADD_LINE | Color3 | Diff added line background |
| DIFF_DEL_LINE | Color3 | Diff deleted line background |
| SCROLL_BAR | Color3 | Scrollbar thumb color |

### Complete Example

```lua
local MyTheme = {
    name         = "My Custom Theme",
    BG           = Color3.fromRGB(5, 5, 10),
    PANEL        = Color3.fromRGB(10, 10, 18),
    SIDEBAR      = Color3.fromRGB(8, 8, 14),
    BORDER       = Color3.fromRGB(60, 60, 80),
    TEXT         = Color3.fromRGB(240, 240, 250),
    SUBTEXT      = Color3.fromRGB(140, 140, 160),
    ACCENT       = Color3.fromRGB(0, 200, 255),
    GREEN        = Color3.fromRGB(0, 220, 120),
    RED          = Color3.fromRGB(255, 60, 60),
    YELLOW       = Color3.fromRGB(255, 200, 80),
    KEYWORD      = Color3.fromRGB(255, 100, 180),
    STRING       = Color3.fromRGB(100, 255, 180),
    COMMENT      = Color3.fromRGB(100, 100, 120),
    NUMBER       = Color3.fromRGB(255, 200, 100),
    FUNCTION     = Color3.fromRGB(100, 180, 255),
    OPERATOR     = Color3.fromRGB(220, 220, 240),
    LINE_NUMBER  = Color3.fromRGB(80, 80, 100),
    CURSOR_LINE  = Color3.fromRGB(20, 20, 35),
    SELECTION    = Color3.fromRGB(40, 40, 80),
    DIFF_ADD     = Color3.fromRGB(20, 80, 40),
    DIFF_DEL     = Color3.fromRGB(80, 30, 30),
    DIFF_ADD_LINE= Color3.fromRGB(15, 50, 25),
    DIFF_DEL_LINE= Color3.fromRGB(50, 20, 20),
    SCROLL_BAR   = Color3.fromRGB(60, 60, 80),
}
```

## Built-in Themes

Four themes ship with the plugin:

| Name | Style | Default |
|------|-------|---------|
| High Contrast | Dark, high saturation, white/yellow accents on near-black | Yes |
| One Dark | VSCode One Dark Pro palette | No |
| Dracula | Dracula color scheme | No |
| Gruvbox | Gruvbox soft, warm tones | No |

## Registering a Custom Theme

Call ThemeService.addCustomTheme(name, themeData):

```lua
local ThemeService = require(plugin.Services.ThemeService)

local ok, err = ThemeService.addCustomTheme("My Theme", {
    name = "My Theme",
    BG = Color3.fromRGB(30, 30, 30),
    -- ... all required fields ...
})

if ok then
    ThemeService.setTheme("My Theme")
end
```

Validation: addCustomTheme checks that all required fields are present and are
Color3 values. Returns false and a warning if validation fails.

## Switching Themes

```lua
ThemeService.setTheme("One Dark")
```

This:
1. Validates the theme exists.
2. Sets it as the active theme.
3. Persists the choice via ConfigService.
4. Fires the "themeChanged" event.
5. All UI modules subscribed to the event re-render with new colors.

## Theme Persistence

The active theme name is stored in plugin settings under the key "RoAgent_theme".
On plugin load, ThemeService reads this value and applies the saved theme. If
the saved theme no longer exists (e.g. a custom theme was removed), it falls
back to "High Contrast".

## Color Role Conventions

- BG: Near-black or very dark gray. Never pure black (0,0,0) — use at least
  (5,5,10) to allow subtle layering.
- TEXT: High contrast against BG. Minimum 200/255 on at least one channel.
- SUBTEXT: 40-60% brightness of TEXT. Used for non-essential information.
- ACCENT: Single accent color. Never use multiple accent colors simultaneously.
- GREEN/RED/YELLOW: Desaturated. Diff colors should be dim, not vivid. Target
  saturation around 50-60% of full saturation.
- DIFF_ADD_LINE/DIFF_DEL_LINE: Very dark versions of GREEN/RED. Should be
  visible as a background tint without making text unreadable.
- CURSOR_LINE: Slightly lighter than BG. Just enough to distinguish the line.
- SELECTION: 2-3x the brightness of CURSOR_LINE. Visible but not distracting.
