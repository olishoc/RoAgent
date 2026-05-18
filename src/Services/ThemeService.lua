--[[
    ThemeService — Theme system for RoAgent v3
    Provides color palettes, manages active theme, and supports custom themes.
    All 26 required color keys must be present in every theme.
]]

local ThemeService = {
    _active = nil,
    _configService = nil,
    _customThemes = {},
    _onChange = nil,
}

-- ── Required keys for a valid theme ──────────────────────────────────────────

local REQUIRED_KEYS = {
    "BG", "PANEL", "SIDEBAR", "BORDER", "TEXT", "SUBTEXT",
    "ACCENT", "GREEN", "RED", "YELLOW",
    "KEYWORD", "STRING", "COMMENT", "NUMBER", "FUNCTION", "OPERATOR",
    "LINE_NUMBER", "CURSOR_LINE", "SELECTION",
    "DIFF_ADD", "DIFF_DEL", "DIFF_ADD_LINE", "DIFF_DEL_LINE",
    "SCROLL_BAR",
}

-- ── Built-in Themes ──────────────────────────────────────────────────────────

local builtins = {}

builtins.HighContrast = {
    name         = "High Contrast",
    BG           = Color3.fromRGB(5,   5,   10),
    PANEL        = Color3.fromRGB(10,  10,  18),
    SIDEBAR      = Color3.fromRGB(8,   8,   14),
    BORDER       = Color3.fromRGB(60,  60,  80),
    TEXT         = Color3.fromRGB(240, 240, 250),
    SUBTEXT      = Color3.fromRGB(140, 140, 160),
    ACCENT       = Color3.fromRGB(0,   200, 255),
    GREEN        = Color3.fromRGB(0,   220, 120),
    RED          = Color3.fromRGB(255, 60,  60),
    YELLOW       = Color3.fromRGB(255, 200, 80),
    KEYWORD      = Color3.fromRGB(255, 100, 180),
    STRING       = Color3.fromRGB(100, 255, 180),
    COMMENT      = Color3.fromRGB(100, 100, 120),
    NUMBER       = Color3.fromRGB(255, 200, 100),
    FUNCTION     = Color3.fromRGB(100, 180, 255),
    OPERATOR     = Color3.fromRGB(220, 220, 240),
    LINE_NUMBER  = Color3.fromRGB(80,  80,  100),
    CURSOR_LINE  = Color3.fromRGB(20,  20,  35),
    SELECTION    = Color3.fromRGB(40,  40,  80),
    DIFF_ADD     = Color3.fromRGB(20,  80,  40),
    DIFF_DEL     = Color3.fromRGB(80,  30,  30),
    DIFF_ADD_LINE= Color3.fromRGB(15,  50,  25),
    DIFF_DEL_LINE= Color3.fromRGB(50,  20,  20),
    SCROLL_BAR   = Color3.fromRGB(60,  60,  80),
}

builtins.OneDark = {
    name         = "One Dark",
    BG           = Color3.fromRGB(40,  44,  52),
    PANEL        = Color3.fromRGB(45,  49,  58),
    SIDEBAR      = Color3.fromRGB(35,  39,  46),
    BORDER       = Color3.fromRGB(60,  66,  78),
    TEXT         = Color3.fromRGB(197, 200, 212),
    SUBTEXT      = Color3.fromRGB(110, 115, 130),
    ACCENT       = Color3.fromRGB(97,  175, 239),
    GREEN        = Color3.fromRGB(152, 195, 121),
    RED          = Color3.fromRGB(224, 108, 117),
    YELLOW       = Color3.fromRGB(229, 192, 87),
    KEYWORD      = Color3.fromRGB(198, 120, 221),
    STRING       = Color3.fromRGB(152, 195, 121),
    COMMENT      = Color3.fromRGB(96,  103, 120),
    NUMBER       = Color3.fromRGB(209, 154, 102),
    FUNCTION     = Color3.fromRGB(97,  175, 239),
    OPERATOR     = Color3.fromRGB(197, 200, 212),
    LINE_NUMBER  = Color3.fromRGB(80,  85,  100),
    CURSOR_LINE  = Color3.fromRGB(50,  53,  62),
    SELECTION    = Color3.fromRGB(70,  73,  86),
    DIFF_ADD     = Color3.fromRGB(50,  70,  55),
    DIFF_DEL     = Color3.fromRGB(70,  35,  35),
    DIFF_ADD_LINE= Color3.fromRGB(40,  60,  45),
    DIFF_DEL_LINE= Color3.fromRGB(55,  25,  25),
    SCROLL_BAR   = Color3.fromRGB(60,  66,  78),
}

