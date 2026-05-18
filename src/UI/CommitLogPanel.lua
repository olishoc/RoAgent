--[[
    CommitLogPanel — Collapsible commit log for RoAgent v3
    Shows applied suggestions with timestamp, label, and revert capability.
]]

local CommitLogPanel = {}

local Components = require(script.Parent.Components)

local _parent = nil
local _theme = nil
local _eventBus = nil
local _historyService = nil
local _editorWidget = nil
local _scriptWriter = nil
local _diffService = nil

local _panelFrame = nil
local _headerFrame = nil
local _toggleBtn = nil
local _entryList = nil
local _entries = {}  -- { timestamp, label, diff }

local _expanded = false
local _collapsedHeight = 28
local _expandedHeight = 200

-- ── Entry rendering ────────────────────────────────────────────────────────────

local function formatTimestamp(ts)
    if not ts then return "00:00" end
    local mins = math.floor(ts / 60)
    local secs = math.floor(ts % 60)
    return string.format("%02d:%02d", mins, secs)
end

local function renderEntries()
    if not _entryList then return end

    for _, child in ipairs(_entryList:GetChildren()) do
        if child:IsA("GuiObject") then
            child:Destroy()
        end
    end

    for i, entry in ipairs(_entries) do
        local row = Components.frame(_entryList, UDim2.new(1, 0, 0, 24), nil, "Entry_" .. i)
        row.BackgroundTransparency = 1
        row.LayoutOrder = i

        local ts = Components.label(row, formatTimestamp(entry.timestamp), 9, Enum.Font.Code,
            nil, nil, Enum.TextXAlignment.Left)
        ts.Size = UDim2.new(0, 60, 1, 0)
        ts.TextColor3 = _theme.SUBTEXT

        local lbl = Components.label(row, entry.label or "edit", 10, Enum.Font.Gotham,
            nil, nil, Enum.TextXAlignment.Left)
        lbl.Size = UDim2.new(1, -110, 1, 0)
        lbl.TextColor3 = _theme.TEXT

        local revertBtn = Components.button(row, "REVERT", UDim2.new(0, 48, 0, 18), nil, "Revert_" .. i)
        revertBtn.BackgroundColor3 = _theme.PANEL
        revertBtn.TextColor3 = _theme.RED
        revertBtn.Font = Enum.Font.GothamSemibold
        revertBtn.TextSize = 9
        revertBtn.Visible = false

        -- Hover to show revert
        row.MouseEnter:Connect(function()
            row.BackgroundColor3 = _theme.PANEL
            row.BackgroundTransparency = 0
            revertBtn.Visible = true
        end)
        row.MouseLeave:Connect(function()
            row.BackgroundTransparency = 1
            revertBtn.Visible = false
        end)

        -- Revert handler
        revertBtn.MouseButton1Click:Connect(function()
            if not entry.diff then return end
            local tab = _editorWidget and _editorWidget.getActiveTab()
            if not tab then return end

            local instance = tab.instance
            local currentSource = tab.source

            if _diffService then
                local revertedSource = _diffService.revertDiff(currentSource, entry.diff)
                if _scriptWriter then
                    _scriptWriter.writeScript(instance, revertedSource)
                end
                tab.source = revertedSource

                if _eventBus then
                    _eventBus.emit("historyReverted", entry)
                    _eventBus.emit("scriptChanged", instance, revertedSource)
                end

                if _editorWidget then
                    _editorWidget.switchToTab(_editorWidget.getActiveTabIndex())
                end
            end
        end)
    end
end

-- ── Toggle ─────────────────────────────────────────────────────────────────────

local function toggle()
    _expanded = not _expanded
    if not _panelFrame then return end

    if _expanded then
        _panelFrame.Size = UDim2.new(1, 0, 0, _expandedHeight)
        if _toggleBtn then _toggleBtn.Text = "^" end
    else
        _panelFrame.Size = UDim2.new(1, 0, 0, _collapsedHeight)
        if _toggleBtn then _toggleBtn.Text = "v" end
    end
end

-- ── Public API ─────────────────────────────────────────────────────────────────

function CommitLogPanel.init(parent, theme, eventBus, historyService, editorWidget, scriptWriter, diffService)
    _parent = parent
    _theme = theme
    _eventBus = eventBus
    _historyService = historyService
    _editorWidget = editorWidget
    _scriptWriter = scriptWriter
    _diffService = diffService

    -- Panel frame (collapsed by default)
    _panelFrame = Components.frame(parent, UDim2.new(1, 0, 0, _collapsedHeight),
        UDim2.new(0, 0, 1, -22 - _collapsedHeight), "CommitLogPanel")
    _panelFrame.BackgroundColor3 = theme.SIDEBAR
    _panelFrame.BackgroundTransparency = 0
    Components.stroke(_panelFrame, theme.BORDER, 1)
    _panelFrame.BorderSizePixel = 0

    -- Header
    _headerFrame = Components.frame(_panelFrame, UDim2.new(1, 0, 0, _collapsedHeight), nil, "CommitLogHeader")
    _headerFrame.BackgroundColor3 = theme.PANEL
    _headerFrame.BackgroundTransparency = 0

    local headerLabel = Components.label(_headerFrame, "COMMIT LOG", 10, Enum.Font.GothamSemibold,
        UDim2.new(0, 4, 0, 0), nil, Enum.TextXAlignment.Left)
    headerLabel.Size = UDim2.new(1, -24, 1, 0)
    headerLabel.TextColor3 = theme.SUBTEXT

    _toggleBtn = Components.button(_headerFrame, "v", UDim2.new(0, 20, 0, 20), nil, "ToggleBtn")
    _toggleBtn.BackgroundColor3 = theme.PANEL
    _toggleBtn.TextColor3 = theme.SUBTEXT
    _toggleBtn.Font = Enum.Font.Code
    _toggleBtn.TextSize = 10
    _toggleBtn.Position = UDim2.new(1, -24, 0, 4)

    _toggleBtn.MouseButton1Click:Connect(toggle)
    _headerFrame.InputBegan:Connect(function(input)
        if input.UserInputType == Enum.UserInputType.MouseButton1 then
            toggle()
        end
    end)

    -- Entry list (scrollable, visible when expanded)
    _entryList = Components.scroll(_panelFrame, UDim2.new(1, -8, 1, -36),
        UDim2.new(0, 4, 0, 32), "EntryList")
    _entryList.BackgroundTransparency = 1
    _entryList.ScrollBarThickness = 4
    _entryList.Visible = false

    -- Listen for applied suggestions
    if _eventBus then
        _eventBus.on("suggestionApplied", function(diff)
            CommitLogPanel.addEntry({
                timestamp = os.clock(),
                label = "agent: " .. (diff.explanation or "change"):sub(1, 40),
                diff = diff,
            })
        end)
    end

    return CommitLogPanel
end

function CommitLogPanel.addEntry(entry)
    table.insert(_entries, entry)
    renderEntries()
end

function CommitLogPanel.clear()
    _entries = {}
    renderEntries()
end

function CommitLogPanel.expand()
    if not _expanded then toggle() end
end

function CommitLogPanel.collapse()
    if _expanded then toggle() end
end

function CommitLogPanel.isExpanded()
    return _expanded
end

function CommitLogPanel.applyTheme(theme)
    _theme = theme
    if not _panelFrame then return end
    _panelFrame.BackgroundColor3 = theme.SIDEBAR
    _headerFrame.BackgroundColor3 = theme.PANEL
    renderEntries()
end

function CommitLogPanel.destroy()
    _entries = {}
    _expanded = false
end

return CommitLogPanel
