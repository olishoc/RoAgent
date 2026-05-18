--[[
    SuggestionPopup — Inline suggestion popup for RoAgent v3
    Shows diff, explanation, APPLY and DISMISS buttons.
    Queues suggestions if one is already visible.
]]

local SuggestionPopup = {}

local Components = require(script.Parent.Components)

local _parent = nil
local _theme = nil
local _eventBus = nil
local _stateStore = nil
local _agentService = nil
local _historyService = nil
local _diffService = nil
local _scriptWriter = nil
local _editorWidget = nil

local _popupFrame = nil
local _diffFrame = nil
local _explanationLabel = nil
local _applyBtn = nil
local _dismissBtn = nil

local _visible = false
local _currentSuggestion = nil
local _queue = {}
local _maxQueueDepth = 5

-- ── Diff rendering ─────────────────────────────────────────────────────────────

local function renderDiff(diff)
    -- Clear previous
    for _, child in ipairs(_diffFrame:GetChildren()) do
        if child:IsA("Frame") or child:IsA("TextLabel") then
            child:Destroy()
        end
    end

    local lineHeight = 14
    local layout = Components.vlist(_diffFrame, 0)

    -- Render removals first, then additions, then context
    local function addLine(text, lineType)
        local row = Components.frame(_diffFrame, UDim2.new(1, 0, 0, lineHeight), nil, nil)
        local bgColor
        local textColor
        local indicator

        if lineType == "del" then
            bgColor = _theme.DIFF_DEL_LINE
            textColor = _theme.RED
            indicator = "-"
        elseif lineType == "add" then
            bgColor = _theme.DIFF_ADD_LINE
            textColor = _theme.GREEN
            indicator = "+"
        else
            bgColor = _theme.BG
            textColor = _theme.SUBTEXT
            indicator = " "
        end

        row.BackgroundColor3 = bgColor

        local indLabel = Components.label(row, indicator, 10, Enum.Font.Code,
            UDim2.new(0, 0, 0, 0), nil, Enum.TextXAlignment.Left)
        indLabel.Size = UDim2.new(0, 16, 1, 0)
        indLabel.TextColor3 = textColor

        local textLabel = Components.label(row, text, 10, Enum.Font.Code,
            UDim2.new(0, 16, 0, 0), nil, Enum.TextXAlignment.Left)
        textLabel.Size = UDim2.new(1, -16, 1, 0)
        textLabel.TextColor3 = textColor
        textLabel.TextXAlignment = Enum.TextXAlignment.Left
    end

    if diff.removals then
        for _, line in ipairs(diff.removals) do
            addLine(line, "del")
        end
    end
    if diff.additions then
        for _, line in ipairs(diff.additions) do
            addLine(line, "add")
        end
    end
    if diff.context then
        for _, line in ipairs(diff.context) do
            addLine(line, "context")
        end
    end
end

-- ── Show/hide ──────────────────────────────────────────────────────────────────

local function showNext()
    if #_queue == 0 then
        _visible = false
        _currentSuggestion = nil
        if _popupFrame then
            _popupFrame.Visible = false
        end
        return
    end

    local suggestion = table.remove(_queue, 1)
    _currentSuggestion = suggestion
    _visible = true

    -- Render diff
    renderDiff(suggestion)

    -- Set explanation
    if _explanationLabel then
        _explanationLabel.Text = suggestion.explanation or ""
    end

    -- Show popup
    if _popupFrame then
        _popupFrame.Visible = true
    end
end

-- ── Button handlers ────────────────────────────────────────────────────────────

local function onApply()
    if not _currentSuggestion then return end

    local tab = _editorWidget and _editorWidget.getActiveTab()
    if not tab then return end

    local instance = tab.instance
    local currentSource = tab.source
    local diff = _currentSuggestion

    -- Apply the diff
    if _diffService then
        local newSource = _diffService.applyDiff(currentSource, diff)
        if _scriptWriter then
            _scriptWriter.writeScript(instance, newSource)
        end
        tab.source = newSource

        -- Record in history
        if _historyService then
            local label = "agent: " .. (diff.explanation or "change"):sub(1, 40)
            _historyService.push(instance:GetFullName(), newSource, label, diff)
        end

        -- Fire event
        if _eventBus then
            _eventBus.emit("suggestionApplied", diff)
            _eventBus.emit("scriptChanged", instance, newSource)
        end

        -- Re-render
        if _editorWidget then
            _editorWidget.switchToTab(_editorWidget.getActiveTabIndex())
        end
    end

    -- Show next in queue
    showNext()
end

local function onDismiss()
    if _eventBus and _currentSuggestion then
        _eventBus.emit("suggestionDismissed", _currentSuggestion)
    end
    _currentSuggestion = nil
    showNext()
end

