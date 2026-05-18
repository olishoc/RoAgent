local GuiService = game:GetService("GuiService")
local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")
local TweenService = game:GetService("TweenService")

local Utils = {}

function Utils.uuid()
	return HttpService:GenerateGUID(false)
end

function Utils.encodeJson(value)
	return HttpService:JSONEncode(value or {})
end

function Utils.decodeJson(text)
	local ok, decoded = pcall(function()
		return HttpService:JSONDecode(text)
	end)
	if ok then
		return decoded
	end
	return nil
end

function Utils.notify(text, title)
	if RunService:IsClient() then
		local ok = pcall(function()
			StarterGui:SetCore("SendNotification", {
				Title = title or "StudioLink",
				Text = tostring(text or "Unknown error"),
				Duration = 5,
			})
		end)
		if ok then
			return
		end
	end
	warn("[StudioLink] " .. tostring(text))
end

function Utils.isAllowedBrowserUrl(url)
	url = tostring(url or "")
	local host = string.match(string.lower(url), "^https?://([^/%?#:]+)")
	return host == "rblxagent.com" or host == "www.rblxagent.com" or host == "api.rblxagent.com" or host == "github.com" or host == "www.github.com" or host == "gitlab.com" or host == "www.gitlab.com" or host == "bitbucket.org" or host == "www.bitbucket.org" or host == "dev.azure.com"
end

function Utils.openUrl(plugin, url, manager)
	url = tostring(url or "")
	if not Utils.isAllowedBrowserUrl(url) then
		Utils.notify("Blocked untrusted URL: " .. url, "StudioLink")
		return false
	end
	if manager and manager.postLocal then
		local ok = manager:postLocal("/open-url", { url = url })
		if ok then
			return true
		end
	end
	local ok = false
	if plugin then
		ok = pcall(function()
			plugin:OpenBrowserWindow(url)
		end)
		if ok then
			return true
		end
	end
	ok = pcall(function()
		GuiService:OpenBrowserWindow(url)
	end)
	if ok then
		return true
	end
	pcall(function()
		if setclipboard then
			setclipboard(url)
		end
	end)
	Utils.notify("Open this URL: " .. url, "StudioLink")
	warn("[StudioLink] Open this URL: " .. url)
	return false
end

function Utils.safeCall(summary, fn)
	local ok, result = pcall(fn)
	if not ok then
		Utils.notify(summary .. ": " .. tostring(result))
		return nil, result
	end
	return result, nil
end

function Utils.urlEncode(text)
	text = tostring(text or "")
	text = string.gsub(text, "\n", "\r\n")
	text = string.gsub(text, "([^%w%-%_%.%~])", function(char)
		return string.format("%%%02X", string.byte(char))
	end)
	return text
end

function Utils.timeAgo(isoOrSeconds)
	local seconds
	if type(isoOrSeconds) == "number" then
		seconds = os.time() - isoOrSeconds
	else
		seconds = 0
	end
	if seconds < 60 then
		return "just now"
	end
	if seconds < 3600 then
		return tostring(math.floor(seconds / 60)) .. " min ago"
	end
	if seconds < 86400 then
		return tostring(math.floor(seconds / 3600)) .. " hr ago"
	end
	return tostring(math.floor(seconds / 86400)) .. " days ago"
end

function Utils.trim(text)
	return tostring(text or ""):match("^%s*(.-)%s*$")
end

function Utils.clearChildren(parent)
	for _, child in ipairs(parent:GetChildren()) do
		if not child:IsA("UIListLayout") and not child:IsA("UIPadding") and not child:IsA("UICorner") and not child:IsA("UIStroke") and not child:IsA("UIGradient") and not child:IsA("UIScale") then
			child:Destroy()
		end
	end
end

function Utils.tween(gui, props, seconds)
	local tweenInfo = TweenInfo.new(seconds or 0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
	local tween = TweenService:Create(gui, tweenInfo, props)
	tween:Play()
	return tween
end

function Utils.ensureCorner(gui, radius)
	local corner = gui:FindFirstChildOfClass("UICorner") or Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius or 10)
	corner.Parent = gui
	return corner
end

function Utils.ensureStroke(gui, theme)
	local stroke = gui:FindFirstChildOfClass("UIStroke") or Instance.new("UIStroke")
	stroke.Color = theme.border
	stroke.Thickness = 1
	stroke.Transparency = theme.strokeTransparency or 0.25
	stroke.Parent = gui
	return stroke
