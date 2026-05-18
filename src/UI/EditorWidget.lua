--[[
    EditorWidget — Main editor panel UI for RoAgent v3
    Tab bar, toolbar, line gutter, editor viewport, status bar.
    Renders syntax-highlighted code and tracks cursor position.
]]

local EditorWidget = {}

local Components = require(script.Parent.Components)

-- References to key UI elements
local _widget = nil
local _root = nil
local _tabBar = nil
local _toolbar = nil
local _mainArea = nil
local _lineGutter = nil
local _lineNumbers = nil
local _editorViewport = nil
local _editorContent = nil
local _statusBar = nil
local _statusLeft = nil
local _statusCenter = nil
local _statusRight = nil
local _commitLogPanel = nil

local _tabs = {}        -- { button, instance, source, lineLabels, tokenLabels }
local _activeIdx = 0
local _theme = nil
local _eventBus = nil
local _stateStore = nil
local _agentService = nil
local _historyService = nil
local _diffService = nil
local _scriptWriter = nil
local _editorService = nil

local _blinkTimer = nil
local _blinkVisible = false

-- ── Theme application ──────────────────────────────────────────────────────────

local function applyColor(element, color)
    if element:IsA("Frame") or element:IsA("TextButton") or element:IsA("TextBox") or element:IsA("ScrollingFrame") then
        if element.Name ~= "LineGutter" and element.Name ~= "EditorViewport" then
            -- Only apply to specific elements
        end
    end
end

local function themeFrame(element, colorKey)
    if _theme and _theme[colorKey] then
        element.BackgroundColor3 = _theme[colorKey]
    end
end

local function themeText(element, colorKey)
    if _theme and _theme[colorKey] then
        element.TextColor3 = _theme[colorKey]
    end
end

local function themeAll(theme)
    _theme = theme
    if not _root then return end

    _root.BackgroundColor3 = theme.BG
    _tabBar.BackgroundColor3 = theme.SIDEBAR
    _toolbar.BackgroundColor3 = theme.PANEL
    _mainArea.BackgroundColor3 = theme.BG
    _lineGutter.BackgroundColor3 = theme.PANEL
    _editorViewport.BackgroundColor3 = theme.BG
    _statusBar.BackgroundColor3 = theme.PANEL
    _lineNumbers.ScrollBarImageColor3 = theme.BORDER
    _editorContent.ScrollBarImageColor3 = theme.SCROLL_BAR or theme.BORDER

    themeText(_statusLeft, "SUBTEXT")
    themeText(_statusCenter, "SUBTEXT")
    themeText(_statusRight, "ACCENT")

    -- Update tab buttons
    for i, tab in ipairs(_tabs) do
        if tab.button then
            if i == _activeIdx then
                tab.button.BackgroundColor3 = theme.PANEL
                tab.button.TextColor3 = theme.TEXT
            else
                tab.button.BackgroundColor3 = Color3.new(0, 0, 0)
                tab.button.TextColor3 = theme.SUBTEXT
            end
        end
    end

    -- Re-render active tab content
    if _activeIdx > 0 and _tabs[_activeIdx] then
        renderEditorContent(_tabs[_activeIdx])
    end
end

-- ── Tab system ─────────────────────────────────────────────────────────────────

local function createTabButton(name, index)
    local btn = Components.button(_tabBar, name, UDim2.new(0, 0, 1, 0), nil, "Tab_" .. index)
    btn.AutomaticSize = Enum.AutomaticSize.X
    btn.MinSize = Vector2.new(80, 0)
    btn.LayoutOrder = index
    btn.AutoButtonColor = false

    local tabBarRef = _tabBar
    local themeRef = _theme

    btn.MouseButton1Click:Connect(function()
        EditorWidget.switchToTab(index)
    end)

    btn.MouseEnter:Connect(function()
        if index ~= _activeIdx then
            btn.BackgroundColor3 = _theme and _theme.BORDER or Color3.fromRGB(60, 60, 80)
            btn.BackgroundTransparency = 0.5
        end
    end)

    btn.MouseLeave:Connect(function()
        if index ~= _activeIdx then
            btn.BackgroundColor3 = Color3.new(0, 0, 0)
            btn.BackgroundTransparency = 1
        end
    end)

    return btn
end

