--[[
    Services/index.lua — Service Registry for RoAgent v3
    Central registry for all services. Handles init/destroy lifecycle.
]]

local Services = {}

local Registry = {
    ConfigService   = nil,
    ThemeService    = nil,
    EditorService   = nil,
    SyntaxService   = nil,
    AgentService    = nil,
    DiffService     = nil,
    FileSyncService = nil,
    ConfigService   = nil,
    ThemeService    = nil,
}

-- Lazy-load services on first access
setmetatable(Registry, {
    __index = function(t, k)
        local ok, mod = pcall(require, script.Parent:FindFirstChild(k))
        if ok and type(mod) == "table" then
            t[k] = mod
            return mod
        end
        return nil
    end,
})

function Services.init(plugin)
    -- Init order matters: Config → Theme → others
    local config  = require(script.Parent.ConfigService)
    config.init(plugin)
    Registry.ConfigService = config

    local theme = require(script.Parent.ThemeService)
    theme.init(config, "HighContrast")
    Registry.ThemeService = theme

    -- Wire up theme changes to all services
    theme.onThemeChange(function(newTheme)
        -- Services can subscribe to this via theme.onThemeChange
    end)

    print("[RoAgent] Services initialized")
    return Registry
end

function Services.get(name)
    return Registry[name]
end

function Services.destroy()
    for name, svc in pairs(Registry) do
        if svc and type(svc.destroy) == "function" then
            pcall(function() svc.destroy() end)
        end
    end
    Registry = {}
    print("[RoAgent] Services destroyed")
end

return Services