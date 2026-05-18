--[[
    ConfigService — Settings persistence for RoAgent v3
    Handles plugin settings, server URL, polling interval, and user preferences.
    All keys are persisted via plugin:GetSetting / plugin:SetSetting.
]]

local ConfigService = {
    _plugin = nil,
    _cache = {},
    _defaults = {
        serverUrl       = "http://127.0.0.1:8765",
        pollingInterval = 1000,
        maxQueueDepth   = 5,
        theme           = "HighContrast",
        fontSize        = 11,
        tabSize         = 4,
        watchScript     = true,
        watchLocalScript = true,
        watchModuleScript = true,
    },
}

local function key(k)
    return "RoAgent_" .. k
end

function ConfigService.init(plugin)
    ConfigService._plugin = plugin
    for k, v in pairs(ConfigService._defaults) do
        ConfigService._cache[k] = v
    end
end

function ConfigService.destroy()
    ConfigService._plugin = nil
    ConfigService._cache = {}
end

function ConfigService.get(k)
    if ConfigService._defaults[k] == nil then
        return nil
    end
    if ConfigService._cache[k] ~= nil then
        return ConfigService._cache[k]
    end
    local ok, stored = pcall(function()
        return ConfigService._plugin:GetSetting(key(k))
    end)
    if ok and stored ~= nil then
        ConfigService._cache[k] = stored
        return stored
    end
    return ConfigService._defaults[k]
end

function ConfigService.set(k, value)
    if ConfigService._defaults[k] == nil then
        warn("[ConfigService] Unknown key:", k)
        return false
    end
    ConfigService._cache[k] = value
    ConfigService._plugin:SetSetting(key(k), value)
    return true
end

function ConfigService.getAll()
    local result = {}
    for k in pairs(ConfigService._defaults) do
        result[k] = ConfigService.get(k)
    end
    return result
end

function ConfigService.getDefaults()
    return ConfigService._defaults
end

function ConfigService.reset(k)
    if k then
        ConfigService._cache[k] = ConfigService._defaults[k]
        ConfigService._plugin:SetSetting(key(k), nil)
    else
        for dk, dv in pairs(ConfigService._defaults) do
            ConfigService._cache[dk] = dv
            ConfigService._plugin:SetSetting(key(dk), nil)
        end
    end
end

return ConfigService
