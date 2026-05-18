--[[
    DiffService — Diff computation and formatting for RoAgent v3
    Computes line-level diffs between original and suggested source.
]]

local DiffService = {}

-- Split source into lines
local function splitLines(source)
    local lines = {}
    for line in string.gmatch(source, "([^\n]*)\n?") do
        table.insert(lines, line)
    end
    -- Remove trailing empty line if source ends with newline
    if #lines > 0 and lines[#lines] == "" and string.sub(source, -1) == "\n" then
        table.remove(lines)
    end
    return lines
end

-- Compute a simple line-level diff
-- Returns: { targetLine, additions, removals, context, explanation }
function DiffService.computeDiff(original, suggested)
    local origLines = splitLines(original)
    local suggLines = splitLines(suggested)

    local removals = {}
    local additions = {}
    local context = {}

    -- Simple LCS-based diff
    local m, n = #origLines, #suggLines

    -- Build LCS table
    local dp = {}
    for i = 0, m do
        dp[i] = {}
        for j = 0, n do
            dp[i][j] = 0
        end
    end
    for i = 1, m do
        for j = 1, n do
            if origLines[i] == suggLines[j] then
                dp[i][j] = dp[i-1][j-1] + 1
            else
                dp[i][j] = math.max(dp[i-1][j], dp[i][j-1])
            end
        end
    end

    -- Backtrack to find diff
    local i, j = m, n
    local diffRev = {}
    while i > 0 or j > 0 do
        if i > 0 and j > 0 and origLines[i] == suggLines[j] then
            table.insert(diffRev, { type = "same", line = origLines[i] })
            i -= 1
            j -= 1
        elseif j > 0 and (i == 0 or dp[i][j-1] >= dp[i-1][j]) then
            table.insert(diffRev, { type = "add", line = suggLines[j] })
            j -= 1
        else
            table.insert(diffRev, { type = "del", line = origLines[i] })
            i -= 1
        end
    end

    -- Reverse to get correct order
    local diff = {}
    for k = #diffRev, 1, -1 do
        table.insert(diff, diffRev[k])
    end

    -- Extract additions, removals, and context
    local targetLine = 1
    for idx, entry in ipairs(diff) do
        if entry.type == "del" then
            table.insert(removals, entry.line)
            if targetLine == 1 and #additions == 0 then
                targetLine = idx
            end
        elseif entry.type == "add" then
            table.insert(additions, entry.line)
        else
            table.insert(context, entry.line)
        end
    end

    -- If no removals, target line is at the end of original
    if #removals == 0 and #additions > 0 then
        targetLine = #origLines + 1
    end

    return {
        targetLine = targetLine,
        additions = additions,
        removals = removals,
        context = context,
        explanation = "",
    }
end

-- Format a diff for display
-- Returns: { { type = "add"|"del"|"context", text = string }, ... }
function DiffService.formatDiff(diff)
    local lines = {}
    for _, l in ipairs(diff.removals) do
        table.insert(lines, { type = "del", text = l })
    end
    for _, l in ipairs(diff.additions) do
        table.insert(lines, { type = "add", text = l })
    end
    for _, l in ipairs(diff.context) do
        table.insert(lines, { type = "context", text = l })
    end
    return lines
end

-- Apply a diff to source, return new source
function DiffService.applyDiff(source, diff)
    local lines = splitLines(source)
    -- Remove old lines
    for i = #diff.removals, 1, -1 do
        table.remove(lines, diff.targetLine)
    end
    -- Insert new lines
    for i, l in ipairs(diff.additions) do
        table.insert(lines, diff.targetLine + i - 1, l)
    end
    return table.concat(lines, "\n")
end

-- Revert a diff from source, return previous source
function DiffService.revertDiff(source, diff)
    local lines = splitLines(source)
    -- Remove added lines
    for i = #diff.additions, 1, -1 do
        table.remove(lines, diff.targetLine + i - 1)
    end
    -- Insert removed lines back
    for i, l in ipairs(diff.removals) do
        table.insert(lines, diff.targetLine + i - 1, l)
    end
    return table.concat(lines, "\n")
end

return DiffService
