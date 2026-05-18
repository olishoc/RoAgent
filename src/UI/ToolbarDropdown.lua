--[[
    ToolbarDropdown — Dropdown menu for the Studio toolbar button.
    Connect/disconnect, theme picker, settings, toggle editor.
]]

local ToolbarDropdown = {}

local Components = require(script.Parent.Components)

local _theme = nil
local _configService = nil
local _stateStore = nil
local _eventBus = nil
local _agentService = nil
local _editorService = nil
local _settingsPanel = nil
local _editorWidget = nil

local _dropdown = nil
local _themeSubmenu = nil
local _visible = false

-- ── Menu items ─────────────────────────────────────────────────────────────────

local function createMenuItem(parent, text, yPos, callback)
    local btn = Components.button(parent, text, UDim2.new(1, 0, 0, 28), nil, "MenuItem")
    btn.Position = UDim2.new(0, 0, 0, yPos)
    btn.BackgroundColor3 = _theme.PANEL
    btn.TextColor3 = _theme.TEXT
    btn.Font = Enum.Font.Gotham
    btn.TextSize = 11
    btn.AutoButtonColor = false
    btn.ZIndex = 20

    btn.MouseEnter:Connect(function()
        btn.BackgroundColor3 = _theme.BORDER
        btn.TextColor3 = _theme.ACCENT
    end)
    btn.MouseLeave:Connect(function()
        btn.BackgroundColor3 = _theme.PANEL
        btn.TextColor3 = _theme.TEXT
    end)

    if callback then
        btn.MouseButton1Click:Connect(function()
            callback()
            ToolbarDropdown.hide()
        end)
    end

    return btn
end

-- ── Theme submenu ──────────────────────────────────────────────────────────────

local function showThemeSubmenu()
    if _themeSubmenu then
        _themeSubmenu:Destroy()
        _themeSubmenu = nil
        return
    end

    _themeSubmenu = Components.frame(_dropdown, UDim2.new(0, 140, 0, 0),
        UDim2.new(1, 4, 0, 0), "ThemeSubmenu")
    _themeSubmenu.BackgroundColor3 = _theme.PANEL
    _themeSubmenu.BackgroundTransparency = 0
    Components.stroke(_themeSubmenu, _theme.BORDER, 1)
    Components.corner(_themeSubmenu, 2)
    _themeSubmenu.ZIndex = 25

    local ThemeService = require(script.Parent.Parent.Services.ThemeService)
    local names = ThemeService.getThemeNames()
    for i, name in ipairs(names) do
        local item = Components.button(_themeSubmenu, name, UDim2.new(1, 0, 0, 24), nil, "ThemeItem_" .. name)
        item.Position = UDim2.new(0, 0, 0, (i - 1) * 24)
        item.BackgroundColor3 = _theme.PANEL
        item.TextColor3 = _theme.TEXT
        item.Font = Enum.Font.Gotham
        item.TextSize = 11
        item.AutoButtonColor = false
        item.ZIndex = 26

        item.MouseEnter:Connect(function()
            item.BackgroundColor3 = _theme.BORDER
            item.TextColor3 = _theme.ACCENT
        end)
        item.MouseLeave:Connect(function()
            item.BackgroundColor3 = _theme.PANEL
            item.TextColor3 = _theme.TEXT
        end)

        item.MouseButton1Click:Connect(function()
            ThemeService.setTheme(name)
            if _editorWidget then
                local theme = ThemeService.getActive()
                _editorWidget.applyTheme(theme)
            end
            if _settingsPanel then
                _settingsPanel.applyTheme(ThemeService.getActive())
            end
            ToolbarDropdown.hide()
        end)
    end

    _themeSubmenu.Size = UDim2.new(0, 140, 0, #names * 24)
end

-- ── Public API ─────────────────────────────────────────────────────────────────

function ToolbarDropdown.init(theme, configService, stateStore, eventBus, agentService, editorService, settingsPanel, editorWidget)
    _theme = theme
    _configService = configService
    _stateStore = stateStore
    _eventBus = eventBus
    _agentService = agentService
    _editorService = editorService
    _settingsPanel = settingsPanel
    _editorWidget = editorWidget

    return ToolbarDropdown
end

function ToolbarDropdown.show(parent)
    if _dropdown then
        _dropdown:Destroy()
    end

    _visible = true
    _dropdown = Components.frame(parent, UDim2.new(0, 180, 0, 0), nil, "ToolbarDropdown")
    _dropdown.BackgroundColor3 = _theme.PANEL
    _dropdown.BackgroundTransparency = 0
    Components.stroke(_dropdown, _theme.BORDER, 1)
    Components.corner(_dropdown, 2)
    _dropdown.ZIndex = 20

    local y = 4
    local padding = 4

    -- Connect/Disconnect
    local isConnected = _agentService and _agentService.isConnected()
    local connectLabel = isConnected and "DISCONNECT" or "CONNECT"
    createMenuItem(_dropdown, connectLabel, y, function()
        if isConnected then
            if _agentService then _agentService.disconnect() end
        else
            if _agentService then _agentService.connect() end
        end
    end)
    y = y + 28

    -- Theme
    createMenuItem(_dropdown, "THEME >", y, function()
        showThemeSubmenu()
    end)
    y = y + 28

    -- Settings
    createMenuItem(_dropdown, "SETTINGS", y, function()
        if _settingsPanel then
            _settingsPanel.show()
        end
    end)
    y = y + 28

    -- Toggle Editor
    createMenuItem(_dropdown, "TOGGLE EDITOR", y, function()
        if _editorService then
            _editorService.toggle()
        end
    end)
    y = y + 28

    _dropdown.Size = UDim2.new(0, 180, 0, y + padding)
end

function ToolbarDropdown.hide()
    _visible = false
    if _dropdown then
        _dropdown:Destroy()
        _dropdown = nil
    end
    if _themeSubmenu then
        _themeSubmenu:Destroy()
        _themeSubmenu = nil
    end
end

function ToolbarDropdown.isVisible()
    return _visible
end

function ToolbarDropdown.applyTheme(theme)
    _theme = theme
end

return ToolbarDropdown
