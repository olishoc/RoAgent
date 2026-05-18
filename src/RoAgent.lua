-- RoAgent v3 — Pi-powered AI Script Editor for Roblox Studio
-- See docs/architecture.md for module descriptions and extension guide.

-- ══ SERVICES ══════════════════════════════════════════════════════════════════════

local ConfigService   = require(script.Services.ConfigService)
local ThemeService    = require(script.Services.ThemeService)
local EventBus        = require(script.Services.EventBus)
local StateStore      = require(script.Services.StateStore)
local SyntaxService   = require(script.Services.SyntaxService)
local DiffService     = require(script.Services.DiffService)
local HistoryService  = require(script.Services.HistoryService)
local ScriptWriter    = require(script.Services.ScriptWriter)
local AgentService    = require(script.Services.AgentService)
local EditorService   = require(script.Services.EditorService)

-- ══ UI ═══════════════════════════════════════════════════════════════════════════

local Components        = require(script.UI.Components)
local EditorWidget      = require(script.UI.EditorWidget)
local SuggestionPopup   = require(script.UI.SuggestionPopup)
local CommitLogPanel    = require(script.UI.CommitLogPanel)
local SettingsPanel     = require(script.UI.SettingsPanel)
local ToolbarDropdown   = require(script.UI.ToolbarDropdown)

-- ══ PLUGIN LIFECYCLE ════════════════════════════════════════════════════════════

local _initialized = false
local _toolbarBtn = nil

-- ── Initialization ─────────────────────────────────────────────────────────────

local function init()
    if _initialized then return end
    _initialized = true

    -- Core services (order matters)
    ConfigService.init(plugin)
    ThemeService.init(ConfigService)
    EventBus.clear()
    StateStore.init(EventBus)

    -- Logic services
    HistoryService.init()

    -- Editor service (creates dock widget)
    EditorService.init(plugin)

    -- Get active theme
    local theme = ThemeService.getActive()

    -- Build editor UI
    local widget = EditorService.getWidget()
    EditorWidget.init(widget, EditorService, theme, EventBus, StateStore,
        AgentService, HistoryService, DiffService, ScriptWriter, SettingsPanel)

    -- Suggestion popup (inside editor)
    SuggestionPopup.init(EditorWidget.getRoot(), theme, EventBus, StateStore,
        AgentService, HistoryService, DiffService, ScriptWriter, EditorWidget)

    -- Commit log panel (inside editor)
    CommitLogPanel.init(EditorWidget.getRoot(), theme, EventBus, HistoryService,
        EditorWidget, ScriptWriter, DiffService)

    -- Settings panel (inside editor)
    SettingsPanel.init(EditorWidget.getRoot(), theme, ConfigService, StateStore)

    -- Agent service (after UI is ready)
    AgentService.init(ConfigService, StateStore, EventBus)

    -- Theme change callback
    ThemeService.onThemeChange(function(newTheme)
        EditorWidget.applyTheme(newTheme)
        SuggestionPopup.applyTheme(newTheme)
        CommitLogPanel.applyTheme(newTheme)
        SettingsPanel.applyTheme(newTheme)
    end)

    -- Bind selection events
    EditorService.bindEvents()

    -- Try initial connection
    task.delay(1, function()
        AgentService.connect()
    end)

    print("[RoAgent v3] Initialized")
end

-- ── Toolbar ────────────────────────────────────────────────────────────────────

local function createToolbar()
    local toolbar = plugin:CreateToolbar("RoAgent")
    _toolbarBtn = toolbar:CreateButton(
        "RoAgent",
        "Toggle RoAgent Script Editor",
        "rbxassetid://0"
    )

    _toolbarBtn.Click:Connect(function()
        if not _initialized then
            init()
        end
        EditorService.toggle()
        _toolbarBtn:SetActive(EditorService.isOpen())
    end)
end

-- ── Cleanup ────────────────────────────────────────────────────────────────────

local function cleanup()
    AgentService.destroy()
    EditorService.destroy()
    EditorWidget.destroy()
    SuggestionPopup.destroy()
    CommitLogPanel.destroy()
    HistoryService.destroy()
    StateStore.destroy()
    ThemeService.destroy()
    ConfigService.destroy()
    EventBus.clear()
    _initialized = false
    print("[RoAgent v3] Cleaned up")
end

-- ══ ENTRY POINT ═════════════════════════════════════════════════════════════════

createToolbar()

plugin.Unloading:Connect(cleanup)

print("[RoAgent v3] Loaded. Click the toolbar button to open the editor.")
