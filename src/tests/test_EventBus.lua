--[[
    Tests for EventBus
]]

local EventBus = require("Services.EventBus")

local tests = {}

function tests.test_on_fires_listener()
    EventBus.clear()
    local fired = false
    EventBus.on("test", function() fired = true end)
    EventBus.emit("test")
    assert(fired, "listener was not fired")
end

function tests.test_off_removes_listener()
    EventBus.clear()
    local count = 0
    local cb = function() count = count + 1 end
    EventBus.on("test", cb)
    EventBus.off("test", cb)
    EventBus.emit("test")
    assert(count == 0, "listener was not removed")
end

function tests.test_emit_passes_arguments()
    EventBus.clear()
    local receivedA, receivedB
    EventBus.on("test", function(a, b)
        receivedA = a
        receivedB = b
    end)
    EventBus.emit("test", 42, "hello")
    assert(receivedA == 42, "first argument not passed")
    assert(receivedB == "hello", "second argument not passed")
end

function tests.test_clear_removes_all_listeners()
    EventBus.clear()
    local count = 0
    EventBus.on("a", function() count = count + 1 end)
    EventBus.on("b", function() count = count + 1 end)
    EventBus.clear()
    EventBus.emit("a")
    EventBus.emit("b")
    assert(count == 0, "listeners not cleared")
end

function tests.test_multiple_listeners()
    EventBus.clear()
    local count = 0
    EventBus.on("test", function() count = count + 1 end)
    EventBus.on("test", function() count = count + 1 end)
    EventBus.on("test", function() count = count + 1 end)
    EventBus.emit("test")
    assert(count == 3, "expected 3 listeners, got " .. count)
end

function tests.test_unsubscribe_function()
    EventBus.clear()
    local count = 0
    local unsubscribe = EventBus.on("test", function() count = count + 1 end)
    EventBus.emit("test")
    assert(count == 1, "listener not fired")
    unsubscribe()
    EventBus.emit("test")
    assert(count == 1, "listener not unsubscribed")
end

function tests.test_emit_no_listeners_no_error()
    EventBus.clear()
    -- Should not error
    EventBus.emit("nonexistent", 1, 2, 3)
end

return tests