-- ── Public API ─────────────────────────────────────────────────────────────────

function SuggestionPopup.init(parent, theme, eventBus, stateStore, agentService, historyService, diffService, scriptWriter, editorWidget)
    _parent = parent
    _theme = theme
    _eventBus = eventBus
    _stateStore = stateStore
    _agentService = agentService
    _historyService = historyService
    _diffService = diffService
    _scriptWriter = scriptWriter
    _editorWidget = editorWidget

    -- Popup container (hidden by default)
    _popupFrame = Components.frame(parent, UDim2.new(1, -16, 0, 200),
        UDim2.new(0, 8, 0, 40), "SuggestionPopup")
    _popupFrame.BackgroundColor3 = theme.PANEL
    _popupFrame.BackgroundTransparency = 0
    Components.stroke(_popupFrame, theme.BORDER, 1)
    Components.corner(_popupFrame, 2)
    _popupFrame.Visible = false
    _popupFrame.ZIndex = 10

    -- Diff section
    _diffFrame = Components.frame(_popupFrame, UDim2.new(1, -16, 1, -60),
        UDim2.new(0, 8, 0, 8), "DiffSection")
    _diffFrame.BackgroundColor3 = theme.BG
    _diffFrame.BackgroundTransparency = 0
    Components.corner(_diffFrame, 2)
    _diffFrame.ClipsDescendants = true

    -- Explanation
    _explanationLabel = Components.label(_popupFrame, "", 10, Enum.Font.Gotham,
        UDim2.new(0, 8, 1, -44), nil, Enum.TextXAlignment.Left)
    _explanationLabel.Size = UDim2.new(1, -16, 0, 20)
    _explanationLabel.TextColor3 = theme.SUBTEXT
    _explanationLabel.TextWrapped = true
    _explanationLabel.ZIndex = 11

    -- Buttons
    _dismissBtn = Components.button(_popupFrame, "DISMISS",
        UDim2.new(0, 60, 0, 20), UDim2.new(1, -136, 1, -28), "DismissBtn")
    _dismissBtn.BackgroundColor3 = theme.PANEL
    _dismissBtn.TextColor3 = theme.SUBTEXT
    _dismissBtn.Font = Enum.Font.GothamSemibold
    _dismissBtn.TextSize = 10
    _dismissBtn.ZIndex = 11

    _applyBtn = Components.button(_popupFrame, "APPLY",
        UDim2.new(0, 60, 0, 20), UDim2.new(1, -72, 1, -28), "ApplyBtn")
    _applyBtn.BackgroundColor3 = theme.GREEN
    _applyBtn.TextColor3 = theme.TEXT
    _applyBtn.Font = Enum.Font.GothamSemibold
    _applyBtn.TextSize = 10
    _applyBtn.ZIndex = 11

    -- Button events
    _applyBtn.MouseButton1Click:Connect(onApply)
    _dismissBtn.MouseButton1Click:Connect(onDismiss)

    -- Listen for suggestions
    if _eventBus then
        _eventBus.on("suggestionReceived", function(suggestion)
            SuggestionPopup.enqueue(suggestion)
        end)
    end

    return SuggestionPopup
end

function SuggestionPopup.enqueue(suggestion)
    if #_queue >= _maxQueueDepth then
        table.remove(_queue, 1)  -- Drop oldest
    end
    table.insert(_queue, suggestion)

    if not _visible then
        showNext()
    end
    -- Otherwise it will appear when current popup is resolved
end

function SuggestionPopup.show(suggestion, anchorY)
    if anchorY and _popupFrame then
        _popupFrame.Position = UDim2.new(0, 8, 0, anchorY)
    end
    SuggestionPopup.enqueue(suggestion)
end

function SuggestionPopup.hide()
    _visible = false
    _currentSuggestion = nil
    if _popupFrame then
        _popupFrame.Visible = false
    end
end

function SuggestionPopup.isVisible()
    return _visible
end

function SuggestionPopup.setQueueDepth(max)
    _maxQueueDepth = max
end

function SuggestionPopup.applyTheme(theme)
    _theme = theme
    if not _popupFrame then return end
    _popupFrame.BackgroundColor3 = theme.PANEL
    _diffFrame.BackgroundColor3 = theme.BG
    _explanationLabel.TextColor3 = theme.SUBTEXT
    _applyBtn.BackgroundColor3 = theme.GREEN
    _applyBtn.TextColor3 = theme.TEXT
    _dismissBtn.BackgroundColor3 = theme.PANEL
    _dismissBtn.TextColor3 = theme.SUBTEXT

    if _visible and _currentSuggestion then
        renderDiff(_currentSuggestion)
    end
end

function SuggestionPopup.destroy()
    _queue = {}
    _visible = false
    _currentSuggestion = nil
end

return SuggestionPopup
