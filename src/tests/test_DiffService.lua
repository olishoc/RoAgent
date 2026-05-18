--[[
    Tests for DiffService
]]

local DiffService = require("Services.DiffService")

local tests = {}

function tests.test_computeDiff_additions()
    local original = "line1\nline2\nline3"
    local suggested = "line1\nline2\nline3\nline4"
    local diff = DiffService.computeDiff(original, suggested)
    assert(#diff.additions >= 1, "expected at least 1 addition")
    local found = false
    for _, a in ipairs(diff.additions) do
        if a == "line4" then found = true end
    end
    assert(found, "addition 'line4' not found")
end

function tests.test_computeDiff_removals()
    local original = "line1\nline2\nline3"
    local suggested = "line1\nline3"
    local diff = DiffService.computeDiff(original, suggested)
    assert(#diff.removals >= 1, "expected at least 1 removal")
    local found = false
    for _, r in ipairs(diff.removals) do
        if r == "line2" then found = true end
    end
    assert(found, "removal 'line2' not found")
end

function tests.test_computeDiff_context()
    local original = "keep1\nremove\nkeep2"
    local suggested = "keep1\nkeep2"
    local diff = DiffService.computeDiff(original, suggested)
    assert(#diff.context >= 1, "expected context lines")
end

function tests.test_formatDiff()
    local diff = {
        additions = {"new line"},
        removals = {"old line"},
        context = {"unchanged"},
    }
    local lines = DiffService.formatDiff(diff)
    assert(#lines == 3, "expected 3 formatted lines, got " .. #lines)
    assert(lines[1].type == "del", "first should be del")
    assert(lines[2].type == "add", "second should be add")
    assert(lines[3].type == "context", "third should be context")
end

function tests.test_applyDiff()
    local source = "line1\nline2\nline3"
    local diff = {
        targetLine = 2,
        additions = {"new2"},
        removals = {"line2"},
        context = {},
    }
    local result = DiffService.applyDiff(source, diff)
    assert(string.find(result, "new2") ~= nil, "addition not applied")
    assert(string.find(result, "line2") == nil, "removal not applied")
end

function tests.test_revertDiff()
    local source = "line1\nnew2\nline3"
    local diff = {
        targetLine = 2,
        additions = {"new2"},
        removals = {"line2"},
        context = {},
    }
    local result = DiffService.revertDiff(source, diff)
    assert(string.find(result, "line2") ~= nil, "revert did not restore removed line")
    assert(string.find(result, "new2") == nil, "revert did not remove added line")
end

function tests.test_empty_diff()
    local source = "line1\nline2"
    local diff = {
        targetLine = 1,
        additions = {},
        removals = {},
        context = {"line1", "line2"},
    }
    local result = DiffService.applyDiff(source, diff)
    assert(result == source, "empty diff should not change source")
end

function tests.test_multi_line_diff()
    local source = "a\nb\nc\nd"
    local suggested = "a\nx\ny\nd"
    local diff = DiffService.computeDiff(source, suggested)
    assert(#diff.removals >= 1, "expected removals in multi-line diff")
    assert(#diff.additions >= 1, "expected additions in multi-line diff")
end

return tests