local function renderEditorContent(tab)
    if not tab then return end

    -- Clear previous content
    clearContainer(_lineNumbers)
    clearContainer(_editorContent)

    local source = tab.source or ""
    local lineHeight = 16

    -- Split into lines
    local lines = {}
    for line in string.gmatch(source, "([^\n]*)\n?") do
        table.insert(lines, line)
    end
    if #lines == 0 then
        lines = {""}
    end

    -- Line numbers
    for i, line in ipairs(lines) do
        local numLabel = Components.label(_lineNumbers, tostring(i), 10, Enum.Font.Code,
            UDim2.new(1, -4, 0, lineHeight), nil, Enum.TextXAlignment.Right)
        numLabel.LayoutOrder = i
    end

    -- Syntax-highlighted content
    local SyntaxService = require(script.Parent.Parent.Services.SyntaxService)
    local tokens = SyntaxService.tokenize(source)

    -- Group tokens by line
    local lineTokens = {{}}
    for _, tok in ipairs(tokens) do
        for part in string.gmatch(tok.text, "([^\n]*)\n?") do
            if part == "" then continue end
            if string.sub(part, -1) == "\n" then
                local t = string.sub(part, 1, -2)
                if t ~= "" then
                    table.insert(lineTokens[#lineTokens], { type = tok.type, text = t })
                end
                table.insert(lineTokens, {})
            else
                table.insert(lineTokens[#lineTokens], { type = tok.type, text = part })
            end
        end
    end

    -- Render each line
    for lineIdx, lineToks in ipairs(lineTokens) do
        local row = Components.frame(_editorContent, UDim2.new(1, 0, 0, lineHeight), nil, "Line_" .. lineIdx)
        row.BackgroundTransparency = 1
        row.LayoutOrder = lineIdx

        local xPos = 4
        for _, tok in ipairs(lineToks) do
            local colorKey = SyntaxService.getTokenColorKey(tok.type)
            local color = _theme and _theme[colorKey] or _theme.TEXT
            local lbl = Components.label(row, tok.text, 11, Enum.Font.Code,
                UDim2.new(0, 0, 1, 0), UDim2.new(0, xPos, 0, 0))
            lbl.TextColor3 = color
            lbl.Size = UDim2.new(0, 100, 1, 0)

            local textService = game:GetService("TextService")
            local size = textService:GetTextSize(tok.text, 11, Enum.Font.Code, Vector2.new(9999, 9999))
            lbl.Size = UDim2.new(0, size.X + 2, 1, 0)

            xPos = xPos + size.X + 2
        end
    end

    _lineNumbers.CanvasSize = UDim2.new(0, 0, 0, #lines * lineHeight)
    _lineNumbers.AutomaticCanvasSize = Enum.AutomaticSize.None
end

function EditorWidget.switchToTab(index)
    if index < 1 or index > #_tabs then return end

    -- Deactivate old
    if _activeIdx > 0 and _tabs[_activeIdx] and _tabs[_activeIdx].button then
        _tabs[_activeIdx].button.BackgroundColor3 = Color3.new(0, 0, 0)
        _tabs[_activeIdx].button.TextColor3 = _theme.SUBTEXT
        _tabs[_activeIdx].button.BackgroundTransparency = 1
    end

    _activeIdx = index

    -- Activate new
    local tab = _tabs[index]
    tab.button.BackgroundColor3 = _theme.PANEL
    tab.button.TextColor3 = _theme.TEXT
    tab.button.BackgroundTransparency = 0

    -- Render content
    renderEditorContent(tab)
    updateStatusCenter("Ln 1, Col 1")

    -- Update state store
    if _stateStore then
        _stateStore:set("activeScript", tab.instance)
        _stateStore:set("activeSource", tab.source)
    end
end

-- ── Editor content rendering ───────────────────────────────────────────────────

local function clearContainer(parent)
    for _, child in ipairs(parent:GetChildren()) do
        if child:IsA("GuiObject") then
            child:Destroy()
        end
    end
end

    _lineNumbers.CanvasSize = UDim2.new(0, 0, 0, #lines * lineHeight)
    _lineNumbers.AutomaticCanvasSize = Enum.AutomaticSize.None
end

-- ── Status bar ─────────────────────────────────────────────────────────────────

local function updateStatusLeft(text, color)
    if not _statusLeft then return end
    _statusLeft.Text = text
    _statusLeft.TextColor3 = color or (_theme and _theme.SUBTEXT) or Color3.new()
end

local function updateStatusCenter(text)
    if not _statusCenter then return end
    _statusCenter.Text = text
end

local function updateStatusRight(text, color)
    if not _statusRight then return end
    _statusRight.Text = text
    _statusRight.TextColor3 = color or (_theme and _theme.ACCENT) or Color3.new()
end

-- Blinking cursor for agent processing
local function startBlink()
    if _blinkTimer then return end
    _blinkVisible = true
    _blinkTimer = task.spawn(function()
        while true do
            task.wait(0.5)
            _blinkVisible = not _blinkVisible
            if _blinkVisible then
                updateStatusRight("_", _theme and _theme.ACCENT)
            else
                updateStatusRight("", _theme and _theme.ACCENT)
            end
        end
    end)
end

local function stopBlink()
    if _blinkTimer then
        _blinkTimer = nil
    end
    updateStatusRight("")
end

-- ── Connection status ──────────────────────────────────────────────────────────

local function onConnectionStateChanged(state)
    if state == "connected" then
        updateStatusLeft("IDLE", _theme and _theme.SUBTEXT)
    elseif state == "disconnected" then
        updateStatusLeft("ERR", _theme and _theme.RED)
        stopBlink()
    elseif state == "error" then
        updateStatusLeft("ERR", _theme and _theme.RED)
        stopBlink()
    end
end

local function onAgentProcessing(processing)
    if processing then
        updateStatusLeft("THINKING", _theme and _theme.YELLOW)
        startBlink()
    else
        updateStatusLeft("IDLE", _theme and _theme.SUBTEXT)
        stopBlink()
    end
end

-- ── Suggestion handling ────────────────────────────────────────────────────────

local function onSuggestionReceived(suggestion)
    if _eventBus then
        _eventBus.emit("suggestionReceived", suggestion)
    end
end

-- ── Public API ─────────────────────────────────────────────────────────────────

function EditorWidget.init(dockWidget, editorService, theme, eventBus, stateStore, agentService, historyService, diffService, scriptWriter, settingsPanel)
    _widget = dockWidget
    _editorService = editorService
    _theme = theme
    _eventBus = eventBus
    _stateStore = stateStore
    _agentService = agentService
    _historyService = historyService
    _diffService = diffService
    _scriptWriter = scriptWriter
    _settingsPanel = settingsPanel

    -- Root
    _root = Components.frame(_widget, UDim2.fromScale(1, 1), nil, "RoAgentRoot")

    -- Tab Bar: 28px
    _tabBar = Components.frame(_root, UDim2.new(1, 0, 0, 28), nil, "TabBar")
    themeFrame(_tabBar, "SIDEBAR")
    Components.hlist(_tabBar, 0, 4)

    -- Toolbar: 32px
    _toolbar = Components.frame(_root, UDim2.new(1, 0, 0, 32), UDim2.new(0, 0, 0, 28), "Toolbar")
    themeFrame(_toolbar, "PANEL")
    Components.stroke(_toolbar, theme and theme.BORDER or Color3.new(), 1)
    _toolbar.BorderSizePixel = 0

    -- Toolbar buttons
    local toolPad = Components.pad(_toolbar, 4)
    local toolList = Components.hlist(toolPad, 4)

    local saveBtn = Components.button(toolPad, "SAVE", UDim2.new(0, 60, 0, 24), nil, "SaveBtn")
    themeFrame(saveBtn, "GREEN")
    themeText(saveBtn, "TEXT")
    saveBtn.Font = Enum.Font.GothamSemibold
    saveBtn.TextSize = 10
    saveBtn.MouseButton1Click:Connect(function()
        local tab = EditorWidget.getActiveTab()
        if tab and _scriptWriter and tab.instance then
            _scriptWriter.writeScript(tab.instance, tab.source)
            updateStatusCenter("SAVED")
            task.delay(2, function() updateStatusCenter("Ln 1, Col 1") end)
        end
    end)

    local connectBtn = Components.button(toolPad, "CONNECT", UDim2.new(0, 72, 0, 24), nil, "ConnectBtn")
    themeFrame(connectBtn, "ACCENT")
    themeText(connectBtn, "TEXT")
    connectBtn.Font = Enum.Font.GothamSemibold
    connectBtn.TextSize = 10
    connectBtn.MouseButton1Click:Connect(function()
        if _agentService then
            if _agentService.isConnected() then
                _agentService.disconnect()
                updateStatusLeft("ERR", _theme and _theme.RED)
            else
                _agentService.connect()
            end
        end
    end)

    local settingsBtn = Components.button(toolPad, "SETTINGS", UDim2.new(0, 72, 0, 24), nil, "SettingsBtn")
    themeFrame(settingsBtn, "PANEL")
    themeText(settingsBtn, "SUBTEXT")
    settingsBtn.Font = Enum.Font.GothamSemibold
    settingsBtn.TextSize = 10
    settingsBtn.MouseButton1Click:Connect(function()
        if _settingsPanel then _settingsPanel.show() end
    end)

    -- Main area
    _mainArea = Components.frame(_root, UDim2.new(1, 0, 1, -82), UDim2.new(0, 0, 0, 60), "MainArea")
    themeFrame(_mainArea, "BG")

    -- Line gutter: 48px
    _lineGutter = Components.frame(_mainArea, UDim2.new(0, 48, 1, 0), nil, "LineGutter")
    themeFrame(_lineGutter, "PANEL")
    Components.stroke(_lineGutter, theme and theme.BORDER or Color3.new(), 1)
    _lineGutter.BorderSizePixel = 0

    _lineNumbers = Components.scroll(_lineGutter, UDim2.fromScale(1, 1), nil, "LineNumbers")
    _lineNumbers.ScrollBarThickness = 0
    _lineNumbers.BackgroundColor3 = theme and theme.PANEL or Color3.new()
    _lineNumbers.BackgroundTransparency = 0

    -- Editor viewport
    _editorViewport = Components.frame(_mainArea, UDim2.new(1, -48, 1, 0), UDim2.new(0, 48, 0, 0), "EditorViewport")
    themeFrame(_editorViewport, "BG")

    _editorContent = Components.scroll(_editorViewport, UDim2.fromScale(1, 1), nil, "EditorContent")
    _editorContent.BackgroundTransparency = 1
    _editorContent.ScrollBarThickness = 6
    _editorContent.ScrollBarImageColor3 = theme and (theme.SCROLL_BAR or theme.BORDER) or Color3.new()

    -- Sync scrolling
    _lineNumbers:GetPropertyChangedSignal("CanvasPosition"):Connect(function()
        _editorContent.CanvasPosition = Vector2.new(0, _lineNumbers.CanvasPosition.Y)
    end)
    _editorContent:GetPropertyChangedSignal("CanvasPosition"):Connect(function()
        _lineNumbers.CanvasPosition = Vector2.new(0, _editorContent.CanvasPosition.Y)
    end)

    -- Status bar: 22px
    _statusBar = Components.frame(_root, UDim2.new(1, 0, 0, 22), UDim2.new(0, 0, 1, -22), "StatusBar")
    themeFrame(_statusBar, "PANEL")
    Components.stroke(_statusBar, theme and theme.BORDER or Color3.new(), 1)
    _statusBar.BorderSizePixel = 0

    _statusLeft = Components.label(_statusBar, "IDLE", 10, Enum.Font.GothamSemibold,
        UDim2.new(0, 4, 0, 0), nil, Enum.TextXAlignment.Left)
    _statusLeft.Size = UDim2.new(0, 80, 1, 0)
    themeText(_statusLeft, "SUBTEXT")

    _statusCenter = Components.label(_statusBar, "Ln 1, Col 1", 10, Enum.Font.Gotham,
        UDim2.new(0, 84, 0, 0), nil, Enum.TextXAlignment.Left)
    _statusCenter.Size = UDim2.new(1, -164, 1, 0)
    themeText(_statusCenter, "SUBTEXT")

    _statusRight = Components.label(_statusBar, "", 10, Enum.Font.Code,
        UDim2.new(1, -84, 0, 0), nil, Enum.TextXAlignment.Right)
    _statusRight.Size = UDim2.new(0, 80, 1, 0)
    themeText(_statusRight, "ACCENT")

    -- Wire events
    if _eventBus then
        _eventBus.on("connectionStateChanged", onConnectionStateChanged)
        _eventBus.on("suggestionReceived", onSuggestionReceived)
    end

    if _stateStore then
        _stateStore.subscribe("agentProcessing", onAgentProcessing)
    end

    -- Initial connection state
    if _agentService and _agentService.isConnected() then
        updateStatusLeft("IDLE", _theme.SUBTEXT)
    else
        updateStatusLeft("ERR", _theme.RED)
    end

    return EditorWidget
end

function EditorWidget.applyTheme(theme)
    _theme = theme
    themeAll(theme)
end

function EditorWidget.newTab(scriptData)
    local instance = scriptData.instance
    local source = scriptData.source or ""

    local tab = {
        instance = instance,
        source = source,
        modified = false,
        button = nil,
    }

    table.insert(_tabs, tab)
    local idx = #_tabs

    tab.button = createTabButton(instance.Name or "Script", idx)

    -- Switch to new tab
    EditorWidget.switchToTab(idx)

    return tab
end

function EditorWidget.getActiveTab()
    if _activeIdx < 1 or _activeIdx > #_tabs then return nil end
    return _tabs[_activeIdx]
end

function EditorWidget.getActiveTabIndex()
    return _activeIdx
end

function EditorWidget.getEditorViewport()
    return _editorViewport
end

function EditorWidget.getRoot()
    return _root
end

function EditorWidget.getStatusBar()
    return _statusBar
end

function EditorWidget.updateCursorPosition(line, col)
    updateStatusCenter("Ln " .. tostring(line) .. ", Col " .. tostring(col))
end

function EditorWidget.destroy()
    if _blinkTimer then
        _blinkTimer = nil
    end
    _tabs = {}
    _activeIdx = 0
end

return EditorWidget
