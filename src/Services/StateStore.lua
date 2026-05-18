--[[
    StateStore — Centralized reactive state for RoAgent v3
    Holds all tracked state. Notifies listeners on change via EventBus.
]]

local StateStore = {
    _state = {},
    _eventBus = nil,
}

local DEFAULTS = {
    connected = false,
    connecting = false,
    activeScript = nil,
    activeSource = "",
    cursorLine = 1,
    cursorColumn = 1,
    suggestionQueue = {},
    activeSuggestion = nil,
    theme = "HighContrast",
    commitLog = {},
    panelVisible = true,
    agentProcessing = false,
}

function StateStore.init(eventBus)
    StateStore._eventBus = eventBus
    for k, v in pairs(DEFAULTS) do
        StateStore._state[k] = v
    end
end

function StateStore.destroy()
    StateStore._state = {}
    StateStore._eventBus = nil
end

function StateStore.get(k)
    return StateStore._state[k]
end

function StateStore.set(k, value)
    local old = StateStore._state[k]
    if old == value then return end
    StateStore._state[k] = value
    if StateStore._eventBus then
        StateStore._eventBus.emit("stateChanged", k, value, old)
    end
end

function StateStore.getAll()
    local copy = {}
    for k, v in pairs(StateStore._state) do
        copy[k] = v
    end
    return copy
end

function StateStore.subscribe(key, callback)
    if not StateStore._eventBus then return end
    return StateStore._eventBus.on("stateChanged", function(changedKey, value)
        if changedKey == key then
            callback(value)
        end
    end)
end

return StateStore
