--[[
    EventBus — Pub/sub event system for RoAgent v3
    Modules communicate through events. No direct cross-module calls.
]]

local EventBus = {
    _listeners = {},  -- { [event] = {cb1, cb2, ...} }
}

function EventBus.on(event, callback)
    if not EventBus._listeners[event] then
        EventBus._listeners[event] = {}
    end
    table.insert(EventBus._listeners[event], callback)
    -- Return unsubscribe function
    return function()
        EventBus.off(event, callback)
    end
end

function EventBus.off(event, callback)
    local list = EventBus._listeners[event]
    if not list then return end
    for i = #list, 1, -1 do
        if list[i] == callback then
            table.remove(list, i)
        end
    end
    if #list == 0 then
        EventBus._listeners[event] = nil
    end
end

function EventBus.emit(event, ...)
    local list = EventBus._listeners[event]
    if not list then return end
    -- Copy the list in case a listener modifies it during iteration
    local copy = {}
    for i, cb in ipairs(list) do
        copy[i] = cb
    end
    for _, cb in ipairs(copy) do
        local ok, err = pcall(cb, ...)
        if not ok then
            warn("[EventBus] Error in listener for '" .. event .. "':", err)
        end
    end
end

function EventBus.clear()
    EventBus._listeners = {}
end

return EventBus
