--[[
    HistoryService — Per-script undo history for RoAgent v3
    Keeps last 20 versions in memory per script path.
]]

local HistoryService = {
    _history = {},  -- { [scriptPath] = { entry1, entry2, ... } }
    MAX_VERSIONS = 20,
}

function HistoryService.init()
    HistoryService._history = {}
end

function HistoryService.destroy()
    HistoryService._history = {}
end

-- Push a new version for a script
-- label: short auto-generated label (e.g. "agent: add nil check")
-- diff: the diff table that was applied (or nil for user edits)
function HistoryService.push(scriptPath, source, label, diff)
    if not HistoryService._history[scriptPath] then
        HistoryService._history[scriptPath] = {}
    end
    local entries = HistoryService._history[scriptPath]
    table.insert(entries, {
        timestamp = os.clock(),
        label = label or "edit",
        source = source,
        diff = diff or nil,
    })
    -- Trim to MAX_VERSIONS
    while #entries > HistoryService.MAX_VERSIONS do
        table.remove(entries, 1)
    end
end

-- Return all versions for a script (oldest first)
function HistoryService.getHistory(scriptPath)
    return HistoryService._history[scriptPath] or {}
end

-- Return a specific version entry (1-based index)
function HistoryService.getVersion(scriptPath, index)
    local entries = HistoryService._history[scriptPath]
    if not entries then return nil end
    return entries[index]
end

-- Return the source at a specific version (for preview/revert)
function HistoryService.revertTo(scriptPath, index)
    local entry = HistoryService.getVersion(scriptPath, index)
    if not entry then return nil end
    return entry.source
end

-- Return the most recent version entry
function HistoryService.getLatest(scriptPath)
    local entries = HistoryService._history[scriptPath]
    if not entries or #entries == 0 then return nil end
    return entries[#entries]
end

-- Remove all history for a script
function HistoryService.clear(scriptPath)
    HistoryService._history[scriptPath] = nil
end

return HistoryService