end

function Utils.ensureScale(gui)
	local scale = gui:FindFirstChildOfClass("UIScale") or Instance.new("UIScale")
	scale.Scale = scale.Scale == 0 and 1 or scale.Scale
	scale.Parent = gui
	return scale
end

function Utils.ensureGradient(gui, theme)
	local gradient = gui:FindFirstChildOfClass("UIGradient") or Instance.new("UIGradient")
	gradient.Color = ColorSequence.new(theme.gradientTop or theme.surface or theme.panel, theme.gradientBottom or theme.panel)
	gradient.Rotation = 90
	gradient.Parent = gui
	return gradient
end

function Utils.stylePanel(frame, theme, variant)
	frame.BorderSizePixel = 0
	frame.BackgroundColor3 = variant == "alt" and theme.surfaceAlt or (variant == "toolbar" and theme.toolbar or theme.panel)
	Utils.ensureCorner(frame, variant == "large" and theme.radiusLarge or theme.radius)
	Utils.ensureStroke(frame, theme)
	if variant == "hero" or variant == "large" then
		Utils.ensureGradient(frame, theme)
	end
	return frame
end

function Utils.styleButton(button, theme, variant)
	local normalColor = variant == "primary" and theme.accent
		or (variant == "selected" and theme.buttonSelected)
		or (variant == "navSelected" and (theme.navButtonSelected or theme.buttonSelected))
		or (variant == "nav" and (theme.navButton or theme.button))
		or (variant == "changed" and theme.accentSoft)
		or (variant == "success" and theme.successSoft)
		or (variant == "warning" and Color3.fromRGB(math.floor((theme.yellow.R * 255 + theme.panel.R * 255) / 2), math.floor((theme.yellow.G * 255 + theme.panel.G * 255) / 2), math.floor((theme.yellow.B * 255 + theme.panel.B * 255) / 2)))
		or (variant == "danger" and theme.dangerSoft)
		or theme.button
	local hoverColor = (variant == "nav" or variant == "navSelected") and (theme.navButtonHover or theme.buttonHover or theme.buttonSelected) or (theme.buttonHover or theme.buttonSelected)
	local pressedColor = theme.buttonPressed or theme.accent
	button.AutoButtonColor = false
	button.BorderSizePixel = 0
	button.BackgroundColor3 = normalColor
	button.BackgroundTransparency = variant == "ghost" and 0.22 or 0
	button.TextColor3 = variant == "primary" and theme.background or theme.text
	button.Font = Enum.Font.Gotham
	button.TextSize = 12
	button:SetAttribute("StudioLinkNormalColor", normalColor)
	button:SetAttribute("StudioLinkHoverColor", hoverColor)
	button:SetAttribute("StudioLinkPressedColor", pressedColor)
	button:SetAttribute("StudioLinkNormalTransparency", button.BackgroundTransparency)
	local stroke = Utils.ensureStroke(button, theme)
	stroke.Color = variant == "primary" and (theme.buttonPrimaryBorder or theme.buttonBorder or theme.border) or (theme.buttonBorder or theme.border)
	stroke.Transparency = theme.buttonStrokeTransparency or theme.strokeTransparency or 0.25
	Utils.ensureCorner(button, theme.radius)
	if not button:GetAttribute("StudioLinkHoverBound") then
		button:SetAttribute("StudioLinkHoverBound", true)
		button.MouseEnter:Connect(function()
			local currentStroke = button:FindFirstChildOfClass("UIStroke")
			button.BackgroundColor3 = button:GetAttribute("StudioLinkHoverColor") or button.BackgroundColor3
			button.BackgroundTransparency = 0
			if currentStroke then currentStroke.Transparency = theme.buttonStrokeHoverTransparency or theme.strokeHoverTransparency or 0.18 end
		end)
		button.MouseLeave:Connect(function()
			local currentStroke = button:FindFirstChildOfClass("UIStroke")
			button.BackgroundColor3 = button:GetAttribute("StudioLinkNormalColor") or button.BackgroundColor3
			button.BackgroundTransparency = button:GetAttribute("StudioLinkNormalTransparency") or 0
			if currentStroke then currentStroke.Transparency = theme.buttonStrokeTransparency or theme.strokeTransparency or 0.25 end
		end)
		button.MouseButton1Down:Connect(function()
			button.BackgroundColor3 = button:GetAttribute("StudioLinkPressedColor") or button.BackgroundColor3
			button.BackgroundTransparency = 0
		end)
		button.MouseButton1Up:Connect(function()
			button.BackgroundColor3 = button:GetAttribute("StudioLinkHoverColor") or button.BackgroundColor3
		end)
	end
	return button
