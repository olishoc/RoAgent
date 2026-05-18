--[[
    Tests for SyntaxService
]]

local SyntaxService = require("Services.SyntaxService")

local tests = {}

function tests.test_tokenize_keywords()
    local tokens = SyntaxService.tokenize("local function if then end")
    local types = {}
    for _, t in ipairs(tokens) do
        if t.type ~= "WHITESPACE" then
            table.insert(types, t.type)
        end
    end
    assert(#types == 5, "expected 5 non-whitespace tokens, got " .. #types)
    for _, ty in ipairs(types) do
        assert(ty == "KEYWORD", "expected KEYWORD, got " .. ty)
    end
end

function test_tokenize_single_quoted_strings()
    local tokens = SyntaxService.tokenize("'hello world'")
    assert(#tokens == 1, "expected 1 token, got " .. #tokens)
    assert(tokens[1].type == "STRING", "expected STRING, got " .. tokens[1].type)
    assert(tokens[1].text == "'hello world'", "wrong text: " .. tokens[1].text)
end

function tests.test_tokenize_double_quoted_strings()
    local tokens = SyntaxService.tokenize('"hello world"')
    assert(#tokens == 1, "expected 1 token, got " .. #tokens)
    assert(tokens[1].type == "STRING", "expected STRING, got " .. tokens[1].type)
end

function tests.test_tokenize_long_strings()
    local tokens = SyntaxService.tokenize("[[long string content]]")
    assert(#tokens == 1, "expected 1 token, got " .. #tokens)
    assert(tokens[1].type == "STRING", "expected STRING, got " .. tokens[1].type)
end

function tests.test_tokenize_comments()
    local tokens = SyntaxService.tokenize("-- this is a comment")
    assert(#tokens == 1, "expected 1 token, got " .. #tokens)
    assert(tokens[1].type == "COMMENT", "expected COMMENT, got " .. tokens[1].type)
end

function tests.test_tokenize_block_comments()
    local tokens = SyntaxService.tokenize("--[[ block comment ]]")
    assert(#tokens == 1, "expected 1 token, got " .. #tokens)
    assert(tokens[1].type == "COMMENT", "expected COMMENT, got " .. tokens[1].type)
end

function tests.test_tokenize_numbers()
    local tokens = SyntaxService.tokenize("42 3.14 0xFF")
    local nums = {}
    for _, t in ipairs(tokens) do
        if t.type == "NUMBER" then
            table.insert(nums, t.text)
        end
    end
    assert(#nums == 3, "expected 3 numbers, got " .. #nums)
    assert(nums[1] == "42", "first number wrong: " .. tostring(nums[1]))
    assert(nums[2] == "3.14", "second number wrong: " .. tostring(nums[2]))
    assert(nums[3] == "0xFF", "third number wrong: " .. tostring(nums[3]))
end

function tests.test_tokenize_identifiers()
    local tokens = SyntaxService.tokenize("myVariable _test foo")
    local ids = {}
    for _, t in ipairs(tokens) do
        if t.type == "IDENTIFIER" then
            table.insert(ids, t.text)
        end
    end
    assert(#ids == 3, "expected 3 identifiers, got " .. #ids)
    assert(ids[1] == "myVariable", "first identifier wrong")
    assert(ids[2] == "_test", "second identifier wrong")
end

function tests.test_tokenize_operators()
    local tokens = SyntaxService.tokenize("= + == ~= <= >=")
    local ops = {}
    for _, t in ipairs(tokens) do
        if t.type == "OPERATOR" then
            table.insert(ops, t.text)
        end
    end
    assert(#ops >= 4, "expected at least 4 operators, got " .. #ops)
end

function tests.test_tokenize_whitespace()
    local tokens = SyntaxService.tokenize("  local  x  ")
    local ws = false
    for _, t in ipairs(tokens) do
        if t.type == "WHITESPACE" then ws = true end
    end
    assert(ws, "no whitespace token found")
end

function tests.test_tokenize_empty_source()
    local tokens = SyntaxService.tokenize("")
    assert(#tokens == 0, "expected 0 tokens for empty source, got " .. #tokens)
end

function tests.test_getTokenColorKey()
    assert(SyntaxService.getTokenColorKey("KEYWORD") == "KEYWORD", "KEYWORD color key wrong")
    assert(SyntaxService.getTokenColorKey("STRING") == "STRING", "STRING color key wrong")
    assert(SyntaxService.getTokenColorKey("COMMENT") == "COMMENT", "COMMENT color key wrong")
    assert(SyntaxService.getTokenColorKey("NUMBER") == "NUMBER", "NUMBER color key wrong")
    assert(SyntaxService.getTokenColorKey("IDENTIFIER") == "TEXT", "IDENTIFIER color key wrong")
    assert(SyntaxService.getTokenColorKey("WHITESPACE") == "TEXT", "WHITESPACE color key wrong")
    assert(SyntaxService.getTokenColorKey("UNKNOWN") == "TEXT", "unknown type should default to TEXT")
end

return tests