builtins.Dracula = {
    name         = "Dracula",
    BG           = Color3.fromRGB(40,  42,  54),
    PANEL        = Color3.fromRGB(45,  47,  60),
    SIDEBAR      = Color3.fromRGB(35,  37,  50),
    BORDER       = Color3.fromRGB(60,  63,  80),
    TEXT         = Color3.fromRGB(248, 248, 242),
    SUBTEXT      = Color3.fromRGB(115, 115, 130),
    ACCENT       = Color3.fromRGB(86,  181, 232),
    GREEN        = Color3.fromRGB(80,  250, 140),
    RED          = Color3.fromRGB(255, 85,  85),
    YELLOW       = Color3.fromRGB(241, 250, 140),
    KEYWORD      = Color3.fromRGB(219, 132, 255),
    STRING       = Color3.fromRGB(255, 159, 110),
    COMMENT      = Color3.fromRGB(90,  95,  120),
    NUMBER       = Color3.fromRGB(189, 147, 249),
    FUNCTION     = Color3.fromRGB(86,  181, 232),
    OPERATOR     = Color3.fromRGB(248, 248, 242),
    LINE_NUMBER  = Color3.fromRGB(70,  72,  90),
    CURSOR_LINE  = Color3.fromRGB(55,  57,  70),
    SELECTION    = Color3.fromRGB(65,  68,  90),
    DIFF_ADD     = Color3.fromRGB(50,  85,  65),
    DIFF_DEL     = Color3.fromRGB(80,  40,  40),
    DIFF_ADD_LINE= Color3.fromRGB(40,  70,  55),
    DIFF_DEL_LINE= Color3.fromRGB(60,  30,  30),
    SCROLL_BAR   = Color3.fromRGB(60,  63,  80),
}

builtins.Gruvbox = {
    name         = "Gruvbox",
    BG           = Color3.fromRGB(40,  36,  30),
    PANEL        = Color3.fromRGB(48,  44,  38),
    SIDEBAR      = Color3.fromRGB(35,  31,  26),
    BORDER       = Color3.fromRGB(70,  65,  58),
    TEXT         = Color3.fromRGB(235, 219, 178),
    SUBTEXT      = Color3.fromRGB(140, 130, 115),
    ACCENT       = Color3.fromRGB(215, 153, 72),
    GREEN        = Color3.fromRGB(142, 192, 124),
    RED          = Color3.fromRGB(204, 69,  58),
    YELLOW       = Color3.fromRGB(215, 153, 72),
    KEYWORD      = Color3.fromRGB(254, 176, 102),
    STRING       = Color3.fromRGB(142, 192, 124),
    COMMENT      = Color3.fromRGB(130, 120, 100),
    NUMBER       = Color3.fromRGB(213, 147, 72),
    FUNCTION     = Color3.fromRGB(215, 153, 72),
    OPERATOR     = Color3.fromRGB(235, 219, 178),
    LINE_NUMBER  = Color3.fromRGB(90,  85,  75),
    CURSOR_LINE  = Color3.fromRGB(55,  50,  42),
    SELECTION    = Color3.fromRGB(65,  60,  52),
    DIFF_ADD     = Color3.fromRGB(55,  80,  55),
    DIFF_DEL     = Color3.fromRGB(85,  45,  40),
    DIFF_ADD_LINE= Color3.fromRGB(45,  65,  45),
    DIFF_DEL_LINE= Color3.fromRGB(65,  35,  30),
    SCROLL_BAR   = Color3.fromRGB(70,  65,  58),
}

-- ── Lifecycle ─────────────────────────────────────────────────────────────────

function ThemeService.init(configService)
    ThemeService._configService = configService
    local saved = configService:get("theme") or "HighContrast"
    ThemeService._active = builtins[saved] or builtins.HighContrast
end

function ThemeService.destroy()
    ThemeService._configService = nil
    ThemeService._active = nil
    ThemeService._customThemes = {}
    ThemeService._onChange = nil
end

-- ── Public API ─────────────────────────────────────────────────────────────────

function ThemeService.getActive()
    return ThemeService._active
end

function ThemeService.getTheme(name)
    if name and builtins[name] then return builtins[name] end
    if name and ThemeService._customThemes[name] then return ThemeService._customThemes[name] end
    return ThemeService._active
end

function ThemeService.setTheme(name)
    local theme = ThemeService.getTheme(name)
    if not theme then return false end
    ThemeService._active = theme
    if ThemeService._configService then
        ThemeService._configService:set("theme", name)
    end
    if ThemeService._onChange then
        ThemeService._onChange(theme)
    end
    return true
end

function ThemeService.getThemeNames()
    local list = {}
    for k in pairs(builtins) do table.insert(list, k) end
    for k in pairs(ThemeService._customThemes) do table.insert(list, k) end
    table.sort(list)
    return list
end

function ThemeService.onThemeChange(callback)
    ThemeService._onChange = callback
end

function ThemeService.addCustomTheme(name, data)
    local ok, err = ThemeService.validateTheme(data)
    if not ok then
        warn("[ThemeService] Invalid theme:", err)
        return false
    end
    data.name = name
    ThemeService._customThemes[name] = data
    return true
end

function ThemeService.removeCustomTheme(name)
    if ThemeService._customThemes[name] then
        ThemeService._customThemes[name] = nil
        return true
    end
    return false
end

function ThemeService.validateTheme(data)
    for _, key in ipairs(REQUIRED_KEYS) do
        if data[key] == nil then
            return false, "missing key: " .. key
        end
    end
    return true
end

return ThemeService
