--[[
    Tests for ThemeService
]]

local ThemeService = require("Services.ThemeService")

-- Minimal ConfigService stub
local stubConfig = {
    _data = {},
    get = function(self, k) return self._data[k] end,
    set = function(self, k, v) self._data[k] = v end,
}

local tests = {}

function tests.test_getActive_returns_theme()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local theme = ThemeService.getActive()
    assert(theme ~= nil, "getActive returned nil")
    assert(theme.name == "High Contrast", "expected High Contrast, got " .. tostring(theme.name))
end

function tests.test_getTheme_by_name()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local theme = ThemeService.getTheme("OneDark")
    assert(theme ~= nil, "getTheme returned nil")
    assert(theme.name == "One Dark", "expected One Dark, got " .. tostring(theme.name))
end

function tests.test_setTheme_switches()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local ok = ThemeService.setTheme("Dracula")
    assert(ok, "setTheme returned false")
    assert(ThemeService.getActive().name == "Dracula", "theme not switched")
end

function tests.test_setTheme_persists()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    ThemeService.setTheme("Gruvbox")
    assert(stubConfig._data["theme"] == "Gruvbox", "theme not persisted")
end

function tests.test_setTheme_fires_callback()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local fired = false
    local receivedTheme
    ThemeService.onThemeChange(function(theme)
        fired = true
        receivedTheme = theme
    end)
    ThemeService.setTheme("OneDark")
    assert(fired, "callback not fired")
    assert(receivedTheme.name == "One Dark", "wrong theme in callback")
end

function tests.test_invalid_theme_returns_false()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local ok = ThemeService.setTheme("NonExistent")
    assert(ok == false, "setTheme should return false for invalid theme")
end

function tests.test_addCustomTheme()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local custom = {
        BG = Color3.new(), TEXT = Color3.new(), KEYWORD = Color3.new(),
        STRING = Color3.new(), COMMENT = Color3.new(), NUMBER = Color3.new(),
        FUNCTION = Color3.new(), OPERATOR = Color3.new(),
    }
    local ok = ThemeService.addCustomTheme("Custom", custom)
    assert(ok, "addCustomTheme returned false")
    local theme = ThemeService.getTheme("Custom")
    assert(theme ~= nil, "custom theme not found")
end

function tests.test_addCustomTheme_validates()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local incomplete = { BG = Color3.new() }
    local ok = ThemeService.addCustomTheme("Bad", incomplete)
    assert(ok == false, "addCustomTheme should reject incomplete theme")
end

function tests.test_removeCustomTheme()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local custom = {
        BG = Color3.new(), TEXT = Color3.new(), KEYWORD = Color3.new(),
        STRING = Color3.new(), COMMENT = Color3.new(), NUMBER = Color3.new(),
        FUNCTION = Color3.new(), OPERATOR = Color3.new(),
    }
    ThemeService.addCustomTheme("ToRemove", custom)
    local ok = ThemeService.removeCustomTheme("ToRemove")
    assert(ok, "removeCustomTheme returned false")
    assert(ThemeService.getTheme("ToRemove") == nil, "theme still exists after removal")
end

function tests.test_getThemeNames()
    stubConfig._data = {}
    ThemeService.init(stubConfig)
    local names = ThemeService.getThemeNames()
    assert(#names >= 4, "expected at least 4 themes, got " .. #names)
end

return tests
