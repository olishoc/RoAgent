--[[
    Tests for StateStore
]]

local EventBus = require("Services.EventBus")
local StateStore = require("Services.StateStore")

local tests = {}

function tests.test_get_returns_default()
    EventBus.clear()
    StateStore.init(EventBus)
    local val = StateStore.get("connected")
    assert(val == false, "expected false, got " .. tostring(val))
end

function tests.test_set_updates_value()
    EventBus.clear()
    StateStore.init(EventBus)
    StateStore.set("connected", true)
    assert(StateStore.get("connected") == true, "value not updated")
end

function tests.test_set_fires_notification()
    EventBus.clear()
    StateStore.init(EventBus)
    local changed = false
    local receivedValue
    EventBus.on("stateChanged", function(key, value)
        if key == "connected" then
            changed = true
            receivedValue = value
        end
    end)
    StateStore.set("connected", true)
    assert(changed, "stateChanged event not fired")
    assert(receivedValue == true, "wrong value in event")
end

function tests.test_set_skips_notification_for_same_value()
    EventBus.clear()
    StateStore.init(EventBus)
    StateStore.set("connected", true)
    local count = 0
    EventBus.on("stateChanged", function() count = count + 1 end)
    StateStore.set("connected", true)  -- Same value
    assert(count == 0, "notification fired for same value")
end

function tests.test_getAll_returns_copy()
    EventBus.clear()
    StateStore.init(EventBus)
    local all = StateStore.getAll()
    all.connected = "modified"
    assert(StateStore.get("connected") == false, "getAll did not return a copy")
end

function tests.test_subscribe_to_key()
    EventBus.clear()
    StateStore.init(EventBus)
    local notified = false
    StateStore.subscribe("cursorLine", function(val)
        notified = true
    end)
    StateStore.set("cursorLine", 5)
    assert(notified, "subscriber not notified")
end

function tests.test_subscribe_only_fires_for_subscribed_key()
    EventBus.clear()
    StateStore.init(EventBus)
    local notified = false
    StateStore.subscribe("cursorLine", function() notified = true end)
    StateStore.set("connected", true)
    assert(notified == false, "subscriber fired for wrong key")
end

return tests
