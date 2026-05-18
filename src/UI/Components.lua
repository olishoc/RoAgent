--[[
    Components — Reusable UI primitives for RoAgent v3
    All primitives read colors from the active theme at creation time.
]]

local Components = {}

local function mk(cls, props)
    local i = Instance.new(cls)
    if cls ~= "UIListLayout" and cls ~= "UIPadding" and cls ~= "UICorner"
        and cls ~= "UIStroke" and cls ~= "UISizeConstraint" then
        i.BorderSizePixel = 0
    end
    for k, v in pairs(props or {}) do
        i[k] = v
    end
    return i
end

function Components.frame(parent, size, pos, name)
    return mk("Frame", {
        Parent = parent,
        Size = size or UDim2.fromScale(1, 1),
        Position = pos or UDim2.new(),
        Name = name or "Frame",
        ClipsDescendants = true,
    })
end

function Components.label(parent, text, fontSize, font, size, pos, xAlign)
    return mk("TextLabel", {
        Parent = parent,
        Text = text or "",
        TextSize = fontSize or 11,
        Font = font or Enum.Font.Gotham,
        Size = size or UDim2.fromScale(1, 1),
        Position = pos or UDim2.new(),
        TextXAlignment = xAlign or Enum.TextXAlignment.Left,
        BackgroundTransparency = 1,
    })
end

function Components.button(parent, text, size, pos, name)
    local b = mk("TextButton", {
        Parent = parent,
        Text = text or "",
        Font = Enum.Font.GothamSemibold,
        TextSize = 11,
        Size = size or UDim2.new(0, 60, 0, 24),
        Position = pos or UDim2.new(),
        Name = name or "Btn",
        AutoButtonColor = true,
    })
    mk("UICorner", { Parent = b, CornerRadius = UDim.new(0, 2) })
    return b
end

function Components.textbox(parent, placeholder, size, pos)
    local t = mk("TextBox", {
        Parent = parent,
        PlaceholderText = placeholder or "",
        Text = "",
        Font = Enum.Font.Code,
        TextSize = 11,
        TextXAlignment = Enum.TextXAlignment.Left,
        TextYAlignment = Enum.TextYAlignment.Top,
        ClearTextOnFocus = false,
        Size = size or UDim2.fromScale(1, 1),
        Position = pos or UDim2.new(),
    })
    mk("UIPadding", {
        Parent = t,
        PaddingLeft = UDim.new(0, 6),
        PaddingRight = UDim.new(0, 6),
        PaddingTop = UDim.new(0, 4),
        PaddingBottom = UDim.new(0, 4),
    })
    mk("UICorner", { Parent = t, CornerRadius = UDim.new(0, 2) })
    return t
end

function Components.scroll(parent, size, pos, name)
    return mk("ScrollingFrame", {
        Parent = parent,
        Size = size or UDim2.fromScale(1, 1),
        Position = pos or UDim2.new(),
        BackgroundTransparency = 1,
        ScrollBarThickness = 6,
        CanvasSize = UDim2.new(0, 0, 0, 0),
        AutomaticCanvasSize = Enum.AutomaticSize.Y,
        Name = name or "Scroll",
    })
end

function Components.vlist(parent, gap, padding)
    local l = mk("UIListLayout", {
        Parent = parent,
        FillDirection = Enum.FillDirection.Vertical,
        SortOrder = Enum.SortOrder.LayoutOrder,
        Padding = UDim.new(0, gap or 4),
    })
    if padding then
        mk("UIPadding", {
            Parent = parent,
            PaddingLeft = UDim.new(0, padding),
            PaddingRight = UDim.new(0, padding),
            PaddingTop = UDim.new(0, padding),
            PaddingBottom = UDim.new(0, padding),
        })
    end
    return l
end

function Components.hlist(parent, gap, padding)
    local l = mk("UIListLayout", {
        Parent = parent,
        FillDirection = Enum.FillDirection.Horizontal,
        SortOrder = Enum.SortOrder.LayoutOrder,
        Padding = UDim.new(0, gap or 4),
    })
    if padding then
        mk("UIPadding", {
            Parent = parent,
            PaddingLeft = UDim.new(0, padding),
            PaddingRight = UDim.new(0, padding),
            PaddingTop = UDim.new(0, padding),
            PaddingBottom = UDim.new(0, padding),
        })
    end
    return l
end

function Components.pad(parent, px)
    mk("UIPadding", {
        Parent = parent,
        PaddingLeft = UDim.new(0, px),
        PaddingRight = UDim.new(0, px),
        PaddingTop = UDim.new(0, px),
        PaddingBottom = UDim.new(0, px),
    })
    return parent
end

function Components.corner(parent, radius)
    mk("UICorner", { Parent = parent, CornerRadius = UDim.new(0, radius or 2) })
    return parent
end

function Components.stroke(parent, color, thickness)
    mk("UIStroke", {
        Parent = parent,
        Color = color or Color3.new(),
        Thickness = thickness or 1,
    })
    return parent
end

return Components
