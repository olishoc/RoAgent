--[[
    ScriptWriter — Write changes to Studio scripts for RoAgent v3
    Uses ScriptEditorService to apply text edits safely.
]]

local ScriptWriter = {}

local function isScriptInstance(instance)
    if not instance then return false end
    local cls = instance.ClassName
    return cls == "Script" or cls == "LocalScript" or cls == "ModuleScript"
end

-- Check if an instance is a writable script
function ScriptWriter.isWritable(instance)
    return isScriptInstance(instance)
end

-- Replace entire script source
function ScriptWriter.writeScript(instance, newSource)
    if not isScriptInstance(instance) then
        warn("[ScriptWriter] Not a script instance:", instance and instance.ClassName or "nil")
        return false
    end
    local ok, err = pcall(function()
        instance.Source = newSource
    end)
    if not ok then
        warn("[ScriptWriter] Write failed:", err)
        return false
    end
    return true
end

-- Apply a diff change to a script
-- Reads current source, applies diff, writes back
function ScriptWriter.applyChange(instance, diff)
    if not isScriptInstance(instance) then return false end
    local currentSource = instance.Source
    local newSource = currentSource

    -- Apply the diff: remove old lines, insert new lines
    if diff.removals and #diff.removals > 0 then
        for _, line in ipairs(diff.removals) do
            newSource = string.gsub(newSource, line, "", 1)
        end
    end
    if diff.additions and #diff.additions > 0 then
        local additionText = table.concat(diff.additions, "\n")
        if diff.targetLine then
            -- Insert at the target line position
            local lines = {}
            for l in string.gmatch(newSource, "([^\n]*)\n?") do
                table.insert(lines, l)
            end
            table.insert(lines, diff.targetLine, additionText)
            newSource = table.concat(lines, "\n")
        else
            newSource = newSource .. "\n" .. additionText
        end
    end

    return ScriptWriter.writeScript(instance, newSource)
end

-- Revert a diff change from a script
function ScriptWriter.revertChange(instance, diff)
    if not isScriptInstance(instance) then return false end
    local currentSource = instance.Source
    local newSource = currentSource

    -- Reverse: remove additions, restore removals
    if diff.additions and #diff.additions > 0 then
        for _, line in ipairs(diff.additions) do
            newSource = string.gsub(newSource, line, "", 1)
        end
    end
    if diff.removals and #diff.removals > 0 then
        local removalText = table.concat(diff.removals, "\n")
        if diff.targetLine then
            local lines = {}
            for l in string.gmatch(newSource, "([^\n]*)\n?") do
                table.insert(lines, l)
            end
            table.insert(lines, diff.targetLine, removalText)
            newSource = table.concat(lines, "\n")
        else
            newSource = newSource .. "\n" .. removalText
        end
    end

    return ScriptWriter.writeScript(instance, newSource)
end

return ScriptWriter
