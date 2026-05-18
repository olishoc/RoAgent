# RoAgent v3 Implementation Plan
**Date:** 2026-05-10  
**Status:** Ready for Execution  
**RepoRoot:** `/home/olivi/roagent`

---

## Problem Summary

RoAgent v2 is a monolithic 800-line Roblox Studio plugin with basic TextBox editing, no syntax highlighting, and no local file sync. The v3 goal is a modular, feature-rich script editor with:
- Custom editor widget replacing Roblox's default
- Full Lua syntax highlighting
- Agent ghost text completions + chat panel
- Local .lua file sync (auto-detect scripts)
- VSCode-inspired theme system
- 7 modular services for clean extensibility

**Server unchanged** (`server/src/index.js`).

---

## Relevant Learnings

- **Brainstorm artifact:** `docs/brainstorms/roagent-v3-script-editor.md` (source of truth)
- **Handoff:** Not found at `.context/compound-engineering/handoffs/roagent-v3-handoff.md`
- **Language:** Lua (Roblox Studio plugin) + minimal JavaScript server
- **No existing solution patterns** in `docs/solutions/`

---

## Scope Boundaries

### In Scope
- Modular plugin architecture (7 services)
- Custom DockWidgetPluginGui editor
- Lua syntax tokenizer/highlighter
- Theme system with 4 presets
- Agent ghost text + chat panel
- Diff visualization for agent changes
- FileSyncService for local .lua read/write
- Right-click context menu for sync
- README with extension guide

### Out of Scope
- Rojo project.json integration
- Real-time collaboration
- Debugging tools
- Plugin packaging/deployment automation
- Spring physics animations
- Remote script execution

---

## Implementation Units

### Phase 1: Architecture Foundation

#### 1.1: ConfigService + ThemeService
**Goal:** Settings persistence and theme system foundation

**Files:**
- Create: `plugin/Services/ConfigService.lua`
- Create: `plugin/Services/ThemeService.lua`
- Create: `plugin/Themes/HighContrast.lua`
- Create: `plugin/Themes/OneDark.lua`
- Create: `plugin/Themes/Dracula.lua`
- Create: `plugin/Themes/Gruvbox.lua`

**Patterns:** Follow Roblox plugin idioms — use `PluginSettings` for persistence, `Instance.new()` for objects

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| Save API key, reload plugin | Key persisted |
| Switch theme, close/reopen widget | Theme persists |
| Invalid theme name fallback | Defaults to HighContrast |

**Verification:** Manual load plugin, set/get config, switch themes via dropdown

**Dependencies:** None

---

#### 1.2: Service Registry + Base UI Components
**Goal:** Main `RoAgent.lua` entry with service registry, reusable UI primitives

**Files:**
- Modify: `plugin/RoAgent.lua` (new scaffold)
- Create: `plugin/UI/Components.lua`

**Patterns:** Central service registry table, `init(plugin)` for all services, `destroy()` cleanup

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| Plugin loads without error | All services initialize |
| Plugin destroyed | All services cleanup |
| Invalid service | Log warning, continue |

**Verification:** Load in Roblox Studio, check Output for errors

**Dependencies:** 1.1

---

### Phase 2: Custom Editor Core

#### 2.1: EditorService — Main Widget
**Goal:** DockWidgetPluginGui with tab bar, toolbar, status bar, main code area

**Files:**
- Create: `plugin/Services/EditorService.lua`
- Create: `plugin/UI/EditorWidget.lua`

**Patterns:** Use `Plugin:CreateDockWidgetPluginGui()` for main widget, Frame/TextLabel for UI

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| Click script in Explorer | Widget opens |
| Open multiple scripts | Tabs created |
| Close tab | Widget minimizes or closes |
| Press Ctrl+S | Save triggered |

**Verification:** Click script → widget appears with tab, toolbar, status bar visible

**Dependencies:** 1.1, 1.2

---

#### 2.2: SyntaxService — Lua Tokenizer + Highlighter
**Goal:** Full Lua syntax coloring using TextService/TextBoundsResolver

**Files:**
- Create: `plugin/Services/SyntaxService.lua`

**Patterns:** Regex-based tokenizer → array of `{type, text}` tokens → colored TextLabel children

**Lua tokens to handle:**
- Keywords: `and`, `break`, `do`, `else`, `elseif`, `end`, `false`, `for`, `function`, `if`, `in`, `local`, `nil`, `not`, `or`, `repeat`, `return`, `then`, `true`, `until`, `while`
- Comments: `--` to EOL, `--[[ ]]` blocks
- Strings: `'...'`, `"..."`, `[[...]]` long brackets
- Numbers: integers, floats, hex `0xFF`
- Functions: `function_name(` pattern
- Operators: `=`, `+`, `-`, `*`, `/`, `==`, `~=`, `<`, `>`, etc.

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| `local x = 42` | "local" blue, "x" white, "42" orange |
| `-- comment` | Full line grayed |
| `"string"` | Green text |
| Multi-line `[[long string]]` | Single green token |

**Verification:** Open Lua script → keywords colored per theme

**Dependencies:** 2.1

---

#### 2.3: Line Numbers + Basic Scrolling
**Goal:** Line number gutter, scrollable viewport

**Files:**
- Modify: `plugin/UI/EditorWidget.lua`

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| 100+ line script | Scrollable, line numbers accurate |
| Cursor at line 50 | Line 50 highlighted in gutter |

**Verification:** Paste large script → scrolling works, numbers correct

**Dependencies:** 2.1, 2.2

---

### Phase 3: Agent Integration

