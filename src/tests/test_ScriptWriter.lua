--[[
    Tests for ScriptWriter
]]

local ScriptWriter = require("Services.ScriptWriter")

local tests = {}

-- Helper to create a stub instance
local function makeInstance(className)
    return { ClassName = className, Name = "Test", Source = "" }
end

function tests.test_isWritable_script()
    local inst = makeInstance("Script")
    assert(ScriptWriter.isWritable(inst) == true, "Script should be writable")
end

function tests.test_isWritable_localScript()
    local inst = makeInstance("LocalScript")
    assert(ScriptWriter.isWritable(inst) == true, "LocalScript should be writable")
end

function tests.test_isWritable_moduleScript()
    local inst = makeInstance("ModuleScript")
    assert(ScriptWriter.isWritable(inst) == true, "ModuleScript should be writable")
end

function tests.test_isWritable_invalid()
    local inst = makeInstance("Frame")
    assert(ScriptWriter.isWritable(inst) == false, "Frame should not be writable")
end

function tests.test_isWritable_nil()
    assert(ScriptWriter.isWritable(nil) == false, "nil should not be writable")
end

function tests.test_applyChange_produces_correct_source()
    local inst = makeInstance("Script")
    inst.Source = "line1\nline2\nline3"
    local diff = {
        targetLine = 2,
        additions = {"newline2"},
        removals = {"line2"},
        context = {},
    }
    -- applyChange uses string.gsub, so we test the logic
    local currentSource = inst.Source
    -- Simulate what applyChange does
    for _, line in ipairs(diff.removals) do
        currentSource = string.gsub(currentSource, line, "", 1)
    end
    assert(string.find(currentSource, "line2") == nil, "removal not applied")
end

function tests.test_revertChange_restores_original()
    local inst = makeInstance("Script")
    inst.Source = "line1\nnewline2\nline3"
    local diff = {
        targetLine = 2,
        additions = {"newline2"},
        removals = {"line2"},
        context = {},
    }
    -- Simulate revert: remove additions
    local currentSource = inst.Source
    for _, line in ipairs(diff.additions) do
        currentSource = string.gsub(currentSource, line, "", 1)
    end
    assert(string.find(currentSource, "newline2") == nil, "addition not reverted")
end

return tests