end

local function readableOn(color)
	local luminance = (0.2126 * color.R) + (0.7152 * color.G) + (0.0722 * color.B)
	if luminance > 0.55 then
		return Color3.fromRGB(8, 16, 24)
	end
	return Color3.fromRGB(245, 250, 255)
end

function Utils.makeCard(parent, theme, height, variant)
	local frame = Instance.new("Frame")
	frame.Size = UDim2.new(1, -8, 0, height)
	frame.Parent = parent
	Utils.stylePanel(frame, theme, variant or "large")
	return frame
end

function Utils.makePill(parent, text, color, theme)
	local pill = Instance.new("TextLabel")
	pill.BackgroundColor3 = color or theme.accentSoft
	pill.BorderSizePixel = 0
	pill.TextColor3 = readableOn(pill.BackgroundColor3)
	pill.Font = Enum.Font.GothamSemibold
	pill.TextSize = 11
	pill.Text = text or "PILL"
	pill.TextXAlignment = Enum.TextXAlignment.Center
	pill.Size = UDim2.new(0, math.max(58, #tostring(text or "PILL") * 7 + 18), 0, 22)
	Utils.ensureCorner(pill, 999)
	pill.Parent = parent
	return pill
end

local function destroyFadeOverlay(gui)
	local parent = gui and gui.Parent
	if not parent then
		return
	end
	local overlay = parent:FindFirstChild("StudioLinkFadeOverlay")
	if overlay then
		overlay:Destroy()
	end
end

local function makeFadeOverlay(gui)
	if not gui or not gui:IsA("GuiObject") or not gui.Parent then
		return nil
	end
	destroyFadeOverlay(gui)
	local overlay = Instance.new("Frame")
	overlay.Name = "StudioLinkFadeOverlay"
	overlay.AnchorPoint = gui.AnchorPoint
	overlay.Position = gui.Position
	overlay.Size = gui.Size
	overlay.BackgroundColor3 = gui.BackgroundColor3
	overlay.BorderSizePixel = 0
	overlay.ZIndex = 100000
	overlay.Active = true
	overlay.Parent = gui.Parent
	return overlay
end

function Utils.prepareFadeIn(gui)
	local overlay = makeFadeOverlay(gui)
	if overlay then
		overlay.BackgroundTransparency = 0
	end
end

function Utils.animateIn(gui, seconds, holdSeconds)
	local parent = gui and gui.Parent
	local overlay = parent and parent:FindFirstChild("StudioLinkFadeOverlay") or makeFadeOverlay(gui)
	if not overlay then
		return
	end
	seconds = seconds or 0.18
	holdSeconds = holdSeconds or 0.08
	overlay.BackgroundTransparency = 0
	task.delay(holdSeconds, function()
		if not overlay or not overlay.Parent then
			return
		end
		Utils.tween(overlay, { BackgroundTransparency = 1 }, seconds)
		task.delay(seconds, function()
			if overlay and overlay.Parent then
				overlay:Destroy()
			end
		end)
	end)
end

function Utils.animateOut(gui, onComplete, seconds)
	if not gui then
		if onComplete then
			onComplete()
		end
		return
	end
	seconds = seconds or 0.14
	local overlay = makeFadeOverlay(gui)
	if not overlay then
		if onComplete then
			onComplete()
		end
		return
	end
	overlay.BackgroundTransparency = 1
	Utils.tween(overlay, { BackgroundTransparency = 0 }, seconds)
	task.delay(seconds, function()
		if onComplete then
			onComplete()
		end
		if overlay and overlay.Parent then
			overlay:Destroy()
		end
	end)
end

function Utils.makeLabel(parent, text, size, theme, muted)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextYAlignment = Enum.TextYAlignment.Top
	label.Font = Enum.Font.Gotham
	label.TextSize = size or 14
	label.TextWrapped = true
	label.Text = text or ""
	label.TextColor3 = muted and theme.textMuted or theme.text
	label.Parent = parent
	return label
end

function Utils.makeButton(parent, text, theme, variant)
	local button = Instance.new("TextButton")
	button.Text = text or "Button"
	button.Parent = parent
	Utils.styleButton(button, theme, variant)
	return button
end

return Utils
