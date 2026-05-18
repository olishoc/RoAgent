--[[
    RoAgent v3 — Test Runner
    Runs all test files and reports PASS/FAIL for each test.
    Exits with code 0 if all pass, code 1 if any fail.

    Usage: lua plugin/tests/run.lua
    (Requires a Lua 5.1+ interpreter)
]]

local testFiles = {
    "test_EventBus",
    "test_StateStore",
    "test_ThemeService",
    "test_SyntaxService",
    "test_DiffService",
    "test_HistoryService",
    "test_ScriptWriter",
}

local totalPassed = 0
local totalFailed = 0
local failures = {}

-- Minimal stub for Roblox globals that tests reference
local function setupStubs()
    -- Color3
    Color3 = Color3 or {}
    Color3.new = Color3.new or function(r, g, b)
        return { R = r or 0, G = g or 0, B = b or 0 }
    end
    Color3.fromRGB = Color3.fromRGB or function(r, g, b)
        return { R = r/255, G = g/255, B = b/255 }
    end

    -- Vector2
    Vector2 = Vector2 or {}
    Vector2.new = Vector2.new or function(x, y)
        return { X = x or 0, Y = y or 0 }
    end

    -- UDim2
    UDim2 = UDim2 or {}
    UDim2.new = UDim2.new or function(xs, xo, ys, yo)
        return { X = { Scale = xs or 0, Offset = xo or 0 }, Y = { Scale = ys or 0, Offset = yo or 0 } }
    end
    UDim2.fromScale = UDim2.fromScale or function(xs, ys)
        return { X = { Scale = xs or 0, Offset = 0 }, Y = { Scale = ys or 0, Offset = 0 } }
    end

    -- UDim
    UDim = UDim or {}
    UDim.new = UDim.new or function(scale, offset)
        return { Scale = scale or 0, Offset = offset or 0 }
    end

    -- Enum
    Enum = Enum or {}
    Enum.Font = { Code = "Code", Gotham = "Gotham", GothamSemibold = "GothamSemibold" }
    Enum.TextXAlignment = { Left = "Left", Right = "Right" }
    Enum.TextYAlignment = { Top = "Top", Center = "Center" }
    Enum.FillDirection = { Vertical = "Vertical", Horizontal = "Horizontal" }
    Enum.SortOrder = { LayoutOrder = "LayoutOrder" }
    Enum.AutomaticSize = { Y = "Y", X = "X", XY = "XY" }
    Enum.InitialDockState = { Right = "Right", Float = "Float" }
    Enum.HttpContentType = { ApplicationJson = "ApplicationJson" }
    Enum.UserInputType = { MouseButton1 = "MouseButton1" }

    -- Instance
    Instance = Instance or {}
    setmetatable(Instance, {
        __index = function(_, key)
            return function(props)
                local obj = { ClassName = key, Name = (props and props.Name) or key }
                setmetatable(obj, {
                    __index = function(t, k)
                        if k == "Parent" then return props and props.Parent end
                        return rawget(t, k)
                    end,
                    __newindex = function(t, k, v)
                        rawset(t, k, v)
                    end
                })
                return obj
            end
        end
    })

    -- game
    game = game or {}
    game.GetService = game.GetService or function(_, name)
        if name == "TextService" then
            return {
                GetTextSize = function(_, text, fontSize, font, bounds)
                    return Vector2.new(#text * (fontSize * 0.6), fontSize)
                end
            }
        end
        return nil
    end

    -- os / task
    os = os or {}
    os.clock = os.clock or function() return os.time and os.time() or 0 end
    task = task or {}
    task.delay = task.delay or function(_, fn) fn() end
    task.wait = task.wait or function() end
    task.spawn = task.spawn or function(fn) fn() end

    warn = warn or print
end

setupStubs()

-- Load each test file and run its tests
for _, testName in ipairs(testFiles) do
    local ok, testModule = pcall(require, testName)
    if not ok then
        print("FAIL " .. testName .. " -- could not load: " .. tostring(testModule))
        totalFailed = totalFailed + 1
        table.insert(failures, testName .. " (load error)")
        goto continue
    end

    if type(testModule) ~= "table" then
        print("FAIL " .. testName .. " -- did not return a table")
        totalFailed = totalFailed + 1
        table.insert(failures, testName .. " (not a table)")
        goto continue
    end

    for testFuncName, testFunc in pairs(testModule) do
        if type(testFunc) == "function" and string.sub(testFuncName, 1, 5) == "test_" then
            local pass, err = pcall(testFunc)
            if pass then
                print("PASS " .. testFuncName)
                totalPassed = totalPassed + 1
            else
                print("FAIL " .. testFuncName .. " -- " .. tostring(err))
                totalFailed = totalFailed + 1
                table.insert(failures, testFuncName)
            end
        end
    end

    ::continue::
end

print("")
print(string.format("Results: %d passed, %d failed", totalPassed, totalFailed))

if totalFailed > 0 then
    print("")
    print("Failed tests:")
    for _, name in ipairs(failures) do
        print("  " .. name)
    end
    os.exit(1)
else
    os.exit(0)
end