#### 3.1: AgentService — Ghost Text + Chat Panel
**Goal:** Debounced ghost text suggestions, chat interface connected to server

**Files:**
- Create: `plugin/Services/AgentService.lua`

**Patterns:** HTTP requests to `http://localhost:3000`, debounce 300ms for ghost text

**API calls:**
- `POST /suggest` — `{source, cursor, context}` → `{suggestion}`
- `POST /chat` — `{message, history}` → `{response}`

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| Type for 2+ seconds | Ghost text appears below cursor |
| Press Tab | Ghost text accepted |
| Press Esc | Ghost text dismissed |
| Server offline | Graceful degradation, no crash |

**Verification:** Start server, type in editor → ghost text shows after debounce

**Dependencies:** 2.1

---

#### 3.2: ChatPanel UI
**Goal:** Sidebar chat interface with message history

**Files:**
- Create: `plugin/UI/ChatPanel.lua`

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| Click Chat tab | Chat panel visible |
| Send message | Shows user message, agent response |
| Long response | Scrollable |

**Verification:** Open chat, send message → exchange visible

**Dependencies:** 3.1

---

#### 3.3: DiffService — Unified Diff Visualization
**Goal:** Visual diff overlay for agent-proposed changes

**Files:**
- Create: `plugin/Services/DiffService.lua`
- Create: `plugin/UI/DiffOverlay.lua`

**Patterns:** Line-by-line diff algorithm → green additions, red deletions

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| Agent proposes change | Diff view shows old→new |
| Accept All | Changes applied |
| Reject All | No changes |
| Per-hunk accept/reject | Only selected changes applied |

**Verification:** Ask agent to modify script → diff overlay visible with correct highlighting

**Dependencies:** 3.1

---

### Phase 4: File Sync

#### 4.1: FileSyncService — Local .lua Read/Write
**Goal:** Track synced scripts, read/write local files via `io` module

**Files:**
- Create: `plugin/Services/FileSyncService.lua`

**Patterns:** Store `{scriptPath → localPath}` mapping, use `io.open()` for file operations

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| Right-click script → Sync | File created at expected path |
| Edit locally, reload | Script updated in Roblox |
| Auto-sync on save | File updated on Ctrl+S |

**Verification:** Right-click script → sync → file exists on disk

**Dependencies:** 2.1

---

#### 4.2: Context Menu Integration
**Goal:** Right-click menu items for sync operations

**Files:**
- Modify: `plugin/RoAgent.lua` (register context menu)

**Test Scenarios:**
| Scenario | Expected |
|----------|----------|
| Right-click script | "Sync to File" appears |
| Right-click synced script | "Sync to File", "Unsync" |
| External file changed | Prompt to reload |

**Verification:** Right-click any script → context menu shows sync options

**Dependencies:** 4.1

---

### Phase 5: Polish & Documentation

#### 5.1: Lightweight Animations
**Goal:** Fade/slide transitions throughout UI

**Files:**
- Modify: `plugin/UI/Components.lua`
- Modify: `plugin/UI/EditorWidget.lua`
- Modify: `plugin/UI/ChatPanel.lua`

**Animation specs:**
| Animation | Duration | Easing |
|-----------|----------|--------|
| Tab switch fade | 150ms | ease-out |
| Panel slide in/out | 200ms | ease-out |
| Diff highlight pulse | 300ms | ease-in-out |
| Button hover | 100ms | ease-out |
| Theme transition | 250ms | ease-in-out |

**Dependencies:** 2.1, 3.2, 3.3

---

#### 5.2: README with Extension Guide
**Goal:** Comprehensive README for future pi session work

**Files:**
- Create: `roagent/README.md`

**Contents:**
- Architecture overview
- How to add a new service
- How to add a new theme
- How to add a new UI component
- API reference for services
- Troubleshooting guide

**Dependencies:** All prior phases

---

## Verification Strategy

### Targeted Verifications
1. **Editor opens:** Click script → DockWidgetPluginGui visible
2. **Syntax highlighting:** Open Lua script → colors match HighContrast theme
3. **Ghost text:** Type for 2+ seconds → suggestion appears
4. **Diff overlay:** Agent propose change → colored diff visible
5. **File sync:** Right-click → sync → file created on disk
6. **Theme switch:** Select theme → all colors update
7. **Animations:** Transitions are subtle, <300ms
8. **README:** Future pi can read and extend plugin

### Broader Verification
- All services initialize without error
- No memory leaks on widget open/close
- Graceful degradation when server offline
- Plugin loads across Roblox Studio sessions

---

## Execution Order

```
Phase 1 ─┬─ 1.1 ConfigService + ThemeService
         └─ 1.2 Service Registry + Components
              │
Phase 2 ─┬─ 2.1 EditorService + EditorWidget
         ├─ 2.2 SyntaxService
         └─ 2.3 Line Numbers + Scrolling
              │
Phase 3 ─┬─ 3.1 AgentService
         ├─ 3.2 ChatPanel UI
         └─ 3.3 DiffService + DiffOverlay
              │
Phase 4 ─┬─ 4.1 FileSyncService
         └─ 4.2 Context Menu Integration
              │
Phase 5 ─┬─ 5.1 Animations
         └─ 5.2 README
```

---

## TDD Enforcement

Each unit follows **RED → GREEN → REFACTOR**:
- **RED:** Write failing test scenario first
- **GREEN:** Implement minimal code to pass
- **REFACTOR:** Clean up without breaking tests

*TDD verification via manual testing in Roblox Studio since no Lua unit test framework available.*

---

## Next Step

Ready for **03-work** execution. Recommend running units in order, starting with Phase 1.