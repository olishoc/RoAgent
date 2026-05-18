--[[
    EditorService — DockWidget lifecycle and tab management for RoAgent v3
    Creates the dock widget, manages tabs, binds script events.
]]

local EditorService = {
    _plugin = nil,
    _widget = nil,
    _editorWidget = nil,
    _isOpen = false,
    _tabs = {},        -- { instance, document, source, modified }
    _activeTabIdx = 0,
    _selectionConnection = nil,
}

function EditorService.init(plugin)
    EditorService._plugin = plugin
    EditorService._widget = plugin:CreateDockWidgetPluginGui(
        "RoAgent_Editor",
        DockWidgetPluginGuiInfo.new(
            Enum.InitialDockState.Right,
            true,   -- enabled on creation (will be toggled)
            false,  -- not overrideable
            800, 600,
            400, 300
        )
    )
    EditorService._widget.Title = "RoAgent"
    EditorService._widget.Enabled = false

    EditorService._widget:GetPropertyChangedSignal("Enabled"):Connect(function()
        EditorService._isOpen = EditorService._widget.Enabled
    end)

    return true
end

function EditorService.destroy()
    if EditorService._selectionConnection then
        EditorService._selectionConnection:Disconnect()
        EditorService._selectionConnection = nil
    end
    if EditorService._widget then
        EditorService._widget:Destroy()
        EditorService._widget = nil
    end
    EditorService._tabs = {}
    EditorService._activeTabIdx = 0
end

function EditorService.toggle()
    if not EditorService._widget then return end
    EditorService._widget.Enabled = not EditorService._widget.Enabled
end

function EditorService.isOpen()
    return EditorService._isOpen
end

function EditorService.getWidget()
    return EditorService._widget
end

-- ── Tab Management ──────────────────────────────────────────────────────────────

function EditorService.getTab(instance)
    for i, tab in ipairs(EditorService._tabs) do
        if tab.instance == instance then
            return tab, i
        end
    end
    return nil, 0
end

function EditorService.openScript(instance)
    -- Check if already open
    local existing, idx = EditorService.getTab(instance)
    if existing then
        EditorService._activeTabIdx = idx
        return existing
    end

    -- Read source
    local source = ""
    pcall(function()
        source = instance.Source or ""
    end)

    local tab = {
        instance = instance,
        source = source,
        modified = false,
    }
    table.insert(EditorService._tabs, tab)
    EditorService._activeTabIdx = #EditorService._tabs

    -- Ensure widget is visible
    if EditorService._widget and not EditorService._widget.Enabled then
        EditorService._widget.Enabled = true
    end

    return tab
end

function EditorService.closeTab(instance)
    local _, idx = EditorService.getTab(instance)
    if idx == 0 then return false end

    table.remove(EditorService._tabs, idx)

    if #EditorService._tabs == 0 then
        EditorService._activeTabIdx = 0
        if EditorService._widget then
            EditorService._widget.Enabled = false
        end
    else
        if EditorService._activeTabIdx > #EditorService._tabs then
            EditorService._activeTabIdx = #EditorService._tabs
        end
    end

    return true
end

function EditorService.switchTab(index)
    if index < 1 or index > #EditorService._tabs then return end
    EditorService._activeTabIdx = index
end

function EditorService.getActiveTab()
    if EditorService._activeTabIdx < 1 then return nil end
    return EditorService._tabs[EditorService._activeTabIdx]
end

function EditorService.getActiveTabIndex()
    return EditorService._activeTabIdx
end

function EditorService.getTabCount()
    return #EditorService._tabs
end

function EditorService.getTabs()
    return EditorService._tabs
end

-- ── Selection Binding ──────────────────────────────────────────────────────────

function EditorService.bindEvents()
    local Selection = game:GetService("Selection")

    EditorService._selectionConnection = Selection.SelectionChanged:Connect(function()
        local selection = Selection:Get()
        if #selection == 0 then return end

        local target = selection[1]
        if not target then return end

        local cls = target.ClassName
        local isWatched = false

        if cls == "Script" then
            isWatched = EditorService._plugin and true -- always watch Script
        elseif cls == "LocalScript" then
            isWatched = true
        elseif cls == "ModuleScript" then
            isWatched = true
        end

        if isWatched then
            EditorService.openScript(target)
        end
    end)
end

return EditorService
