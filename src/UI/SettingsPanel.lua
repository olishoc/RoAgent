--[[
    SettingsPanel — Settings modal for RoAgent v3
    Server URL, polling interval, queue depth, script type toggles.
]]

local SettingsPanel = {}

local Components = require(script.Parent.Components)

local _parent = nil
local _theme = nil
local _configService = nil
local _stateStore = nil

local _overlay = nil
local _modal = nil
local _serverUrlInput = nil
local _pollingInput = nil
local _queueDepthInput = nil

local _visible = false

-- ── Layout ─────────────────────────────────────────────────────────────────────

local function createField(parent, labelText, yPos)
    local lbl = Components.label(parent, labelText, 10, Enum.Font.GothamSemibold,
        UDim2.new(0, 0, 0, yPos), nil, Enum.TextXAlignment.Left)
    lbl.Size = UDim2.new(1, 0, 0, 16)
    lbl.TextColor3 = _theme.SUBTEXT
    return lbl
end

local function createInput(parent, placeholder, yPos, width)
    local input = Components.textbox(parent, placeholder,
        UDim2.new(width or 1, 0, 0, 28), UDim2.new(0, 0, 0, yPos + 18))
    input.BackgroundColor3 = _theme.BG
    input.TextColor3 = _theme.TEXT
    input.PlaceholderColor3 = _theme.SUBTEXT
    Components.stroke(input, _theme.BORDER, 1)
    return input
end

-- ── Script type toggles ───────────────────────────────────────────────────────

local _scriptToggles = {}

local function createToggleRow(parent, yPos)
    local row = Components.frame(parent, UDim2.new(1, 0, 0, 24), UDim2.new(0, 0, 0, yPos + 18), "ToggleRow")
    row.BackgroundTransparency = 1

    local types = {"Script", "LocalScript", "ModuleScript"}
    for i, typeName in ipairs(types) do
        local btn = Components.button(row, typeName, UDim2.new(0, 100, 1, 0), nil, "Toggle_" .. typeName)
        btn.LayoutOrder = i
        btn.BackgroundColor3 = _theme.ACCENT
        btn.TextColor3 = _theme.TEXT
        btn.Font = Enum.Font.GothamSemibold
        btn.TextSize = 10

        _scriptToggles[typeName] = btn

        btn.MouseButton1Click:Connect(function()
            -- Toggle visual state
            if btn.BackgroundColor3 == _theme.ACCENT then
                btn.BackgroundColor3 = _theme.BG
                btn.TextColor3 = _theme.SUBTEXT
            else
                btn.BackgroundColor3 = _theme.ACCENT
                btn.TextColor3 = _theme.TEXT
            end
        end)
    end
end

-- ── Save settings ──────────────────────────────────────────────────────────────

local function saveSettings()
    if _configService then
        if _serverUrlInput and _serverUrlInput.Text ~= "" then
            _configService:set("serverUrl", _serverUrlInput.Text)
        end
        if _pollingInput and _pollingInput.Text ~= "" then
            local val = tonumber(_pollingInput.Text)
            if val then
                _configService:set("pollingInterval", val)
            end
        end
        if _queueDepthInput and _queueDepthInput.Text ~= "" then
            local val = tonumber(_queueDepthInput.Text)
            if val then
                _configService:set("maxQueueDepth", val)
            end
        end
    end
end

-- ── Public API ─────────────────────────────────────────────────────────────────

function SettingsPanel.init(parent, theme, configService, stateStore)
    _parent = parent
    _theme = theme
    _configService = configService
    _stateStore = stateStore

    -- Overlay
    _overlay = Components.frame(parent, UDim2.fromScale(1, 1), nil, "SettingsOverlay")
    _overlay.BackgroundColor3 = Color3.new(0, 0, 0)
    _overlay.BackgroundTransparency = 0.5
    _overlay.ZIndex = 50
    _overlay.Visible = false

    -- Modal
    _modal = Components.frame(_overlay, UDim2.new(0, 360, 0, 400),
        UDim2.new(0.5, -180, 0.5, -200), "SettingsModal")
    _modal.BackgroundColor3 = theme.PANEL
    _modal.ZIndex = 51
    Components.stroke(_modal, theme.BORDER, 1)
    Components.corner(_modal, 2)

    local pad = Components.pad(_modal, 16)

    -- Title
    local title = Components.label(_modal, "SETTINGS", 14, Enum.Font.GothamSemibold,
        UDim2.new(0, 16, 0, 16), nil, Enum.TextXAlignment.Left)
    title.Size = UDim2.new(1, -32, 0, 20)
    title.TextColor3 = theme.TEXT
    title.ZIndex = 52

    local y = 44

    -- Server URL
    createField(_modal, "SERVER URL", y)
    _serverUrlInput = createInput(_modal, "http://127.0.0.1:8765", y, 1)
    _serverUrlInput.ZIndex = 52
    if _configService then
        _serverUrlInput.Text = _configService:get("serverUrl") or ""
    end
    y = y + 52

    -- Polling Interval
    createField(_modal, "POLLING INTERVAL (ms)", y)
    _pollingInput = createInput(_modal, "1000", y, 0)
    _pollingInput.Size = UDim2.new(0, 80, 0, 28)
    _pollingInput.ZIndex = 52
    if _configService then
        local val = _configService:get("pollingInterval")
        if val then _pollingInput.Text = tostring(val) end
    end
    y = y + 52

    -- Max Queue Depth
    createField(_modal, "MAX QUEUE DEPTH", y)
    _queueDepthInput = createInput(_modal, "5", y, 0)
    _queueDepthInput.Size = UDim2.new(0, 80, 0, 28)
    _queueDepthInput.ZIndex = 52
    if _configService then
        local val = _configService:get("maxQueueDepth")
        if val then _queueDepthInput.Text = tostring(val) end
    end
    y = y + 52

    -- Script Types
    createField(_modal, "SCRIPT TYPES TO WATCH", y)
    createToggleRow(_modal, y)
    y = y + 44

    -- Close button
    local closeBtn = Components.button(_modal, "CLOSE",
        UDim2.new(0, 80, 0, 28), UDim2.new(1, -96, 1, -44), "CloseBtn")
    closeBtn.BackgroundColor3 = theme.ACCENT
    closeBtn.TextColor3 = theme.TEXT
    closeBtn.Font = Enum.Font.GothamSemibold
    closeBtn.TextSize = 11
    closeBtn.ZIndex = 52

    closeBtn.MouseButton1Click:Connect(function()
        saveSettings()
        SettingsPanel.hide()
    end)

    return SettingsPanel
end

function SettingsPanel.show()
    _visible = true
    if _overlay then
        _overlay.Visible = true
    end
end

function SettingsPanel.hide()
    _visible = false
    saveSettings()
    if _overlay then
        _overlay.Visible = false
    end
end

function SettingsPanel.isVisible()
    return _visible
end

function SettingsPanel.applyTheme(theme)
    _theme = theme
    if not _modal then return end
    _modal.BackgroundColor3 = theme.PANEL
    if _serverUrlInput then
        _serverUrlInput.BackgroundColor3 = theme.BG
        _serverUrlInput.TextColor3 = theme.TEXT
    end
    if _pollingInput then
        _pollingInput.BackgroundColor3 = theme.BG
        _pollingInput.TextColor3 = theme.TEXT
    end
    if _queueDepthInput then
        _queueDepthInput.BackgroundColor3 = theme.BG
        _queueDepthInput.TextColor3 = theme.TEXT
    end
end

return SettingsPanel
