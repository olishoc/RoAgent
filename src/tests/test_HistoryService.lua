--[[
    Tests for HistoryService
]]

local HistoryService = require("Services.HistoryService")

local tests = {}

function tests.test_push_adds_version()
    HistoryService.init()
    HistoryService.push("ServerScriptService.Test", "local x = 1", "initial")
    local history = HistoryService.getHistory("ServerScriptService.Test")
    assert(#history == 1, "expected 1 version, got " .. #history)
end

function tests.test_getHistory_returns_list()
    HistoryService.init()
    HistoryService.push("test.path", "v1", "first")
    HistoryService.push("test.path", "v2", "second")
    local history = HistoryService.getHistory("test.path")
    assert(#history == 2, "expected 2 versions, got " .. #history)
end

function tests.test_getVersion_by_index()
    HistoryService.init()
    HistoryService.push("test.path", "v1", "first")
    HistoryService.push("test.path", "v2", "second")
    local v = HistoryService.getVersion("test.path", 2)
    assert(v ~= nil, "version 2 is nil")
    assert(v.source == "v2", "wrong source: " .. tostring(v.source))
    assert(v.label == "second", "wrong label: " .. tostring(v.label))
end

function tests.test_revertTo_returns_source()
    HistoryService.init()
    HistoryService.push("test.path", "original", "init")
    HistoryService.push("test.path", "modified", "change")
    local reverted = HistoryService.revertTo("test.path", 1)
    assert(reverted == "original", "revertTo returned wrong source: " .. tostring(reverted))
end

function tests.test_max_20_versions()
    HistoryService.init()
    for i = 1, 25 do
        HistoryService.push("test.path", "v" .. i, "edit " .. i)
    end
    local history = HistoryService.getHistory("test.path")
    assert(#history == 20, "expected 20 versions, got " .. #history)
    -- Oldest should be v6 (first 5 dropped)
    local oldest = history[1]
    assert(oldest.source == "v6", "oldest should be v6, got " .. tostring(oldest.source))
end

function tests.test_clear_removes_all()
    HistoryService.init()
    HistoryService.push("test.path", "v1", "first")
    HistoryService.push("test.path", "v2", "second")
    HistoryService.clear("test.path")
    local history = HistoryService.getHistory("test.path")
    assert(#history == 0, "expected 0 versions after clear, got " .. #history)
end

function tests.test_latest_returns_most_recent()
    HistoryService.init()
    HistoryService.push("test.path", "v1", "first")
    HistoryService.push("test.path", "v2", "second")
    local latest = HistoryService.getLatest("test.path")
    assert(latest ~= nil, "latest is nil")
    assert(latest.source == "v2", "latest should be v2, got " .. tostring(latest.source))
end

function tests.test_latest_empty_returns_nil()
    HistoryService.init()
    local latest = HistoryService.getLatest("nonexistent")
    assert(latest == nil, "expected nil for nonexistent path")
end

function tests.test_getVersion_invalid_index()
    HistoryService.init()
    HistoryService.push("test.path", "v1", "first")
    local v = HistoryService.getVersion("test.path", 99)
    assert(v == nil, "expected nil for invalid index")
end

return tests
