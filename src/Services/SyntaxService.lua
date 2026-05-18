--[[
    SyntaxService — Lua tokenizer for RoAgent v3
    Splits Lua source into typed tokens for syntax highlighting.
]]

local SyntaxService = {}

local KEYWORDS = {
    "and", "break", "do", "else", "elseif", "end", "false", "for",
    "function", "if", "in", "local", "nil", "not", "or", "repeat",
    "return", "then", "true", "until", "while"
}

local KEYWORD_SET = {}
for _, k in ipairs(KEYWORDS) do
    KEYWORD_SET[k] = true
end

-- Token type to theme color key mapping
local TOKEN_COLOR_MAP = {
    KEYWORD   = "KEYWORD",
    STRING    = "STRING",
    COMMENT   = "COMMENT",
    NUMBER    = "NUMBER",
    FUNCTION  = "FUNCTION",
    OPERATOR  = "OPERATOR",
    IDENTIFIER = "TEXT",
    WHITESPACE = "TEXT",
}

function SyntaxService.tokenize(source)
    local tokens = {}
    local pos = 1
    local len = #source

    while pos <= len do
        local c = string.sub(source, pos, pos)

        -- Whitespace
        if c == " " or c == "\t" or c == "\n" or c == "\r" then
            local start = pos
            while pos <= len do
                local ch = string.sub(source, pos, pos)
                if ch ~= " " and ch ~= "\t" and ch ~= "\n" and ch ~= "\r" then
                    break
                end
                pos += 1
            end
            table.insert(tokens, { type = "WHITESPACE", text = string.sub(source, start, pos - 1) })

        -- Comments
        elseif c == "-" and pos < len and string.sub(source, pos, pos + 1) == "--" then
            local start = pos
            pos += 2
            -- Check for long comment [[
            if pos <= len and string.sub(source, pos, pos) == "[" then
                if pos < len and string.sub(source, pos, pos + 1) == "[[" then
                    pos += 2
                    while pos <= len do
                        if string.sub(source, pos, pos + 1) == "]]" then
                            pos += 2
                            break
                        end
                        pos += 1
                    end
                end
            else
                -- Line comment
                while pos <= len do
                    local ch = string.sub(source, pos, pos)
                    if ch == "\n" or ch == "\r" then break end
                    pos += 1
                end
            end
            table.insert(tokens, { type = "COMMENT", text = string.sub(source, start, pos - 1) })

        -- Strings: single or double quoted
        elseif c == "'" or c == '"' then
            local start = pos
            local quote = c
            pos += 1
            while pos <= len do
                local ch = string.sub(source, pos, pos)
                if ch == "\\" then
                    pos += 2
                elseif ch == quote then
                    pos += 1
                    break
                else
                    pos += 1
                end
            end
            table.insert(tokens, { type = "STRING", text = string.sub(source, start, pos - 1) })

        -- Long strings: [[ ]]
        elseif c == "[" and pos < len and string.sub(source, pos, pos + 1) == "[[" then
            local start = pos
            pos += 2
            while pos <= len do
                if string.sub(source, pos, pos + 1) == "]]" then
                    pos += 2
                    break
                end
                pos += 1
            end
            table.insert(tokens, { type = "STRING", text = string.sub(source, start, pos - 1) })

        -- Numbers
        elseif (c >= "0" and c <= "9") or (c == "." and pos < len and string.sub(source, pos + 1, pos + 1) >= "0" and string.sub(source, pos + 1, pos + 1) <= "9") then
            local start = pos
            -- Hex
            if c == "0" and pos < len and string.lower(string.sub(source, pos + 1, pos + 1)) == "x" then
                pos += 2
                while pos <= len do
                    local ch = string.lower(string.sub(source, pos, pos))
                    if not ((ch >= "0" and ch <= "9") or (ch >= "a" and ch <= "f")) then
                        break
                    end
                    pos += 1
                end
            else
                while pos <= len do
                    local ch = string.sub(source, pos, pos)
                    if not ((ch >= "0" and ch <= "9") or ch == "." or ch == "e" or ch == "E" or ch == "-" or ch == "+") then
                        break
                    end
                    pos += 1
                end
            end
            table.insert(tokens, { type = "NUMBER", text = string.sub(source, start, pos - 1) })

        -- Identifiers and keywords
        elseif (c >= "a" and c <= "z") or (c >= "A" and c <= "Z") or c == "_" then
            local start = pos
            pos += 1
            while pos <= len do
                local ch = string.sub(source, pos, pos)
                if not ((ch >= "a" and ch <= "z") or (ch >= "A" and ch <= "Z") or (ch >= "0" and ch <= "9") or ch == "_") then
                    break
                end
                pos += 1
            end
            local text = string.sub(source, start, pos - 1)
            if KEYWORD_SET[text] then
                table.insert(tokens, { type = "KEYWORD", text = text })
            else
                table.insert(tokens, { type = "IDENTIFIER", text = text })
            end

        -- Operators and punctuation
        else
            local two = string.sub(source, pos, pos + 1)
            if two == "==" or two == "~=" or two == "<=" or two == ">=" or two == ".." then
                table.insert(tokens, { type = "OPERATOR", text = two })
                pos += 2
            else
                table.insert(tokens, { type = "OPERATOR", text = c })
                pos += 1
            end
        end
    end

    return tokens
end

function SyntaxService.getTokenColorKey(tokenType)
    return TOKEN_COLOR_MAP[tokenType] or "TEXT"
end

return SyntaxService
