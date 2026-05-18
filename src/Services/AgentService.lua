--[[
    AgentService — HTTP bridge to the agent server for RoAgent v3
    Manages connection state, suggestion requests, heartbeat, and error handling.
]]

local AgentService = {
    _configService = nil,
    _stateStore = nil,
    _eventBus = nil,
    _connected = false,
    _processing = false,
    _heartbeatTimer = nil,
    _debounceTimer = nil,
    _requestInFlight = false,
    _suggestionQueue = {},
    _maxQueueDepth = 5,
}

local HttpService = game:GetService("HttpService")

function AgentService.init(configService, stateStore, eventBus)
    AgentService._configService = configService
    AgentService._stateStore = stateStore
    AgentService._eventBus = eventBus
    AgentService._maxQueueDepth = configService:get("maxQueueDepth") or 5
end

function AgentService.destroy()
    AgentService._connected = false
    AgentService._processing = false
    AgentService._requestInFlight = false
    AgentService._suggestionQueue = {}
    AgentService._configService = nil
    AgentService._stateStore = nil
    AgentService._eventBus = nil
end

-- ── Connection ─────────────────────────────────────────────────────────────────

function AgentService.getServerUrl()
    return AgentService._configService:get("serverUrl") or "http://127.0.0.1:8765"
end

function AgentService.setServerUrl(url)
    AgentService._configService:set("serverUrl", url)
end

function AgentService.isConnected()
    return AgentService._connected
end

-- Test connection to server
function AgentService.connect()
    local url = AgentService.getServerUrl() .. "/health"
    local ok, result = pcall(function()
        return HttpService:GetAsync(url)
    end)
    if ok then
        AgentService._connected = true
        AgentService._stateStore:set("connected", true)
        AgentService._stateStore:set("connecting", false)
        if AgentService._eventBus then
            AgentService._eventBus.emit("connectionStateChanged", "connected")
        end
        AgentService._startHeartbeat()
        return true
    else
        AgentService._connected = false
        AgentService._stateStore:set("connected", false)
        AgentService._stateStore:set("connecting", false)
        if AgentService._eventBus then
            AgentService._eventBus.emit("connectionStateChanged", "error")
        end
        return false
    end
end

function AgentService.disconnect()
    AgentService._connected = false
    AgentService._processing = false
    AgentService._requestInFlight = false
    AgentService._stateStore:set("connected", false)
    AgentService._stateStore:set("agentProcessing", false)
    AgentService._stopHeartbeat()
    if AgentService._eventBus then
        AgentService._eventBus.emit("connectionStateChanged", "disconnected")
    end
end

-- ── Heartbeat ───────────────────────────────────────────────────────────────────

function AgentService._startHeartbeat()
    AgentService._stopHeartbeat()
    local interval = 30
    AgentService._heartbeatTimer = task.spawn(function()
        while AgentService._connected do
            task.wait(interval)
            if not AgentService._connected then break end
            local url = AgentService.getServerUrl() .. "/ping"
            local ok, _ = pcall(function()
                return HttpService:GetAsync(url)
            end)
            if not ok then
                AgentService._connected = false
                AgentService._stateStore:set("connected", false)
                if AgentService._eventBus then
                    AgentService._eventBus.emit("connectionStateChanged", "error")
                end
                -- Schedule reconnect
                task.delay(5, function()
                    if not AgentService._connected then
                        AgentService.connect()
                    end
                end)
                break
            end
        end
    end)
end

function AgentService._stopHeartbeat()
    -- Heartbeat is a task.spawn loop; it will self-terminate when _connected is false
    AgentService._heartbeatTimer = nil
end

-- ── Suggestions ─────────────────────────────────────────────────────────────────

-- Request a suggestion (debounced)
function AgentService.requestSuggestion(source, cursorLine, cursorColumn, scriptPath)
    if not AgentService._connected then return end

    -- Cancel any pending debounced request
    if AgentService._debounceTimer then
        AgentService._debounceTimer = nil
    end

    local delay = (AgentService._configService:get("pollingInterval") or 1000) / 1000
    if delay < 0.3 then delay = 0.3 end

    AgentService._debounceTimer = task.delay(delay, function()
        AgentService._debounceTimer = nil
        AgentService._sendSuggestionRequest(source, cursorLine, cursorColumn, scriptPath)
    end)
end

function AgentService._sendSuggestionRequest(source, cursorLine, cursorColumn, scriptPath)
    if AgentService._requestInFlight then return end
    AgentService._requestInFlight = true
    AgentService._processing = true
    AgentService._stateStore:set("agentProcessing", true)

    local url = AgentService.getServerUrl() .. "/suggest"
    local body = HttpService:JSONEncode({
        source = source or "",
        cursorLine = cursorLine or 1,
        cursorColumn = cursorColumn or 1,
        scriptPath = scriptPath or "",
    })

    local ok, result = pcall(function()
        return HttpService:PostAsync(url, body, Enum.HttpContentType.ApplicationJson)
    end)

    AgentService._requestInFlight = false
    AgentService._processing = false
    AgentService._stateStore:set("agentProcessing", false)

    if not ok then
        -- Timeout or connection error — drop silently
        return
    end

    local parseOk, data = pcall(function()
        return HttpService:JSONDecode(result)
    end)

    if not parseOk then return end

    if data.suggestion then
        local suggestion = data.suggestion
        -- Build a diff from the suggestion
        local diff = {
            targetLine = suggestion.targetLine or 1,
            additions = suggestion.additions or {},
            removals = suggestion.removals or {},
            context = suggestion.context or {},
            explanation = suggestion.explanation or "",
            replacement = suggestion.replacement or "",
        }
        -- Add to queue
        table.insert(AgentService._suggestionQueue, diff)
        -- Trim queue
        while #AgentService._suggestionQueue > AgentService._maxQueueDepth do
            table.remove(AgentService._suggestionQueue, 1)
        end
        AgentService._stateStore:set("suggestionQueue", AgentService._suggestionQueue)
        if AgentService._eventBus then
            AgentService._eventBus.emit("suggestionReceived", diff)
        end
    end
end

-- Get the current suggestion queue
function AgentService.getSuggestionQueue()
    return AgentService._suggestionQueue
end

-- Pop the next suggestion from the queue
function AgentService.popSuggestion()
    if #AgentService._suggestionQueue == 0 then return nil end
    local suggestion = table.remove(AgentService._suggestionQueue, 1)
    AgentService._stateStore:set("suggestionQueue", AgentService._suggestionQueue)
    return suggestion
end

-- Clear the suggestion queue
function AgentService.clearQueue()
    AgentService._suggestionQueue = {}
    AgentService._stateStore:set("suggestionQueue", {})
end

return AgentService
