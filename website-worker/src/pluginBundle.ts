// Generated from plugin/StudioLinkPlugin_Bundled.lua.
export const PLUGIN_BUNDLE_VERSION = "1.0.8";
export const PLUGIN_BUNDLE = String.raw`-- StudioLink bundled Roblox Studio plugin
-- HTTP-primary build. Paste this whole file as a local plugin script.

local function load_Theme()
local Theme = {}

Theme.THEMES = {
	dark = {
		background = Color3.fromRGB(4, 8, 18),
		panel = Color3.fromRGB(9, 15, 28),
		surface = Color3.fromRGB(12, 22, 40),
		surfaceAlt = Color3.fromRGB(16, 30, 54),
		toolbar = Color3.fromRGB(5, 11, 22),
		button = Color3.fromRGB(16, 31, 55),
		buttonHover = Color3.fromRGB(36, 70, 104),
		buttonPressed = Color3.fromRGB(66, 116, 134),
		buttonSelected = Color3.fromRGB(42, 104, 132),
		accent = Color3.fromRGB(104, 164, 184),
		accentSoft = Color3.fromRGB(30, 64, 82),
		glow = Color3.fromRGB(128, 190, 180),
		dangerSoft = Color3.fromRGB(92, 26, 42),
		successSoft = Color3.fromRGB(18, 79, 53),
		text = Color3.fromRGB(220, 235, 240),
		textMuted = Color3.fromRGB(146, 170, 181),
		textWarning = Color3.fromRGB(255, 231, 91),
		textDanger = Color3.fromRGB(255, 107, 129),
		green = Color3.fromRGB(72, 196, 132),
		yellow = Color3.fromRGB(224, 190, 70),
		red = Color3.fromRGB(226, 92, 120),
		border = Color3.fromRGB(72, 116, 138),
		buttonBorder = Color3.fromRGB(54, 84, 102),
		buttonPrimaryBorder = Color3.fromRGB(76, 120, 132),
		buttonStrokeTransparency = 0.46,
		buttonStrokeHoverTransparency = 0.34,
		gradientTop = Color3.fromRGB(12, 42, 68),
		gradientBottom = Color3.fromRGB(3, 7, 16),
		radius = 4,
		radiusLarge = 8,
		strokeTransparency = 0.18,
		strokeHoverTransparency = 0.1,
	},
	light = {
		background = Color3.fromRGB(242, 244, 248),
		panel = Color3.fromRGB(252, 253, 255),
		surface = Color3.fromRGB(247, 249, 252),
		surfaceAlt = Color3.fromRGB(235, 239, 245),
		toolbar = Color3.fromRGB(232, 236, 243),
		button = Color3.fromRGB(238, 242, 248),
		buttonHover = Color3.fromRGB(225, 232, 242),
		buttonPressed = Color3.fromRGB(211, 222, 236),
		buttonSelected = Color3.fromRGB(204, 222, 244),
		accent = Color3.fromRGB(44, 112, 196),
		accentSoft = Color3.fromRGB(221, 233, 248),
		glow = Color3.fromRGB(114, 151, 198),
		dangerSoft = Color3.fromRGB(250, 226, 231),
		successSoft = Color3.fromRGB(224, 242, 232),
		text = Color3.fromRGB(29, 37, 50),
		textMuted = Color3.fromRGB(94, 106, 124),
		textWarning = Color3.fromRGB(139, 88, 18),
		textDanger = Color3.fromRGB(176, 45, 71),
		green = Color3.fromRGB(20, 137, 83),
		yellow = Color3.fromRGB(188, 133, 35),
		red = Color3.fromRGB(207, 75, 96),
		border = Color3.fromRGB(177, 188, 204),
		gradientTop = Color3.fromRGB(255, 255, 255),
		gradientBottom = Color3.fromRGB(239, 243, 248),
		radius = 4,
		radiusLarge = 8,
		strokeTransparency = 0.48,
		strokeHoverTransparency = 0.35,
	},
	roblox_studio = {
		background = Color3.fromRGB(46, 46, 46),
		panel = Color3.fromRGB(56, 56, 56),
		surface = Color3.fromRGB(62, 62, 62),
		surfaceAlt = Color3.fromRGB(70, 70, 70),
		toolbar = Color3.fromRGB(38, 38, 38),
		button = Color3.fromRGB(66, 66, 66),
		buttonHover = Color3.fromRGB(82, 82, 82),
		buttonPressed = Color3.fromRGB(39, 105, 170),
		buttonSelected = Color3.fromRGB(35, 94, 150),
		navButton = Color3.fromRGB(50, 50, 50),
		navButtonHover = Color3.fromRGB(60, 60, 60),
		navButtonSelected = Color3.fromRGB(32, 82, 130),
		accent = Color3.fromRGB(0, 162, 255),
		accentSoft = Color3.fromRGB(48, 84, 112),
		glow = Color3.fromRGB(91, 183, 255),
		dangerSoft = Color3.fromRGB(96, 45, 50),
		successSoft = Color3.fromRGB(43, 92, 66),
		text = Color3.fromRGB(235, 235, 235),
		textMuted = Color3.fromRGB(184, 184, 184),
		textWarning = Color3.fromRGB(255, 206, 87),
		textDanger = Color3.fromRGB(255, 118, 118),
		green = Color3.fromRGB(85, 190, 115),
		yellow = Color3.fromRGB(234, 181, 73),
		red = Color3.fromRGB(218, 88, 91),
		border = Color3.fromRGB(96, 96, 96),
		buttonBorder = Color3.fromRGB(82, 82, 82),
		buttonPrimaryBorder = Color3.fromRGB(70, 112, 142),
		buttonStrokeTransparency = 0.44,
		buttonStrokeHoverTransparency = 0.32,
		gradientTop = Color3.fromRGB(64, 64, 64),
		gradientBottom = Color3.fromRGB(48, 48, 48),
		radius = 3,
		radiusLarge = 6,
		strokeTransparency = 0.28,
		strokeHoverTransparency = 0.18,
	},
	vscode_dark = {
		background = Color3.fromRGB(30, 30, 30),
		panel = Color3.fromRGB(37, 37, 38),
		surface = Color3.fromRGB(45, 45, 48),
		surfaceAlt = Color3.fromRGB(51, 51, 55),
		toolbar = Color3.fromRGB(24, 24, 24),
		button = Color3.fromRGB(55, 55, 60),
		buttonHover = Color3.fromRGB(70, 70, 78),
		buttonPressed = Color3.fromRGB(0, 122, 204),
		buttonSelected = Color3.fromRGB(37, 91, 130),
		accent = Color3.fromRGB(0, 122, 204),
		accentSoft = Color3.fromRGB(31, 70, 98),
		glow = Color3.fromRGB(55, 148, 220),
		dangerSoft = Color3.fromRGB(86, 42, 48),
		successSoft = Color3.fromRGB(38, 82, 58),
		text = Color3.fromRGB(220, 220, 220),
		textMuted = Color3.fromRGB(160, 160, 160),
		textWarning = Color3.fromRGB(220, 180, 70),
		textDanger = Color3.fromRGB(244, 112, 122),
		green = Color3.fromRGB(89, 190, 114),
		yellow = Color3.fromRGB(214, 176, 80),
		red = Color3.fromRGB(224, 92, 105),
		border = Color3.fromRGB(86, 86, 94),
		buttonBorder = Color3.fromRGB(72, 72, 80),
		buttonPrimaryBorder = Color3.fromRGB(40, 100, 145),
		buttonStrokeTransparency = 0.48,
		buttonStrokeHoverTransparency = 0.36,
		gradientTop = Color3.fromRGB(43, 43, 46),
		gradientBottom = Color3.fromRGB(30, 30, 30),
		radius = 3,
		radiusLarge = 6,
		strokeTransparency = 0.3,
		strokeHoverTransparency = 0.18,
	},
	high_contrast = {
		background = Color3.fromRGB(0, 0, 0),
		panel = Color3.fromRGB(10, 10, 10),
		surface = Color3.fromRGB(18, 18, 18),
		surfaceAlt = Color3.fromRGB(28, 28, 28),
		toolbar = Color3.fromRGB(0, 0, 0),
		button = Color3.fromRGB(22, 22, 22),
		buttonHover = Color3.fromRGB(45, 45, 45),
		buttonPressed = Color3.fromRGB(255, 214, 10),
		buttonSelected = Color3.fromRGB(0, 86, 179),
		accent = Color3.fromRGB(0, 174, 255),
		accentSoft = Color3.fromRGB(0, 63, 102),
		glow = Color3.fromRGB(255, 255, 255),
		dangerSoft = Color3.fromRGB(102, 0, 24),
		successSoft = Color3.fromRGB(0, 82, 40),
		text = Color3.fromRGB(255, 255, 255),
		textMuted = Color3.fromRGB(210, 210, 210),
		textWarning = Color3.fromRGB(255, 214, 10),
		textDanger = Color3.fromRGB(255, 90, 120),
		green = Color3.fromRGB(0, 255, 127),
		yellow = Color3.fromRGB(255, 214, 10),
		red = Color3.fromRGB(255, 70, 100),
		border = Color3.fromRGB(255, 255, 255),
		buttonBorder = Color3.fromRGB(110, 110, 110),
		buttonPrimaryBorder = Color3.fromRGB(90, 130, 150),
		buttonStrokeTransparency = 0.52,
		buttonStrokeHoverTransparency = 0.38,
		gradientTop = Color3.fromRGB(18, 18, 18),
		gradientBottom = Color3.fromRGB(0, 0, 0),
		radius = 2,
		radiusLarge = 4,
		strokeTransparency = 0.02,
		strokeHoverTransparency = 0,
	},
	terminal = {
		background = Color3.fromRGB(0, 0, 0),
		panel = Color3.fromRGB(2, 10, 6),
		surface = Color3.fromRGB(5, 18, 11),
		surfaceAlt = Color3.fromRGB(8, 31, 17),
		toolbar = Color3.fromRGB(0, 8, 4),
		button = Color3.fromRGB(5, 28, 13),
		buttonHover = Color3.fromRGB(24, 72, 38),
		buttonPressed = Color3.fromRGB(42, 94, 50),
		buttonSelected = Color3.fromRGB(66, 132, 82),
		accent = Color3.fromRGB(132, 190, 124),
		accentSoft = Color3.fromRGB(24, 70, 34),
		glow = Color3.fromRGB(166, 218, 128),
		dangerSoft = Color3.fromRGB(86, 18, 20),
		successSoft = Color3.fromRGB(13, 82, 31),
		text = Color3.fromRGB(210, 232, 206),
		textMuted = Color3.fromRGB(132, 178, 132),
		textWarning = Color3.fromRGB(224, 208, 94),
		textDanger = Color3.fromRGB(226, 102, 102),
		green = Color3.fromRGB(112, 198, 104),
		yellow = Color3.fromRGB(224, 208, 94),
		red = Color3.fromRGB(226, 94, 94),
		border = Color3.fromRGB(92, 150, 92),
		buttonBorder = Color3.fromRGB(58, 104, 62),
		buttonPrimaryBorder = Color3.fromRGB(96, 132, 88),
		buttonStrokeTransparency = 0.46,
		buttonStrokeHoverTransparency = 0.34,
		gradientTop = Color3.fromRGB(8, 44, 18),
		gradientBottom = Color3.fromRGB(0, 0, 0),
		radius = 3,
		radiusLarge = 6,
		strokeTransparency = 0.2,
		strokeHoverTransparency = 0.12,
	},
}

Theme.ORDER = { "dark", "roblox_studio", "vscode_dark", "light", "high_contrast", "terminal" }
Theme.activeName = "dark"
Theme.changedCallbacks = {}

function Theme.isValid(name)
	return Theme.THEMES[name] ~= nil
end

function Theme.init(plugin)
	local saved = plugin and plugin:GetSetting("theme")
	if Theme.isValid(saved) then
		Theme.activeName = saved
	end
end

function Theme.get()
	return Theme.THEMES[Theme.activeName] or Theme.THEMES.dark
end

function Theme.name()
	return Theme.activeName
end

function Theme.set(plugin, name)
	if not Theme.isValid(name) then
		name = "dark"
	end
	Theme.activeName = name
	if plugin then
		plugin:SetSetting("theme", name)
	end
	for _, callback in ipairs(Theme.changedCallbacks) do
		pcall(callback, Theme.get(), name)
	end
end

function Theme.toggle(plugin)
	local index = 1
	for i, name in ipairs(Theme.ORDER) do
		if name == Theme.activeName then
			index = i
			break
		end
	end
	Theme.set(plugin, Theme.ORDER[(index % #Theme.ORDER) + 1])
end

function Theme.onChanged(callback)
	table.insert(Theme.changedCallbacks, callback)
end

function Theme.applyFrame(frame, key)
	local theme = Theme.get()
	frame.BackgroundColor3 = theme[key or "panel"]
	frame.BorderColor3 = theme.border
end

function Theme.applyText(label, muted)
	local theme = Theme.get()
	label.TextColor3 = muted and theme.textMuted or theme.text
	label.BackgroundTransparency = 1
end

return Theme
end

local function load_Utils()
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
end

local function load_ConnectionManager()
local HttpService = game:GetService("HttpService")

local ConnectionManager = {}
ConnectionManager.__index = ConnectionManager

local DEFAULT_HTTP_URL = "http://127.0.0.1:45678"
local BACKOFF_MAX = 30

function ConnectionManager.new(options)
	local self = setmetatable({}, ConnectionManager)
	self.plugin = options.plugin
	self.utils = options.utils
	self.placeId = options.placeId or tostring(game.PlaceId or 0)
	self.placeInfo = options.placeInfo or {}
	self.pluginVersion = options.pluginVersion or "1.0.0"
	self.httpUrl = options.httpUrl or DEFAULT_HTTP_URL
	self.mode = "http"
	self.connected = false
	self.connecting = false
	self.stopped = false
	self.polling = false
	self.backoff = 1
	self.pending = {}
	self.callbacks = {}
	self.statusCallbacks = {}
	self.scriptQueue = {}
	self.lastHealth = nil
	self.lastUpdateStatus = nil
	return self
end

function ConnectionManager:_notify(message)
	if self.utils and self.utils.notify then
		self.utils.notify(message)
	else
		warn("[StudioLink] " .. tostring(message))
	end
end

function ConnectionManager:_token()
	local token = self.plugin and self.plugin:GetSetting("authToken")
	if type(token) == "string" and token ~= "" then
		return token
	end
	return nil
end

function ConnectionManager:_setToken(token)
	if self.plugin and type(token) == "string" and token ~= "" then
		self.plugin:SetSetting("authToken", token)
	end
end

function ConnectionManager:_clearToken()
	if self.plugin then
		self.plugin:SetSetting("authToken", "")
	end
end

function ConnectionManager:_fetchAuthToken()
	local ok, result = pcall(function()
		return HttpService:GetAsync(self.httpUrl .. "/auth-token", false)
	end)
	if not ok then
		return false, result
	end
	local decoded = self.utils.decodeJson(result)
	if type(decoded) == "table" and type(decoded.token) == "string" and decoded.token ~= "" then
		self:_setToken(decoded.token)
		return true
	end
	return false, "Auth token response missing token"
end

function ConnectionManager:_buildHttpPath(path)
	local token = self:_token()
	local separator = string.find(path, "?", 1, true) and "&" or "?"
	if type(token) == "string" and token ~= "" then
		return self.httpUrl .. path .. separator .. "token=" .. self.utils.urlEncode(token)
	end
	return self.httpUrl .. path
end

function ConnectionManager:_setStatus(state, details)
	self.status = state
	for _, callback in ipairs(self.statusCallbacks) do
		pcall(callback, state, details or {})
	end
end

function ConnectionManager:onStatus(callback)
	table.insert(self.statusCallbacks, callback)
end

function ConnectionManager:on(messageType, callback)
	self.callbacks[messageType] = self.callbacks[messageType] or {}
	table.insert(self.callbacks[messageType], callback)
end

function ConnectionManager:_fire(messageType, payload, envelope)
	for _, callback in ipairs(self.callbacks[messageType] or {}) do
		local ok, err = pcall(callback, payload or {}, envelope)
		if not ok then
			self:_notify("Handler failed for " .. tostring(messageType) .. ": " .. tostring(err))
		end
	end
end

function ConnectionManager:_payload(payload)
	payload = payload or {}
	if next(payload) == nil then
		payload = { __empty = true }
	end
	return payload
end

function ConnectionManager:_envelope(messageType, payload)
	return {
		version = "1",
		type = messageType,
		requestId = self.utils.uuid(),
		placeId = self.placeId,
		payload = self:_payload(payload),
	}
end

function ConnectionManager:_handleEnvelope(envelope)
	if type(envelope) ~= "table" then
		self:_notify("Received invalid daemon message")
		return
	end
	local payload = envelope.payload or {}
	local isError = envelope.type == "error" or envelope.type == "license:error"
	local requestId = envelope.requestId
	local pending = requestId and self.pending[requestId]
	if pending then
		self.pending[requestId] = nil
		if isError then
			self:_notify(tostring(payload.message or payload.code or "Daemon request failed"))
			self:_fire("error", payload, envelope)
			return
		end
		local ok, err = pcall(pending, payload, envelope)
		if not ok then
			self:_notify("Response handler failed: " .. tostring(err))
		end
		return
	end
	if isError then
		self:_notify(tostring(payload.message or payload.code or "Daemon error"))
		self:_fire("error", payload, envelope)
		return
	end
	self:_fire(envelope.type, payload, envelope)
end

function ConnectionManager:_postRpc(encoded)
	return pcall(function()
		return HttpService:PostAsync(self:_buildHttpPath("/rpc"), encoded, Enum.HttpContentType.ApplicationJson, false)
	end)
end

function ConnectionManager:_isUnauthorized(errorText)
	errorText = tostring(errorText or "")
	return string.find(errorText, "401", 1, true) ~= nil or string.find(string.lower(errorText), "unauthorized", 1, true) ~= nil
end

function ConnectionManager:_rawSend(envelope)
	local encoded = self.utils.encodeJson(envelope)
	local ok, result = self:_postRpc(encoded)
	if not ok and self:_isUnauthorized(result) then
		self:_clearToken()
		local refreshed = self:_fetchAuthToken()
		if refreshed then
			ok, result = self:_postRpc(encoded)
		end
	end
	if not ok then
		return false, result
	end
	self:_handleEnvelope(self.utils.decodeJson(result))
	return true
end

function ConnectionManager:postLocal(path, payload)
	if not self:_token() then
		self:_fetchAuthToken()
	end
	local encoded = self.utils.encodeJson(self:_payload(payload or {}))
	local function post()
		return pcall(function()
			return HttpService:PostAsync(self:_buildHttpPath(path), encoded, Enum.HttpContentType.ApplicationJson, false)
		end)
	end
	local ok, result = post()
	if not ok and self:_isUnauthorized(result) then
		self:_clearToken()
		local refreshed = self:_fetchAuthToken()
		if refreshed then
			ok, result = post()
		end
	end
	if not ok then
		self:_notify("Local daemon action failed: " .. tostring(result))
		return false, result
	end
	return true, self.utils.decodeJson(result)
end

function ConnectionManager:daemonAction(path, payload, callback)
	local ok, decoded = self:postLocal(path, payload or {})
	if not ok then
		if callback then pcall(callback, false, decoded) end
		return false, decoded
	end
	local success = decoded == nil or decoded.success ~= false
	local result = decoded and decoded.result or decoded
	if callback then pcall(callback, success, result or decoded) end
	return success, result
end

function ConnectionManager:send(messageType, payload, callback, options)
	options = options or {}
	local envelope = self:_envelope(messageType, payload)
	if callback then
		self.pending[envelope.requestId] = callback
	end
	local ok, err = self:_rawSend(envelope)
	if not ok then
		self.pending[envelope.requestId] = nil
		if options.queueIfDisconnected then
			table.insert(self.scriptQueue, { type = messageType, payload = payload })
		else
			self:_notify("Unable to send " .. tostring(messageType) .. ": " .. tostring(err))
		end
		return nil, err
	end
	return envelope.requestId
end

function ConnectionManager:sendScriptEvent(messageType, payload)
	return self:send(messageType, payload, nil, { queueIfDisconnected = true })
end

function ConnectionManager:restartDaemon(callback)
	if not self:_token() then
		self:_fetchAuthToken()
	end
	local function postRestart()
		return pcall(function()
			return HttpService:PostAsync(self:_buildHttpPath("/daemon/restart"), "{}", Enum.HttpContentType.ApplicationJson, false)
		end)
	end
	local ok, result = postRestart()
	if not ok and self:_isUnauthorized(result) then
		self:_clearToken()
		local refreshed = self:_fetchAuthToken()
		if refreshed then
			ok, result = postRestart()
		end
	end
	if not ok then
		self:_notify("Unable to restart daemon: " .. tostring(result))
		if callback then
			pcall(callback, false, result)
		end
		return false, result
	end
	self.connected = false
	self.connecting = false
	self.polling = false
	self:_setStatus("reconnecting", { delay = 2, restarting = true })
	if callback then
		pcall(callback, true, self.utils.decodeJson(result))
	end
	task.delay(2, function()
		if not self.stopped then
			self:connect()
		end
	end)
	return true
end

function ConnectionManager:_flushScriptQueue()
	local queued = self.scriptQueue
	self.scriptQueue = {}
	for _, item in ipairs(queued) do
		self:sendScriptEvent(item.type, item.payload)
	end
end

function ConnectionManager:_checkUpdates()
	local ok, decoded = self:postLocal("/daemon/update/check", {})
	if not ok then
		return false, decoded
	end
	local payload = decoded and (decoded.result or decoded)
	if type(payload) == "table" then
		self.lastUpdateStatus = payload
		self:_fire("update:status", payload)
		return true
	end
	return false, "Invalid update response"
end

function ConnectionManager:_afterConnect()
	self.backoff = 1
	self:_setStatus("connected", { health = self.lastHealth })
	self:send("watch:subscribe", {
		includeSource = true,
		pluginVersion = self.pluginVersion,
		placeName = self.placeInfo.placeName,
		gameId = self.placeInfo.gameId,
		jobId = self.placeInfo.jobId,
	})
	self:pollFast()
	self:_flushScriptQueue()
	self:_startPolling()
end

function ConnectionManager:pollFast()
	self:send("script:list", { includeSource = true, includeDeleted = true }, function(payload)
		self:_fire("script:list:response", payload)
	end)
	self:send("agent:recentActions", {}, function(payload)
		self:_fire("agent:recentActions:response", payload)
	end)
	self:send("daemon:health", {}, function(payload)
		self.lastHealth = payload
		self:_fire("daemon:health:response", payload)
		self:_setStatus("connected", { health = payload })
	end)
	self:send("git:status", {}, function(payload)
		self:_fire("git:status:response", payload)
	end)
	self:send("agent:status", {}, function(payload)
		self:_fire("agent:status:response", payload)
	end)
	self:send("license:status", {}, function(payload)
		self:_fire("license:status:response", payload)
	end)
end

function ConnectionManager:_startPolling()
	if self.polling then
		return
	end
	self.polling = true
	task.spawn(function()
		local tickCount = 0
		while self.polling and not self.stopped do
			tickCount = tickCount + 1
			self:send("script:list", { includeSource = true, includeDeleted = true }, function(payload)
				self:_fire("script:list:response", payload)
			end)
			if tickCount % 2 == 0 then
				self:send("agent:recentActions", {}, function(payload)
					self:_fire("agent:recentActions:response", payload)
				end)
			end
			if tickCount % 60 == 0 then
				self:_checkUpdates()
			end
			if tickCount % 4 == 0 then
				self:send("daemon:health", {}, function(payload)
					self.lastHealth = payload
					self:_fire("daemon:health:response", payload)
					self:_setStatus("connected", { health = payload })
				end)
				self:send("git:status", {}, function(payload)
					self:_fire("git:status:response", payload)
				end)
				self:send("agent:status", {}, function(payload)
					self:_fire("agent:status:response", payload)
				end)
				self:send("license:status", {}, function(payload)
					self:_fire("license:status:response", payload)
				end)
			end
			task.wait(1)
		end
	end)
end

function ConnectionManager:_scheduleReconnect()
	if self.stopped then
		return
	end
	self.connected = false
	self.connecting = false
	self.polling = false
	self:_setStatus("reconnecting", { delay = self.backoff })
	local delaySeconds = self.backoff
	self.backoff = math.min(self.backoff * 2, BACKOFF_MAX)
	task.delay(delaySeconds, function()
		self:connect()
	end)
end

function ConnectionManager:connect()
	if self.stopped or self.connecting or self.connected then
		return
	end
	self.connecting = true
	self:_setStatus("reconnecting", {})
	local ok, result = pcall(function()
		return HttpService:GetAsync(self.httpUrl .. "/health", false)
	end)
	if not ok then
		self:_notify("StudioLink cannot reach daemon over HTTP: " .. tostring(result))
		self:_scheduleReconnect()
		return
	end
	self.connected = true
	self.connecting = false
	self.lastHealth = self.utils.decodeJson(result)
	local tokenOk, tokenErr = self:_fetchAuthToken()
	if not tokenOk then
		self:_notify("StudioLink connected, but auth token refresh failed: " .. tostring(tokenErr))
	end
	self:_notify("StudioLink connected over HTTP")
	self:_checkUpdates()
	self:_afterConnect()
end

function ConnectionManager:disconnect()
	self.stopped = true
	self.connected = false
	self.polling = false
	self:_setStatus("disconnected", {})
end

return ConnectionManager
end

local function load_Home()
local Players = game:GetService("Players")

local Home = {}
Home.__index = Home

local PAGES = {
	{ key = "home", label = "Home", icon = "⌂" },
	{ key = "history", label = "History", icon = "◷" },
	{ key = "github", label = "Github", icon = "GH" },
	{ key = "settings", label = "Settings", icon = "⚙" },
	{ key = "logs", label = "Logs", icon = "≡" },
}

local function luminance(color)
	return (0.2126 * color.R) + (0.7152 * color.G) + (0.0722 * color.B)
end

local function codePalette(theme)
	if luminance(theme.background) < 0.48 then
		return Color3.fromRGB(13, 17, 23), Color3.fromRGB(232, 238, 247), Color3.fromRGB(107, 203, 127), Color3.fromRGB(255, 123, 114)
	end
	return Color3.fromRGB(248, 250, 252), Color3.fromRGB(20, 27, 37), Color3.fromRGB(17, 128, 73), Color3.fromRGB(190, 38, 66)
end

local function classIcon(className)
	if className == "ModuleScript" then return "◇" end
	if className == "LocalScript" then return "◐" end
	return "●"
end

local function splitPath(path)
	local parts = {}
	for part in string.gmatch(tostring(path or ""), "[^%.]+") do
		table.insert(parts, part)
	end
	return parts
end

local function initials(value)
	value = tostring(value or "?")
	local out = ""
	for word in string.gmatch(value, "[%w_]+") do
		out = out .. string.sub(word, 1, 1)
		if #out >= 2 then break end
	end
	return string.upper(out ~= "" and out or "?")
end

local function listSignature(list, fields, keepOrder)
	local chunks = {}
	for _, item in ipairs(list or {}) do
		local parts = {}
		for _, field in ipairs(fields) do
			table.insert(parts, tostring(item[field] or ""))
		end
		table.insert(chunks, table.concat(parts, ":"))
	end
	if not keepOrder then table.sort(chunks) end
	return table.concat(chunks, "|")
end

function Home.new(plugin, manager, Theme, Utils, callbacks)
	local self = setmetatable({}, Home)
	self.plugin = plugin
	self.manager = manager
	self.Theme = Theme
	self.Utils = Utils
	self.callbacks = callbacks or {}
	self.page = tostring(plugin:GetSetting("mainPage") or "home")
	self.connectionState = "disconnected"
	self.health = nil
	self.gitStatus = nil
	self.githubStatus = nil
	self.githubDevice = nil
	self.githubMessage = nil
	self.agentStatus = nil
	self.licenseStatus = nil
	self.updateStatus = nil
	self.autostartStatus = nil
	self.maintenanceMessage = nil
	self.scripts = {}
	self.deleted = {}
	self.historyVersions = {}
	self.commits = {}
	self.actions = {}
	self.scriptSearch = ""
	self.commitMessage = ""
	self.confirmation = nil
	self.historyMode = "existing"
	self.selectedScript = nil
	self.selectedScriptRecord = nil
	self.selectedVersion = nil
	self.selectedDeleted = nil
	self.previewTitle = "Select a script"
	self.previewText = "Pick a script to see its latest saved version, deleted preview, or restore options."
	self.expandedFolders = plugin:GetSetting("historyExpandedFolders") or {}
	self.historyListCanvasPosition = Vector2.new(0, 0)
	self.previewCanvasPosition = Vector2.new(0, 0)
	self.versionsCanvasPosition = Vector2.new(0, 0)
	self.historyRenderScheduled = false
	self.searchFocused = false
	self.pendingHistoryRender = false
	self.scriptListSignature = ""
	self.deletedListSignature = ""
	self.commitListSignature = ""
	self.hasOpenedOnce = false
	self.lastRefreshAt = 0
	self.statusRenderScheduled = false
	self.suppressStatusRenderUntil = 0
	self.firstLaunch = not plugin:GetSetting("hasConnectedBefore")

	manager:onStatus(function(state, details)
		local changed = self.connectionState ~= state
		self.connectionState = state
		self.health = details and details.health or self.health
		if changed then self:renderForBackgroundStatus() end
	end)
	local function bind(messageType, fn, silent)
		manager:on(messageType, function(payload)
			fn(payload or {})
			if not silent then
				self:renderPreservingHistory()
			end
		end)
	end
	bind("daemon:health:response", function(payload) self.health = payload end, true)
	bind("git:status:response", function(payload) self.gitStatus = payload end, true)
	bind("git:githubStatus:response", function(payload) self.githubStatus = payload end, true)
	bind("git:githubConfigure:response", function(payload) self.githubStatus = payload end)
	bind("git:githubDeviceStart:response", function(payload)
		self.githubDevice = payload
		self.githubMessage = "Enter code " .. tostring(payload.userCode or "") .. " on GitHub."
	end)
	bind("git:githubDevicePoll:response", function(payload)
		if payload.authorized then
			self.githubStatus = payload
			self.githubDevice = nil
			self.githubMessage = "Signed in. Create repo when ready."
		else
			self.githubMessage = payload.pending and "Waiting for GitHub approval..." or tostring(payload.message or payload.error or "Sign-in failed")
		end
	end)
	bind("git:autoRemote:response", function(payload)
		self.gitStatus = self.gitStatus or {}
		self.gitStatus.remoteUrl = payload.url
		self.gitStatus.githubRepo = payload.repo or self.gitStatus.githubRepo
		self.gitStatus.githubRepoHtmlUrl = payload.htmlUrl or self.gitStatus.githubRepoHtmlUrl
		self.githubMessage = "Repo ready: " .. tostring(payload.repo or payload.url or "GitHub remote")
	end)
	bind("agent:status:response", function(payload) self.agentStatus = payload end, true)
	bind("license:status:response", function(payload) self.licenseStatus = payload end, true)
	bind("update:status", function(payload) self.updateStatus = payload end, true)
	bind("script:list:response", function(payload) self:updateScripts(payload.scripts or {}) end, true)
	bind("history:getDeleted:response", function(payload) self:updateDeleted(payload.scripts or {}) end, true)
	bind("history:get:response", function(payload)
		self.historyVersions = payload.versions or {}
		self.previewTitle = tostring(payload.path or self.selectedScript or "Script history")
		if #self.historyVersions > 0 then
			local latest = self.historyVersions[#self.historyVersions]
			self.previewText = tostring(latest.source or "Source hidden for this version.")
		else
			self.previewText = "No saved versions yet."
		end
	end)
	bind("git:log:response", function(payload) self:updateCommits(payload.commits or {}) end, true)
	bind("agent:recentActions:response", function(payload) self.actions = payload.actions or {} end, true)
	manager:on("agent:action", function(payload)
		table.insert(self.actions, 1, payload)
		while #self.actions > 100 do table.remove(self.actions) end
		self:renderForBackgroundStatus()
	end)
	manager:on("error", function(payload)
		table.insert(self.actions, 1, { timestamp = "now", tool = "error", summary = tostring(payload.message or payload.code or "Daemon error"), error = true })
		self:renderForBackgroundStatus()
	end)
	for _, messageType in ipairs({ "script:create:response", "script:write:response", "script:delete:response", "script:rename:response", "script:restore:response", "script:cleanupStale:response" }) do
		manager:on(messageType, function()
			self:refreshHistory()
		end)
	end
	Theme.onChanged(function() self:renderPreservingHistory() end)
	return self
end

function Home:createWidget()
	if self.widget then return end
	local info = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, false, false, 1040, 680, 700, 460)
	self.widget = self.plugin:CreateDockWidgetPluginGui("StudioLinkHome", info)
	self.widget.Title = "StudioLink"
	pcall(function() self.widget.ZIndexBehavior = Enum.ZIndexBehavior.Sibling end)
	self.widget:GetPropertyChangedSignal("Enabled"):Connect(function()
		if not self.widget.Enabled and self.callbacks.onClosed then self.callbacks.onClosed() end
	end)
	local theme = self.Theme.get()
	self.root = Instance.new("Frame")
	self.root.Name = "Root"
	self.root.Size = UDim2.fromScale(1, 1)
	self.root.BackgroundColor3 = theme.background
	self.root.BackgroundTransparency = 0
	self.root.BorderSizePixel = 0
	self.root.Parent = self.widget
	self:render()
end

function Home:softPageFlash()
	if not self.root then return end
	local theme = self.Theme.get()
	local overlay = Instance.new("Frame")
	overlay.Name = "PageTransitionOverlay"
	overlay.Size = UDim2.fromScale(1, 1)
	overlay.BackgroundColor3 = theme.background
	overlay.BackgroundTransparency = 0.94
	overlay.BorderSizePixel = 0
	overlay.ZIndex = 900000
	overlay.Active = false
	overlay.Parent = self.root
	self.Utils.tween(overlay, { BackgroundTransparency = 1 }, 0.07)
	task.delay(0.07, function()
		if overlay and overlay.Parent then overlay:Destroy() end
	end)
end

function Home:setPage(page)
	page = page or "home"
	if self.page == page and self.widget and self.widget.Enabled then return end
	self.page = page
	if self.plugin then self.plugin:SetSetting("mainPage", self.page) end
	self:renderPreservingHistory()
	if self.widget and self.widget.Enabled then
		self:softPageFlash()
		self.suppressStatusRenderUntil = os.clock() + 0.25
		task.delay(0.3, function()
			if self.widget and self.widget.Enabled and self.page == page then
				self:refreshPage(false)
			end
		end)
	end
end

function Home:open(page)
	self:createWidget()
	local targetPage = page or self.page or "home"
	local firstOpen = not self.hasOpenedOnce
	local pageChanged = self.page ~= targetPage
	self.page = targetPage
	if self.plugin then self.plugin:SetSetting("mainPage", self.page) end
	if pageChanged or not self.renderedOnce or not self.root or #self.root:GetChildren() == 0 then
		self:renderPreservingHistory()
	end
	self.suppressStatusRenderUntil = os.clock() + 0.35
	self.widget.Enabled = true
	self.hasOpenedOnce = true
	local now = os.clock()
	if firstOpen or pageChanged or now - (self.lastRefreshAt or 0) > 2.5 then
		self.lastRefreshAt = now
		task.delay(0.42, function()
			if self.widget and self.widget.Enabled and self.page == targetPage then
				self:refreshPage(false)
			end
		end)
	end
end

function Home:close()
	if self.widget then self.widget.Enabled = false end
end

function Home:refreshPage(all)
	self.manager:send("daemon:health", {}, function(payload) self.health = payload; self:renderForBackgroundStatus() end)
	self.manager:send("git:status", {}, function(payload) self.gitStatus = payload; self:renderForBackgroundStatus() end)
	self.manager:send("git:githubStatus", {}, function(payload) self.githubStatus = payload; self:renderForBackgroundStatus() end)
	self.manager:send("agent:status", {}, function(payload) self.agentStatus = payload; self:renderForBackgroundStatus() end)
	if all or self.page == "history" then self:refreshHistory() end
	if all or self.page == "logs" then self.manager:send("agent:recentActions", {}, function(payload) self.actions = payload.actions or {}; self:renderForBackgroundStatus() end) end
	if all or self.page == "settings" then
		self.manager:send("license:status", {}, function(payload) self.licenseStatus = payload; self:renderForBackgroundStatus() end)
		if self.manager.daemonAction then
			self.manager:daemonAction("/daemon/autostart/status", {}, function(ok, payload) if ok then self.autostartStatus = payload end; self:renderForBackgroundStatus() end)
			self.manager:daemonAction("/daemon/update/check", {}, function(ok, payload) if ok then self.updateStatus = payload else self.maintenanceMessage = tostring(payload) end; self:renderForBackgroundStatus() end)
		end
	end
end

function Home:refreshHistory()
	self:captureHistoryState()
	self.manager:send("script:list", { includeSource = false, includeDeleted = true }, function(payload) self:updateScripts(payload.scripts or {}) end)
	self.manager:send("history:getDeleted", { includeSource = true }, function(payload) self:updateDeleted(payload.scripts or {}) end)
	self.manager:send("git:log", { limit = 50 }, function(payload) self:updateCommits(payload.commits or {}) end)
end

function Home:renderForBackgroundStatus()
	if self.page == "history" then return end
	if os.clock() < (self.suppressStatusRenderUntil or 0) then return end
	if self.statusRenderScheduled then return end
	self.statusRenderScheduled = true
	task.delay(0.18, function()
		self.statusRenderScheduled = false
		if self.widget and self.widget.Enabled and self.page ~= "history" and os.clock() >= (self.suppressStatusRenderUntil or 0) then
			self:renderPreservingHistory()
		end
	end)
end

function Home:scheduleHistoryRender()
	if self.page ~= "history" then
		self:renderPreservingHistory()
		return
	end
	if self.searchFocused then
		self.pendingHistoryRender = true
		return
	end
	if self.historyRenderScheduled then return end
	self.historyRenderScheduled = true
	task.delay(0.15, function()
		self.historyRenderScheduled = false
		if self.page == "history" then
			self:renderPreservingHistory()
		end
	end)
end

function Home:updateScripts(scripts)
	local signature = listSignature(scripts, { "path", "className", "versionId", "updatedAt", "deleted" })
	self.scripts = scripts
	if signature ~= self.scriptListSignature then
		self.scriptListSignature = signature
		self:scheduleHistoryRender()
	end
end

function Home:updateDeleted(deleted)
	local signature = listSignature(deleted, { "path", "className", "lastVersionId", "deletedAt", "size" })
	self.deleted = deleted
	if signature ~= self.deletedListSignature then
		self.deletedListSignature = signature
		self:scheduleHistoryRender()
	end
end

function Home:updateCommits(commits)
	local signature = listSignature(commits, { "hash", "message", "timestamp" }, true)
	self.commits = commits
	if signature ~= self.commitListSignature then
		self.commitListSignature = signature
		self:scheduleHistoryRender()
	end
end

function Home:captureHistoryState()
	if self.historyList then self.historyListCanvasPosition = self.historyList.CanvasPosition end
	if self.previewScroll then self.previewCanvasPosition = self.previewScroll.CanvasPosition end
	if self.versionList then self.versionsCanvasPosition = self.versionList.CanvasPosition end
end

function Home:restoreHistoryState()
	if self.page ~= "history" then return end
	task.defer(function()
		if self.historyList then self.historyList.CanvasPosition = self.historyListCanvasPosition or Vector2.new(0, 0) end
		if self.previewScroll then self.previewScroll.CanvasPosition = self.previewCanvasPosition or Vector2.new(0, 0) end
		if self.versionList then self.versionList.CanvasPosition = self.versionsCanvasPosition or Vector2.new(0, 0) end
	end)
end

function Home:renderPreservingHistory()
	self:captureHistoryState()
	self:render()
	self:restoreHistoryState()
end

function Home:clearContent()
	self.Utils.clearChildren(self.root)
end

function Home:makeIcon(parent, image, text, x, y, size)
	local theme = self.Theme.get()
	if image and image ~= "" then
		local icon = Instance.new("ImageLabel")
		icon.BackgroundTransparency = 1
		icon.Image = image
		icon.Position = UDim2.new(0, x, 0, y)
		icon.Size = UDim2.new(0, size, 0, size)
		icon.Parent = parent
		return icon
	end
	local fallback = self.Utils.makeLabel(parent, text or "", math.max(12, math.floor(size * 0.36)), theme)
	fallback.Font = Enum.Font.GothamBold
	fallback.TextXAlignment = Enum.TextXAlignment.Center
	fallback.TextYAlignment = Enum.TextYAlignment.Center
	fallback.Position = UDim2.new(0, x, 0, y)
	fallback.Size = UDim2.new(0, size, 0, size)
	return fallback
end

function Home:getRobloxThumbnail()
	local ok, content = pcall(function()
		local player = Players.LocalPlayer
		if not player or not player.UserId then return nil end
		return Players:GetUserThumbnailAsync(player.UserId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size420x420)
	end)
	if ok and type(content) == "string" and content ~= "" then return content end
	return nil
end

function Home:renderAvatar(parent, image, fallbackText, x, y, size)
	local theme = self.Theme.get()
	local frame = Instance.new("Frame")
	frame.Position = UDim2.new(0, x, 0, y)
	frame.Size = UDim2.new(0, size, 0, size)
	frame.BackgroundColor3 = theme.accentSoft
	frame.BorderSizePixel = 0
	frame.ClipsDescendants = true
	frame.Parent = parent
	self.Utils.ensureCorner(frame, 999)
	self.Utils.ensureStroke(frame, theme)
	local text = self.Utils.makeLabel(frame, fallbackText or "?", math.max(12, math.floor(size * 0.28)), theme)
	text.Font = Enum.Font.GothamBold
	text.TextXAlignment = Enum.TextXAlignment.Center
	text.TextYAlignment = Enum.TextYAlignment.Center
	text.Size = UDim2.fromScale(1, 1)
	if image and image ~= "" then
		local img = Instance.new("ImageLabel")
		img.BackgroundTransparency = 1
		img.Image = image
		img.Size = UDim2.fromScale(1, 1)
		img.Parent = frame
	end
	return frame
end

function Home:card(parent, title, pos, size, variant)
	local theme = self.Theme.get()
	local frame = Instance.new("Frame")
	frame.Position = pos
	frame.Size = size
	frame.Parent = parent
	self.Utils.stylePanel(frame, theme, variant or "large")
	local label = self.Utils.makeLabel(frame, title, 15, theme)
	label.Name = "CardTitle"
	label.Font = Enum.Font.GothamBold
	label.Position = UDim2.new(0, 14, 0, 12)
	label.Size = UDim2.new(1, -28, 0, 22)
	return frame, label
end

function Home:renderShell()
	local theme = self.Theme.get()
	self.root.BackgroundColor3 = theme.background
	local top = Instance.new("Frame")
	top.Name = "TopBar"
	top.Position = UDim2.new(0, 0, 0, 0)
	top.Size = UDim2.new(1, 0, 0, 54)
	top.Parent = self.root
	self.Utils.stylePanel(top, theme, "toolbar")
	self:renderAvatar(top, nil, "SL", 14, 11, 30)
	local title = self.Utils.makeLabel(top, "StudioLink", 19, theme)
	title.Font = Enum.Font.GothamBold
	title.Position = UDim2.new(0, 52, 0, 10)
	title.Size = UDim2.new(0, 180, 0, 26)
	local state = self.Utils.makePill(top, self.connectionState == "connected" and "Connected" or "Offline", self.connectionState == "connected" and theme.green or theme.red, theme)
	state.Position = UDim2.new(1, -112, 0, 16)

	local nav = Instance.new("Frame")
	nav.Name = "Nav"
	nav.Position = UDim2.new(0, 0, 0, 54)
	nav.Size = UDim2.new(0, 154, 1, -54)
	nav.Parent = self.root
	self.Utils.stylePanel(nav, theme, "alt")
	for i, page in ipairs(PAGES) do
		local button = self.Utils.makeButton(nav, "", theme, self.page == page.key and "navSelected" or "nav")
		button.Position = UDim2.new(0, 10, 0, 14 + ((i - 1) * 42))
		button.Size = UDim2.new(1, -20, 0, 34)
		button.MouseButton1Click:Connect(function() self:setPage(page.key) end)
		local icon = self.Utils.makeLabel(button, page.icon, 13, theme)
		icon.Font = Enum.Font.GothamBold
		icon.TextXAlignment = Enum.TextXAlignment.Center
		icon.TextYAlignment = Enum.TextYAlignment.Center
		icon.Position = UDim2.new(0, 8, 0, 0)
		icon.Size = UDim2.new(0, 24, 1, 0)
		local label = self.Utils.makeLabel(button, page.label, 12, theme)
		label.TextYAlignment = Enum.TextYAlignment.Center
		label.Position = UDim2.new(0, 38, 0, 0)
		label.Size = UDim2.new(1, -44, 1, 0)
	end

	local content = Instance.new("Frame")
	content.Name = "Content"
	content.Position = UDim2.new(0, 162, 0, 62)
	content.Size = UDim2.new(1, -170, 1, -70)
	content.BackgroundTransparency = 1
	content.Parent = self.root
	return content
end

function Home:renderHomePage(content)
	local theme = self.Theme.get()
	local placeName = tostring((self.manager.placeInfo and self.manager.placeInfo.placeName) or game.Name or "Roblox project")
	local connected = self.connectionState == "connected"
	local repo = self.gitStatus and self.gitStatus.githubRepo
	local remote = self.gitStatus and self.gitStatus.remoteUrl
	local branch = (self.gitStatus and self.gitStatus.branch) or "loading"
	local ghReady = remote or repo

	local hero = self:card(content, "Project status", UDim2.new(0, 0, 0, 0), UDim2.new(1, 0, 0, 154), "hero")
	self:renderAvatar(hero, self:getRobloxThumbnail(), initials(placeName), 16, 48, 56)
	local name = self.Utils.makeLabel(hero, placeName, 23, theme)
	name.Font = Enum.Font.GothamBold
	name.Position = UDim2.new(0, 86, 0, 46)
	name.Size = UDim2.new(1, -250, 0, 30)
	local line = self.Utils.makeLabel(hero, "Daemon " .. (connected and "ready" or "offline") .. " · Branch " .. branch .. " · " .. tostring(#(self.scripts or {})) .. " scripts", 13, theme, true)
	line.Position = UDim2.new(0, 86, 0, 80)
	line.Size = UDim2.new(1, -120, 0, 20)
	local ghLine = self.Utils.makeLabel(hero, "GitHub " .. (ghReady and "repo ready" or "setup needed"), 13, theme, true)
	ghLine.Position = UDim2.new(0, 86, 0, 104)
	ghLine.Size = UDim2.new(1, -120, 0, 20)
	local launch = self.Utils.makeButton(hero, "Launch RoAgent", theme, "primary")
	launch.Position = UDim2.new(1, -150, 0, 52)
	launch.Size = UDim2.new(0, 130, 0, 32)
	launch.MouseButton1Click:Connect(function()
		self.manager:send("agent:launch", {}, function(payload) self.agentStatus = payload; self:renderPreservingHistory() end)
	end)

	local gh = self:card(content, "Github", UDim2.new(0, 0, 0, 166), UDim2.new(0.5, -6, 0, 164), "large")
	local githubUser = self.githubStatus and self.githubStatus.githubLogin
	self:renderAvatar(gh, self.githubStatus and self.githubStatus.githubAvatarUrl, githubUser and initials(githubUser) or "GH", 14, 48, 46)
	local ghText = self.Utils.makeLabel(gh, githubUser and ("@" .. githubUser) or "Not signed in", 18, theme)
	ghText.Font = Enum.Font.GothamBold
	ghText.Position = UDim2.new(0, 72, 0, 48)
	ghText.Size = UDim2.new(1, -84, 0, 24)
	local repoText = self.Utils.makeLabel(gh, repo and ("Repo: " .. repo) or (remote and "Remote configured" or "No repo selected"), 12, theme, true)
	repoText.Position = UDim2.new(0, 72, 0, 76)
	repoText.Size = UDim2.new(1, -84, 0, 20)
	local ghButtonText = (not (self.githubStatus and self.githubStatus.hasToken)) and "Set up Github" or ((not remote and not repo) and "Create repo" or "Open Github page")
	local ghButton = self.Utils.makeButton(gh, ghButtonText, theme, (not remote and not repo) and "primary" or nil)
	ghButton.Position = UDim2.new(0, 72, 0, 106)
	ghButton.Size = UDim2.new(0, 146, 0, 30)
	ghButton.MouseButton1Click:Connect(function() self:setPage("github") end)

	local recent = self:card(content, "Recent activity", UDim2.new(0.5, 6, 0, 166), UDim2.new(0.5, -6, 0, 164), "large")
	for i = 1, 4 do
		local action = self.actions[i]
		local txt = self.Utils.makeLabel(recent, action and tostring(action.summary or action.tool) or "—", 12, theme, not action)
		txt.Position = UDim2.new(0, 14, 0, 38 + ((i - 1) * 26))
		txt.Size = UDim2.new(1, -28, 0, 20)
	end
end

function Home:scriptRoot(path)
	return tostring(path or "Other"):match("^([^.]+)") or "Other"
end

function Home:scriptMatches(record)
	local q = string.lower(self.Utils.trim(self.scriptSearch or ""))
	if q == "" then return true end
	local hay = string.lower(table.concat({ tostring(record.path or ""), tostring(record.className or ""), self:scriptRoot(record.path) }, " "))
	return string.find(hay, q, 1, true) ~= nil
end

function Home:filteredScripts()
	local out = {}
	if self.historyMode == "deleted" then
		for _, record in ipairs(self.deleted or {}) do if self:scriptMatches(record) then table.insert(out, record) end end
		table.sort(out, function(a, b) return tostring(a.path) < tostring(b.path) end)
		return out
	end
	for _, record in ipairs(self.scripts or {}) do
		if not record.deleted and self:scriptMatches(record) then
			if self.historyMode == "modules" and record.className ~= "ModuleScript" then continue end
			if self.historyMode == "locals" and record.className ~= "LocalScript" then continue end
			if self.historyMode == "scripts" and record.className ~= "Script" then continue end
			table.insert(out, record)
		end
	end
	table.sort(out, function(a, b) return tostring(a.path) < tostring(b.path) end)
	return out
end

function Home:buildTree(records)
	local root = { folders = {}, folderOrder = {}, scripts = {} }
	for _, record in ipairs(records) do
		local parts = splitPath(record.path)
		local node = root
		local folderPath = ""
		for i = 1, math.max(#parts - 1, 0) do
			local part = parts[i]
			folderPath = folderPath == "" and part or (folderPath .. "." .. part)
			if not node.folders[part] then
				node.folders[part] = { name = part, path = folderPath, folders = {}, folderOrder = {}, scripts = {} }
				table.insert(node.folderOrder, part)
			end
			node = node.folders[part]
		end
		table.insert(node.scripts, record)
	end
	local function sortNode(node)
		table.sort(node.folderOrder)
		table.sort(node.scripts, function(a, b) return tostring(a.path) < tostring(b.path) end)
		for _, name in ipairs(node.folderOrder) do sortNode(node.folders[name]) end
	end
	sortNode(root)
	return root
end

function Home:folderExpanded(path)
	return self.expandedFolders[path] ~= false
end

function Home:toggleFolder(path)
	self.expandedFolders[path] = not self:folderExpanded(path)
	if self.plugin then self.plugin:SetSetting("historyExpandedFolders", self.expandedFolders) end
	self:renderPreservingHistory()
end

function Home:selectScript(record)
	self:captureHistoryState()
	self.previewCanvasPosition = Vector2.new(0, 0)
	self.selectedScript = record.path
	self.selectedScriptRecord = record
	self.selectedDeleted = nil
	self.selectedVersion = nil
	self.previewTitle = tostring(record.path)
	self.previewText = "Loading history..."
	self.manager:send("history:get", { path = record.path, includeSource = true }, function(payload)
		self.historyVersions = payload.versions or {}
		local latest = self.historyVersions[#self.historyVersions]
		self.previewCanvasPosition = Vector2.new(0, 0)
		self.previewText = latest and tostring(latest.source or "Source hidden for this version.") or "No saved versions yet."
		self:renderPreservingHistory()
	end)
	self:renderPreservingHistory()
end

function Home:selectDeleted(record)
	self:captureHistoryState()
	self.previewCanvasPosition = Vector2.new(0, 0)
	self.selectedDeleted = record
	self.selectedScript = record.path
	self.selectedVersion = nil
	self.previewTitle = "Deleted · " .. tostring(record.path)
	self.previewText = tostring(record.lastKnownSource or "Source hidden for this deleted script.")
	self:renderPreservingHistory()
end

function Home:showConfirm(title, message, confirmText, onConfirm)
	self.confirmation = {
		title = title,
		message = message,
		confirmText = confirmText or "Confirm",
		onConfirm = onConfirm,
	}
	self:renderPreservingHistory()
end

function Home:confirmRestoreSelection()
	if self.selectedDeleted then
		local path = tostring(self.selectedDeleted.path or "deleted script")
		self:showConfirm("Restore deleted script?", "Restore " .. path .. " back into Studio?", "Restore", function()
			self:restoreSelection()
		end)
		return
	end
	if not self.selectedScript or not self.selectedVersion then
		self.Utils.notify("Select a script version first", "StudioLink")
		return
	end
	local label = "v" .. tostring(self.selectedVersion.versionNumber or self.selectedVersion.versionId or "selected")
	self:showConfirm("Restore version?", "Restore " .. label .. " for " .. tostring(self.selectedScript) .. "? This can overwrite the current Studio source.", "Restore", function()
		self:restoreSelection()
	end)
end

function Home:restoreSelection()
	if self.selectedDeleted then
		self.manager:send("script:restore", { path = self.selectedDeleted.path, uniqueId = self.selectedDeleted.uniqueId, versionId = self.selectedDeleted.versionId or self.selectedDeleted.lastVersionId, summary = "restore: " .. tostring(self.selectedDeleted.path), pendingStudioDeploy = true }, function(payload)
			if self.callbacks.applyScript and payload.script then self.callbacks.applyScript(payload.script) end
			self:refreshHistory()
			self:renderPreservingHistory()
		end)
		return
	end
	if not self.selectedScript or not self.selectedVersion then
		self.Utils.notify("Select a script version first", "StudioLink")
		return
	end
	self.manager:send("script:restore", { path = self.selectedScript, uniqueId = self.selectedVersion.uniqueId, versionId = self.selectedVersion.versionId, summary = "restore: " .. self.selectedScript, pendingStudioDeploy = true }, function(payload)
		if self.callbacks.applyScript and payload.script then self.callbacks.applyScript(payload.script) end
		self:refreshHistory()
		self:renderPreservingHistory()
	end)
end

function Home:commitSnapshot()
	local message = self.Utils.trim(self.commitMessage or "")
	local payload = {}
	if message ~= "" then payload.message = message end
	self.manager:send("git:commit", payload, function()
		self.commitMessage = ""
		self:refreshHistory()
		self.manager:send("git:status", {}, function(status)
			self.gitStatus = status
			self:renderPreservingHistory()
		end)
	end)
end

function Home:renderTreeNode(list, node, depth, deleted)
	local theme = self.Theme.get()
	for _, name in ipairs(node.folderOrder) do
		local folder = node.folders[name]
		local expanded = self:folderExpanded(folder.path)
		local row = self.Utils.makeButton(list, "", theme, nil)
		row.Size = UDim2.new(1, -8, 0, 22)
		row.MouseButton1Click:Connect(function() self:toggleFolder(folder.path) end)
		local text = self.Utils.makeLabel(row, (expanded and "▾  📁 " or "▸  📁 ") .. folder.name, 12, theme)
		text.TextYAlignment = Enum.TextYAlignment.Center
		text.Position = UDim2.new(0, 8 + depth * 14, 0, 0)
		text.Size = UDim2.new(1, -12 - depth * 14, 1, 0)
		if expanded then self:renderTreeNode(list, folder, depth + 1, deleted) end
	end
	for _, record in ipairs(node.scripts) do
		local selected = deleted and self.selectedDeleted and self.selectedDeleted.path == record.path or self.selectedScript == record.path
		local variant = deleted and "danger" or (selected and "selected" or nil)
		local row = self.Utils.makeButton(list, "", theme, variant)
		row.Size = UDim2.new(1, -8, 0, 22)
		if deleted then
			local color = selected and theme.red or theme.dangerSoft
			row.BackgroundColor3 = color
			row:SetAttribute("StudioLinkNormalColor", color)
		end
		local parts = splitPath(record.path)
		local labelText = (deleted and "✕" or classIcon(record.className)) .. "  " .. tostring(parts[#parts] or record.path)
		local text = self.Utils.makeLabel(row, labelText, 12, theme)
		text.TextYAlignment = Enum.TextYAlignment.Center
		text.Position = UDim2.new(0, 8 + depth * 14, 0, 0)
		text.Size = UDim2.new(1, -12 - depth * 14, 1, 0)
		row.MouseButton1Click:Connect(function()
			if deleted then self:selectDeleted(record) else self:selectScript(record) end
		end)
	end
end

function Home:renderHistoryPage(content)
	local theme = self.Theme.get()
	local left = self:card(content, "Scripts", UDim2.new(0, 0, 0, 0), UDim2.new(0, 320, 1, 0), "large")
	local search = Instance.new("TextBox")
	search.PlaceholderText = "Search scripts or folders"
	search.Text = self.scriptSearch
	search.ClearTextOnFocus = false
	search.Font = Enum.Font.Gotham
	search.TextSize = 12
	search.BackgroundColor3 = theme.panel
	search.BorderColor3 = theme.border
	search.TextColor3 = theme.text
	search.PlaceholderColor3 = theme.textMuted
	search.Position = UDim2.new(0, 12, 0, 40)
	search.Size = UDim2.new(1, -24, 0, 28)
	search.Parent = left
	search.Focused:Connect(function()
		self.searchFocused = true
	end)
	search:GetPropertyChangedSignal("Text"):Connect(function()
		self.scriptSearch = search.Text or ""
	end)
	search.FocusLost:Connect(function()
		self.searchFocused = false
		self.scriptSearch = search.Text or ""
		self.historyListCanvasPosition = Vector2.new(0, 0)
		self.pendingHistoryRender = false
		self:renderPreservingHistory()
	end)
	local modes = { {"existing", "All"}, {"deleted", "Deleted"}, {"modules", "Module"}, {"scripts", "Script"}, {"locals", "Local"} }
	for i, mode in ipairs(modes) do
		local b = self.Utils.makeButton(left, mode[2], theme, self.historyMode == mode[1] and "selected" or nil)
		b.Position = UDim2.new(0, 12 + ((i - 1) % 3) * 94, 0, 76 + math.floor((i - 1) / 3) * 32)
		b.Size = UDim2.new(0, 86, 0, 26)
		b.MouseButton1Click:Connect(function() self.historyMode = mode[1]; self:renderPreservingHistory() end)
	end
	local list = Instance.new("ScrollingFrame")
	list.Position = UDim2.new(0, 8, 0, 144)
	list.Size = UDim2.new(1, -16, 1, -184)
	list.BackgroundTransparency = 1
	list.BorderSizePixel = 0
	list.ScrollBarThickness = 6
	list.AutomaticCanvasSize = Enum.AutomaticSize.Y
	list.CanvasSize = UDim2.new()
	list.Parent = left
	self.historyList = list
	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, 3)
	layout.Parent = list
	self:renderTreeNode(list, self:buildTree(self:filteredScripts()), 0, self.historyMode == "deleted")
	local restore = self.Utils.makeButton(left, "Restore selected", theme, "primary")
	restore.Position = UDim2.new(0, 12, 1, -34)
	restore.Size = UDim2.new(1, -24, 0, 28)
	restore.MouseButton1Click:Connect(function() self:confirmRestoreSelection() end)

	local mid = self:card(content, "Versions", UDim2.new(0, 332, 0, 0), UDim2.new(0, 230, 1, 0), "large")
	local vlist = Instance.new("ScrollingFrame")
	vlist.Position = UDim2.new(0, 8, 0, 40)
	vlist.Size = UDim2.new(1, -16, 1, -98)
	vlist.BackgroundTransparency = 1
	vlist.BorderSizePixel = 0
	vlist.ScrollBarThickness = 6
	vlist.AutomaticCanvasSize = Enum.AutomaticSize.Y
	vlist.CanvasSize = UDim2.new()
	vlist.Parent = mid
	self.versionList = vlist
	local vlayout = Instance.new("UIListLayout")
	vlayout.Padding = UDim.new(0, 4)
	vlayout.Parent = vlist
	for i = #self.historyVersions, 1, -1 do
		local version = self.historyVersions[i]
		local selected = self.selectedVersion and self.selectedVersion.versionId == version.versionId
		local row = self.Utils.makeButton(vlist, "v" .. tostring(version.versionNumber or i) .. " · " .. tostring(version.action or "change"), theme, selected and "selected" or nil)
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.Size = UDim2.new(1, -8, 0, 28)
		row.MouseButton1Click:Connect(function()
			self:captureHistoryState()
			self.previewCanvasPosition = Vector2.new(0, 0)
			self.selectedVersion = version
			self.previewTitle = "v" .. tostring(version.versionNumber or i) .. " · " .. tostring(self.selectedScript or version.path or "Script")
			self.previewText = tostring(version.source or "Source hidden for this version.")
			self:renderPreservingHistory()
		end)
	end
	local commitInput = Instance.new("TextBox")
	commitInput.PlaceholderText = "Commit message (optional)"
	commitInput.Text = self.commitMessage or ""
	commitInput.ClearTextOnFocus = false
	commitInput.Font = Enum.Font.Gotham
	commitInput.TextSize = 12
	commitInput.BackgroundColor3 = theme.panel
	commitInput.BorderColor3 = theme.border
	commitInput.TextColor3 = theme.text
	commitInput.PlaceholderColor3 = theme.textMuted
	commitInput.Position = UDim2.new(0, 8, 1, -52)
	commitInput.Size = UDim2.new(1, -16, 0, 24)
	commitInput.Parent = mid
	commitInput:GetPropertyChangedSignal("Text"):Connect(function()
		self.commitMessage = commitInput.Text or ""
	end)
	local commitButton = self.Utils.makeButton(mid, "Commit Snapshot", theme, "primary")
	commitButton.Position = UDim2.new(0, 8, 1, -24)
	commitButton.Size = UDim2.new(1, -16, 0, 24)
	commitButton.MouseButton1Click:Connect(function() self:commitSnapshot() end)

	for _, commit in ipairs(self.commits or {}) do
		local row = self.Utils.makeButton(vlist, "Git · " .. tostring(commit.message or "snapshot"), theme)
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.Size = UDim2.new(1, -8, 0, 28)
		row.MouseButton1Click:Connect(function()
			self:captureHistoryState()
			self.previewCanvasPosition = Vector2.new(0, 0)
			self.previewTitle = "Git snapshot · " .. tostring(commit.hash or "")
			self.previewText = "Loading git diff..."
			self.manager:send("git:diff", { path = ".", fromCommit = commit.hash }, function(payload)
				self.previewCanvasPosition = Vector2.new(0, 0)
				self.previewText = tostring(payload.diff or "No diff.")
				self:renderPreservingHistory()
			end)
			self:renderPreservingHistory()
		end)
	end

	self:renderPreview(content, UDim2.new(0, 574, 0, 0), UDim2.new(1, -574, 1, 0))
end

function Home:renderPreview(parent, pos, size)
	local theme = self.Theme.get()
	local bg, text, add, del = codePalette(theme)
	local frame, title = self:card(parent, self.previewTitle or "Preview", pos, size, "large")
	frame.BackgroundColor3 = bg
	if title then title.TextColor3 = text end
	local gradient = frame:FindFirstChildOfClass("UIGradient")
	if gradient then gradient:Destroy() end
	local code = Instance.new("ScrollingFrame")
	code.Position = UDim2.new(0, 12, 0, 42)
	code.Size = UDim2.new(1, -24, 1, -54)
	code.BackgroundTransparency = 1
	code.BorderSizePixel = 0
	code.ScrollBarThickness = 7
	code.AutomaticCanvasSize = Enum.AutomaticSize.Y
	code.CanvasSize = UDim2.new()
	code.Parent = frame
	self.previewScroll = code
	local layout = Instance.new("UIListLayout")
	layout.Parent = code
	local content = tostring(self.previewText or "")
	for line in string.gmatch(content .. "\n", "([^\n]*)\n") do
		local label = Instance.new("TextLabel")
		label.BackgroundTransparency = 1
		label.Font = Enum.Font.Code
		label.TextSize = 13
		label.TextXAlignment = Enum.TextXAlignment.Left
		label.Text = line == "" and " " or line
		label.Size = UDim2.new(1, -8, 0, 18)
		local first = string.sub(line, 1, 1)
		label.TextColor3 = first == "+" and add or (first == "-" and del or text)
		label.Parent = code
	end
end

function Home:renderGithubPage(content)
	local theme = self.Theme.get()
	local card = self:card(content, "Github setup", UDim2.new(0, 0, 0, 0), UDim2.new(1, 0, 0, 252), "hero")
	local user = self.githubStatus and self.githubStatus.githubLogin
	local repo = self.gitStatus and self.gitStatus.githubRepo
	local remote = self.gitStatus and self.gitStatus.remoteUrl
	self:renderAvatar(card, self.githubStatus and self.githubStatus.githubAvatarUrl, user and initials(user) or "GH", 18, 54, 64)
	local title = self.Utils.makeLabel(card, user and ("Signed in as @" .. user) or "Connect Github", 24, theme)
	title.Font = Enum.Font.GothamBold
	title.Position = UDim2.new(0, 98, 0, 54)
	title.Size = UDim2.new(1, -120, 0, 32)
	local status = repo and "ready" or ((self.githubStatus and self.githubStatus.hasToken) and "missing" or "not connected")
	local details = self.Utils.makeLabel(card, "Repo status: " .. status .. " · Connected: " .. tostring((self.githubStatus and self.githubStatus.updatedAt) or "—"), 13, theme, true)
	details.Position = UDim2.new(0, 98, 0, 88)
	details.Size = UDim2.new(1, -120, 0, 20)
	local repoLine = self.Utils.makeLabel(card, "Repo: " .. tostring(repo or "—"), 12, theme, true)
	repoLine.Position = UDim2.new(0, 98, 0, 112)
	repoLine.Size = UDim2.new(1, -120, 0, 20)
	local remoteLine = self.Utils.makeLabel(card, "Remote: " .. tostring(remote or "—"), 12, theme, true)
	remoteLine.Position = UDim2.new(0, 98, 0, 134)
	remoteLine.Size = UDim2.new(1, -120, 0, 20)
	local msg = self.Utils.makeLabel(card, tostring(self.githubMessage or "Set up Github → login → Create repo → ready."), 12, theme, true)
	msg.Position = UDim2.new(0, 98, 0, 156)
	msg.Size = UDim2.new(1, -120, 0, 20)
	if not repo and not remote then
		local buttonText = "Set up Github"
		if self.githubDevice then buttonText = "Check sign-in" elseif self.githubStatus and self.githubStatus.hasToken then buttonText = "Create repo" end
		local btn = self.Utils.makeButton(card, buttonText, theme, "primary")
		btn.Position = UDim2.new(0, 98, 0, 188)
		btn.Size = UDim2.new(0, 150, 0, 34)
		btn.MouseButton1Click:Connect(function()
			if self.githubDevice then self:checkGithubSignIn() elseif self.githubStatus and self.githubStatus.hasToken then self:autoGithubRemote() else self:startGithubSignIn() end
		end)
	else
		local ready = self.Utils.makePill(card, "Github ready", theme.green, theme)
		ready.Position = UDim2.new(0, 98, 0, 190)
	end
end

function Home:autoGithubRemote()
	local placeName = self.manager and self.manager.placeInfo and self.manager.placeInfo.placeName or "Roblox Place"
	self.manager:send("git:autoRemote", { placeName = placeName }, function(payload)
		self.gitStatus = self.gitStatus or {}
		self.gitStatus.remoteUrl = payload.url
		self.gitStatus.githubRepo = payload.repo or self.gitStatus.githubRepo
		self.gitStatus.githubRepoHtmlUrl = payload.htmlUrl or self.gitStatus.githubRepoHtmlUrl
		self.githubMessage = "Repo ready: " .. tostring(payload.repo or payload.url or "GitHub remote")
		self:renderPreservingHistory()
	end)
end

function Home:startGithubSignIn()
	self.manager:send("git:githubDeviceStart", {}, function(payload)
		self.githubDevice = payload
		self.githubMessage = "Enter code " .. tostring(payload.userCode or "") .. " on GitHub."
		self.Utils.openUrl(self.plugin, tostring(payload.verificationUri or "https://github.com/login/device"), self.manager)
		self:renderPreservingHistory()
	end)
end

function Home:checkGithubSignIn()
	if not self.githubDevice or not self.githubDevice.deviceCode then self.Utils.notify("Start Github setup first", "StudioLink"); return end
	self.manager:send("git:githubDevicePoll", { deviceCode = self.githubDevice.deviceCode }, function(payload)
		if payload.authorized then
			self.githubStatus = payload
			self.githubDevice = nil
			self.githubMessage = "Signed in. Click Create repo."
		else
			self.githubMessage = payload.pending and "Waiting for Github approval..." or tostring(payload.message or payload.error or "Sign-in failed")
		end
		self:renderPreservingHistory()
	end)
end

function Home:renderSettingsPage(content)
	local theme = self.Theme.get()
	local card = self:card(content, "Settings", UDim2.new(0, 0, 0, 0), UDim2.new(1, 0, 0, 370), "large")
	local themeButton = self.Utils.makeButton(card, "Theme: " .. self.Theme.name(), theme, "primary")
	themeButton.Position = UDim2.new(0, 16, 0, 46)
	themeButton.Size = UDim2.new(0, 180, 0, 32)
	themeButton.MouseButton1Click:Connect(function() self.Theme.toggle(self.plugin) end)
	local launch = self.Utils.makeButton(card, "Launch RoAgent", theme)
	launch.Position = UDim2.new(0, 16, 0, 92)
	launch.Size = UDim2.new(0, 180, 0, 32)
	launch.MouseButton1Click:Connect(function() self.manager:send("agent:launch", {}, function(payload) self.agentStatus = payload; self:renderPreservingHistory() end) end)
	local restart = self.Utils.makeButton(card, "Restart daemon", theme)
	restart.Position = UDim2.new(0, 212, 0, 92)
	restart.Size = UDim2.new(0, 150, 0, 32)
	restart.MouseButton1Click:Connect(function() if self.manager.restartDaemon then self.manager:restartDaemon(function() self.connectionState = "reconnecting"; self:renderPreservingHistory() end) end end)
	local update = self.Utils.makeButton(card, "Check updates", theme)
	update.Position = UDim2.new(0, 378, 0, 92)
	update.Size = UDim2.new(0, 150, 0, 32)
	update.MouseButton1Click:Connect(function()
		if self.manager.daemonAction then
			self.maintenanceMessage = "Checking for updates..."
			self.manager:daemonAction("/daemon/update/check", {}, function(ok, payload)
				if ok then self.updateStatus = payload; self.maintenanceMessage = payload.reason or (payload.updateAvailable and "Update available." or "Already up to date.") else self.maintenanceMessage = tostring(payload) end
				self:renderPreservingHistory()
			end)
		end
	end)
	local reset = self.Utils.makeButton(card, "Reset panel state", theme)
	reset.Position = UDim2.new(0, 544, 0, 92)
	reset.Size = UDim2.new(0, 150, 0, 32)
	reset.MouseButton1Click:Connect(function()
		self.plugin:SetSetting("activePanel", "")
		self.plugin:SetSetting("mainPage", "home")
		self.plugin:SetSetting("historyExpandedFolders", {})
		self.expandedFolders = {}
		self:setPage("home")
	end)
	local autoEnabled = self.autostartStatus and self.autostartStatus.enabled == true
	local autostart = self.Utils.makeButton(card, autoEnabled and "Disable autostart" or "Enable autostart", theme)
	autostart.Position = UDim2.new(0, 16, 0, 138)
	autostart.Size = UDim2.new(0, 180, 0, 32)
	autostart.MouseButton1Click:Connect(function()
		if self.manager.daemonAction then
			self.manager:daemonAction("/daemon/autostart/set", { enabled = not autoEnabled }, function(ok, payload)
				if ok then self.autostartStatus = payload; self.maintenanceMessage = "Autostart updated." else self.maintenanceMessage = tostring(payload) end
				self:renderPreservingHistory()
			end)
		end
	end)
	local apply = self.Utils.makeButton(card, "Install update", theme)
	apply.Position = UDim2.new(0, 212, 0, 138)
	apply.Size = UDim2.new(0, 150, 0, 32)
	apply.MouseButton1Click:Connect(function()
		if self.manager.daemonAction then
			self.maintenanceMessage = "Preparing update..."
			self.manager:daemonAction("/daemon/update/apply", {}, function(ok, payload)
				if ok then self.updateStatus = payload; self.maintenanceMessage = payload.staged and "Update staged; daemon will restart." or tostring(payload.reason or "Update cannot be applied automatically.") else self.maintenanceMessage = tostring(payload) end
				self:renderPreservingHistory()
			end)
		end
	end)
	local repair = self.Utils.makeButton(card, "Repair", theme)
	repair.Position = UDim2.new(0, 378, 0, 138)
	repair.Size = UDim2.new(0, 150, 0, 32)
	repair.MouseButton1Click:Connect(function()
		if self.manager.daemonAction then self.manager:daemonAction("/daemon/repair", {}, function(ok, payload) self.maintenanceMessage = ok and tostring(payload.message or "Repair finished.") or tostring(payload); self:renderPreservingHistory() end) end
	end)
	local support = self.Utils.makeButton(card, "Support bundle", theme)
	support.Position = UDim2.new(0, 544, 0, 138)
	support.Size = UDim2.new(0, 150, 0, 32)
	support.MouseButton1Click:Connect(function()
		if self.manager.daemonAction then self.manager:daemonAction("/daemon/support-bundle", {}, function(ok, payload) self.maintenanceMessage = ok and ("Bundle: " .. tostring(payload.path or "created")) or tostring(payload); self:renderPreservingHistory() end) end
	end)
	local updateLine = self.updateStatus and ("Update: current " .. tostring(self.updateStatus.currentVersion or "?") .. " · latest " .. tostring(self.updateStatus.latestVersion or "?") .. " · " .. (self.updateStatus.updateAvailable and "available" or "none")) or "Update: not checked"
	local autoLine = self.autostartStatus and ("Autostart: " .. (self.autostartStatus.enabled and "enabled" or "disabled") .. " · " .. tostring(self.autostartStatus.method or "unknown")) or "Autostart: loading"
	local lines = {
		"Daemon: " .. tostring(self.connectionState) .. " · Version " .. tostring((self.health and (self.health.daemonVersion or self.health.version)) or "unknown"),
		"Plugin version: " .. tostring((self.manager and self.manager.pluginVersion) or "unknown"),
		"Endpoint: " .. tostring((self.manager and self.manager.httpUrl) or "unknown"),
		"License: " .. tostring((self.licenseStatus and self.licenseStatus.status) or "unknown"),
		autoLine,
		updateLine,
		"Maintenance: " .. tostring(self.maintenanceMessage or "ready"),
		"Repo/data: " .. tostring((self.gitStatus and self.gitStatus.repoPath) or "loading") .. " · Branch " .. tostring((self.gitStatus and self.gitStatus.branch) or "—"),
		"GitHub: " .. tostring((self.githubStatus and self.githubStatus.githubLogin) or "not signed in") .. " · " .. tostring((self.gitStatus and self.gitStatus.githubRepo) or "no repo"),
	}
	for i, line in ipairs(lines) do
		local info = self.Utils.makeLabel(card, line, 13, theme, true)
		info.Position = UDim2.new(0, 16, 0, 188 + ((i - 1) * 20))
		info.Size = UDim2.new(1, -32, 0, 18)
	end
end

function Home:renderConfirmation()
	if not self.confirmation or not self.root then return end
	local theme = self.Theme.get()
	local overlay = Instance.new("Frame")
	overlay.Name = "ConfirmOverlay"
	overlay.Size = UDim2.fromScale(1, 1)
	overlay.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
	overlay.BackgroundTransparency = 0.38
	overlay.BorderSizePixel = 0
	overlay.ZIndex = 950000
	overlay.Parent = self.root
	local card = Instance.new("Frame")
	card.AnchorPoint = Vector2.new(0.5, 0.5)
	card.Position = UDim2.fromScale(0.5, 0.5)
	card.Size = UDim2.new(0, 390, 0, 172)
	card.ZIndex = 950001
	card.Parent = overlay
	self.Utils.stylePanel(card, theme, "large")
	local title = self.Utils.makeLabel(card, self.confirmation.title or "Confirm", 18, theme)
	title.Font = Enum.Font.GothamBold
	title.Position = UDim2.new(0, 18, 0, 16)
	title.Size = UDim2.new(1, -36, 0, 26)
	title.ZIndex = 950002
	local msg = self.Utils.makeLabel(card, self.confirmation.message or "Are you sure?", 13, theme, true)
	msg.Position = UDim2.new(0, 18, 0, 52)
	msg.Size = UDim2.new(1, -36, 0, 58)
	msg.ZIndex = 950002
	local cancel = self.Utils.makeButton(card, "Cancel", theme)
	cancel.Position = UDim2.new(1, -202, 1, -44)
	cancel.Size = UDim2.new(0, 86, 0, 30)
	cancel.ZIndex = 950002
	cancel.MouseButton1Click:Connect(function()
		self.confirmation = nil
		self:renderPreservingHistory()
	end)
	local ok = self.Utils.makeButton(card, self.confirmation.confirmText or "Confirm", theme, "primary")
	ok.Position = UDim2.new(1, -108, 1, -44)
	ok.Size = UDim2.new(0, 90, 0, 30)
	ok.ZIndex = 950002
	ok.MouseButton1Click:Connect(function()
		local callback = self.confirmation and self.confirmation.onConfirm
		self.confirmation = nil
		self:renderPreservingHistory()
		if callback then callback() end
	end)
end

function Home:renderLogsPage(content)
	local theme = self.Theme.get()
	local card = self:card(content, "Logs", UDim2.new(0, 0, 0, 0), UDim2.new(1, 0, 1, 0), "large")
	local list = Instance.new("ScrollingFrame")
	list.Position = UDim2.new(0, 10, 0, 42)
	list.Size = UDim2.new(1, -20, 1, -52)
	list.BackgroundTransparency = 1
	list.BorderSizePixel = 0
	list.ScrollBarThickness = 7
	list.AutomaticCanvasSize = Enum.AutomaticSize.Y
	list.CanvasSize = UDim2.new()
	list.Parent = card
	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, 6)
	layout.Parent = list
	for _, action in ipairs(self.actions or {}) do
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, -8, 0, 46)
		row.Parent = list
		self.Utils.stylePanel(row, theme, "alt")
		local summary = self.Utils.makeLabel(row, tostring(action.summary or action.tool or "Action"), 13, theme)
		summary.Position = UDim2.new(0, 12, 0, 8)
		summary.Size = UDim2.new(1, -24, 0, 18)
		local stamp = self.Utils.makeLabel(row, tostring(action.timestamp or "now"), 11, theme, true)
		stamp.Position = UDim2.new(0, 12, 0, 27)
		stamp.Size = UDim2.new(1, -24, 0, 16)
	end
end

function Home:render()
	if not self.root then return end
	local theme = self.Theme.get()
	self.root.BackgroundColor3 = theme.background
	self.historyList = nil
	self.versionList = nil
	self.previewScroll = nil
	self:clearContent()
	local content = self:renderShell()
	if self.page == "history" then self:renderHistoryPage(content)
	elseif self.page == "github" then self:renderGithubPage(content)
	elseif self.page == "settings" then self:renderSettingsPage(content)
	elseif self.page == "logs" then self:renderLogsPage(content)
	else self:renderHomePage(content) end
	self:renderConfirmation()
	self.renderedOnce = true
end

return Home
end

local function load_History()
local History = {}
History.__index = History

local function clamp(value, minValue, maxValue)
	return math.max(minValue, math.min(maxValue, value))
end

function History.new(plugin, manager, Theme, Utils, callbacks)
	local self = setmetatable({}, History)
	self.plugin = plugin
	self.manager = manager
	self.Theme = Theme
	self.Utils = Utils
	self.callbacks = callbacks or {}
	self.scripts = {}
	self.deleted = {}
	self.historyVersions = {}
	self.expandedHistoryGroups = {}
	self.scriptSearch = ""
	self.historySearch = ""
	self.activeTab = "history"
	self.gitStatus = nil
	self.commits = {}
	self.selectedScript = nil
	self.selectedScriptRecord = nil
	self.selectedScriptUniqueId = nil
	self.selectedVersion = nil
	self.selectedDeleted = nil
	self.selectedCommit = nil
	self.diff = ""
	manager:on("script:list:response", function(payload)
		self.scripts = payload.scripts or {}
		self:renderLists()
	end)
	manager:on("git:status:response", function(payload)
		self.gitStatus = payload
		self:renderLists()
	end)
	for _, messageType in ipairs({ "script:create:response", "script:write:response", "script:delete:response", "script:rename:response", "script:restore:response", "script:cleanupStale:response" }) do
		manager:on(messageType, function()
			self:refresh()
		end)
	end
	Theme.onChanged(function()
		self:render()
	end)
	return self
end

function History:createWidget()
	if self.widget then
		return
	end
	local info = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, false, false, 1100, 680, 520, 320)
	self.widget = self.plugin:CreateDockWidgetPluginGui("StudioLinkHistory", info)
	self.widget.Title = "StudioLink History"
	self.widget:GetPropertyChangedSignal("Enabled"):Connect(function()
		if not self.widget.Enabled and self.callbacks.onClosed then
			self.callbacks.onClosed()
		end
	end)
	local theme = self.Theme.get()
	self.root = Instance.new("Frame")
	self.root.Size = UDim2.fromScale(1, 1)
	self.root.BackgroundColor3 = theme.background
	self.root.Parent = self.widget
	self.root:GetPropertyChangedSignal("AbsoluteSize"):Connect(function()
		self:updateLayout()
	end)

	self.tabBar = Instance.new("Frame")
	self.tabBar.Name = "Tabs"
	self.tabBar.Position = UDim2.new(0, 0, 0, 0)
	self.tabBar.Size = UDim2.new(1, 0, 0, 78)
	self.tabBar.Parent = self.root
	self.Utils.stylePanel(self.tabBar, self.Theme.get(), "toolbar")
	self.tabButtons = {}
	local tabs = {
		{ key = "history", label = "Script History" },
		{ key = "deleted", label = "Deleted Scripts" },
		{ key = "git", label = "Git Snapshots" },
	}
	for i, tab in ipairs(tabs) do
		local button = self.Utils.makeButton(self.tabBar, tab.label, self.Theme.get())
		button.Position = UDim2.new(0, 98 + ((i - 1) * 132), 0, 5)
		button.Size = UDim2.new(0, 124, 0, 30)
		button.MouseButton1Click:Connect(function()
			self.activeTab = tab.key
			self.selectedVersion = nil
			self.selectedCommit = nil
			self.selectedDeleted = nil
			self:render()
		end)
		self.tabButtons[tab.key] = button
	end

	self.scriptSearchInput = Instance.new("TextBox")
	self.scriptSearchInput.PlaceholderText = "Search scripts, status, class..."
	self.scriptSearchInput.ClearTextOnFocus = false
	self.scriptSearchInput.Text = ""
	self.scriptSearchInput.Font = Enum.Font.Gotham
	self.scriptSearchInput.TextSize = 12
	self.scriptSearchInput.Position = UDim2.new(0, 8, 0, 42)
	self.scriptSearchInput.Size = UDim2.new(0, 330, 0, 28)
	self.scriptSearchInput.Parent = self.tabBar
	self.scriptSearchInput:GetPropertyChangedSignal("Text"):Connect(function()
		self.scriptSearch = self.scriptSearchInput.Text or ""
		self:renderLists()
	end)

	self.left = Instance.new("ScrollingFrame")
	self.left.Name = "Scripts"
	self.left.Position = UDim2.new(0, 8, 0, 82)
	self.left.Size = UDim2.new(0, 330, 1, -86)
	self.left.ScrollBarThickness = 8
	self.left.AutomaticCanvasSize = Enum.AutomaticSize.Y
	self.left.CanvasSize = UDim2.new()
	self.left.BorderSizePixel = 0
	self.left.Parent = self.root
	self.Utils.stylePanel(self.left, self.Theme.get(), "alt")
	local leftLayout = Instance.new("UIListLayout")
	leftLayout.Padding = UDim.new(0, 4)
	leftLayout.Parent = self.left
	local leftPadding = Instance.new("UIPadding")
	leftPadding.PaddingTop = UDim.new(0, 8)
	leftPadding.PaddingLeft = UDim.new(0, 8)
	leftPadding.PaddingRight = UDim.new(0, 8)
	leftPadding.Parent = self.left

	self.right = Instance.new("Frame")
	self.right.Name = "Details"
	self.right.Position = UDim2.new(0, 346, 0, 82)
	self.right.Size = UDim2.new(1, -346, 1, -86)
	self.right.BorderSizePixel = 0
	self.right.Parent = self.root

	self.commitList = Instance.new("ScrollingFrame")
	self.commitList.Name = "Commits"
	self.searchInput = Instance.new("TextBox")
	self.searchInput.PlaceholderText = "Search script history by action, date, actor, or summary"
	self.searchInput.ClearTextOnFocus = false
	self.searchInput.Text = ""
	self.searchInput.Font = Enum.Font.Gotham
	self.searchInput.TextSize = 12
	self.searchInput.Position = UDim2.new(0, 346, 0, 42)
	self.searchInput.Size = UDim2.new(0, 305, 0, 28)
	self.searchInput.Parent = self.tabBar
	self.searchInput:GetPropertyChangedSignal("Text"):Connect(function()
		self.historySearch = self.searchInput.Text or ""
		self:renderCommits()
	end)

	self.commitList.Position = UDim2.new(0, 0, 0, 0)
	self.commitList.Size = UDim2.new(0, 305, 1, 0)
	self.commitList.ScrollBarThickness = 8
	self.commitList.AutomaticCanvasSize = Enum.AutomaticSize.Y
	self.commitList.CanvasSize = UDim2.new()
	self.commitList.BorderSizePixel = 0
	self.commitList.Parent = self.right
	self.Utils.stylePanel(self.commitList, self.Theme.get(), "alt")
	local commitLayout = Instance.new("UIListLayout")
	commitLayout.Padding = UDim.new(0, 4)
	commitLayout.Parent = self.commitList

	self.diffFrame = Instance.new("ScrollingFrame")
	self.diffFrame.Name = "Diff"
	self.diffFrame.Position = UDim2.new(0, 313, 0, 0)
	self.diffFrame.Size = UDim2.new(1, -321, 1, 0)
	self.diffFrame.ScrollBarThickness = 8
	self.diffFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
	self.diffFrame.CanvasSize = UDim2.new()
	self.diffFrame.BorderSizePixel = 0
	self.diffFrame.Parent = self.right
	self.Utils.stylePanel(self.diffFrame, self.Theme.get(), "large")
	local diffLayout = Instance.new("UIListLayout")
	diffLayout.Parent = self.diffFrame

	self.restoreButton = self.Utils.makeButton(self.tabBar, "Restore selected", self.Theme.get())
	self.restoreButton.Position = UDim2.new(0, 494, 0, 5)
	self.restoreButton.Size = UDim2.new(0, 142, 0, 30)
	self.restoreButton.MouseButton1Click:Connect(function()
		self:restoreSelected()
	end)

	self.bottom = Instance.new("Frame")
	self.bottom.Name = "BottomBar"
	self.bottom.Position = UDim2.new(0, 658, 0, 5)
	self.bottom.Size = UDim2.new(1, -666, 0, 66)
	self.bottom.BorderSizePixel = 0
	self.bottom.Parent = self.root
	self.Utils.stylePanel(self.bottom, self.Theme.get(), "toolbar")
	self.commitInput = Instance.new("TextBox")
	self.commitInput.PlaceholderText = "Message"
	self.commitInput.ClearTextOnFocus = false
	self.commitInput.Text = ""
	self.commitInput.Font = Enum.Font.Gotham
	self.commitInput.TextSize = 13
	self.commitInput.Position = UDim2.new(0, 8, 0, 4)
	self.commitInput.Size = UDim2.new(1, -320, 0, 26)
	self.commitInput.Parent = self.bottom
	self.commitButton = self.Utils.makeButton(self.bottom, "Commit Snapshot", self.Theme.get())
	self.commitButton.Position = UDim2.new(1, -306, 0, 4)
	self.commitButton.Size = UDim2.new(0, 136, 0, 26)
	self.commitButton.MouseButton1Click:Connect(function()
		self.manager:send("git:commit", { message = self.Utils.trim(self.commitInput.Text) }, function()
			self:refresh()
		end)
	end)
	self.pushButton = self.Utils.makeButton(self.bottom, "Push", self.Theme.get())
	self.pushButton.Position = UDim2.new(1, -160, 0, 4)
	self.pushButton.Size = UDim2.new(0, 70, 0, 26)
	self.pushButton.MouseButton1Click:Connect(function()
		self.manager:send("git:push", {}, function()
			self:refresh()
		end)
	end)
	self.pullButton = self.Utils.makeButton(self.bottom, "Pull", self.Theme.get())
	self.pullButton.Position = UDim2.new(1, -82, 0, 4)
	self.pullButton.Size = UDim2.new(0, 70, 0, 26)
	self.pullButton.MouseButton1Click:Connect(function()
		self.manager:send("git:pull", {}, function()
			self:refresh()
		end)
	end)
	self.remoteLabel = self.Utils.makeLabel(self.bottom, "Remote: not set", 12, self.Theme.get(), true)
	self.remoteLabel.Position = UDim2.new(0, 8, 0, 36)
	self.remoteLabel.Size = UDim2.new(1, -216, 0, 18)
	self.autoRemoteButton = self.Utils.makeButton(self.bottom, "Auto Remote", self.Theme.get())
	self.autoRemoteButton.Position = UDim2.new(1, -202, 0, 34)
	self.autoRemoteButton.Size = UDim2.new(0, 92, 0, 24)
	self.autoRemoteButton.MouseButton1Click:Connect(function()
		local placeName = self.manager and self.manager.placeInfo and self.manager.placeInfo.placeName or "Roblox Place"
		self.manager:send("git:autoRemote", { placeName = placeName }, function()
			self:refresh()
		end)
	end)
	self.remoteButton = self.Utils.makeButton(self.bottom, "Set Remote", self.Theme.get())
	self.remoteButton.Position = UDim2.new(1, -102, 0, 34)
	self.remoteButton.Size = UDim2.new(0, 92, 0, 24)
	self.remoteButton.MouseButton1Click:Connect(function()
		self:promptRemote()
	end)
	self:updateLayout()
	self:render()
end

function History:updateLayout()
	if not self.root or not self.left or not self.right then
		return
	end
	local width = math.max(self.root.AbsoluteSize.X, 520)
	local height = math.max(self.root.AbsoluteSize.Y, 320)
	local compact = width < 620
	local toolbarHeight = compact and 112 or 78
	local gap = 8
	local contentTop = toolbarHeight + 4
	local contentHeightOffset = -(toolbarHeight + 8)
	local leftWidth = clamp(math.floor(width * 0.28), compact and 180 or 220, 330)
	local commitWidth = clamp(math.floor(width * 0.28), compact and 180 or 220, 305)
	local rightX = leftWidth + (gap * 2)

	self.tabBar.Size = UDim2.new(1, 0, 0, toolbarHeight)
	self.left.Position = UDim2.new(0, gap, 0, contentTop)
	self.left.Size = UDim2.new(0, leftWidth, 1, contentHeightOffset)
	self.right.Position = UDim2.new(0, rightX, 0, contentTop)
	self.right.Size = UDim2.new(1, -rightX - gap, 1, contentHeightOffset)
	self.commitList.Size = UDim2.new(0, commitWidth, 1, 0)
	self.diffFrame.Position = UDim2.new(0, commitWidth + gap, 0, 0)
	self.diffFrame.Size = UDim2.new(1, -commitWidth - gap, 1, 0)

	for i, tab in ipairs({ "history", "deleted", "git" }) do
		local button = self.tabButtons and self.tabButtons[tab]
		if button then
			button.Position = UDim2.new(0, 98 + ((i - 1) * 132), 0, 5)
			button.Size = UDim2.new(0, 124, 0, 30)
			button.TextSize = 12
		end
	end
	self.restoreButton.Position = UDim2.new(0, 494, 0, 5)
	self.restoreButton.Size = UDim2.new(0, 142, 0, 30)
	self.scriptSearchInput.Position = UDim2.new(0, gap, 0, 42)
	self.scriptSearchInput.Size = UDim2.new(0, leftWidth, 0, 28)
	self.searchInput.Position = UDim2.new(0, compact and gap or rightX, 0, compact and 74 or 42)
	self.searchInput.Size = UDim2.new(0, compact and math.max(180, width - (gap * 2)) or commitWidth, 0, 28)

	local bottomVisible = height >= 360 and width >= 760
	self.bottom.Visible = bottomVisible
	if bottomVisible then
		local bottomX = rightX + commitWidth + gap
		self.bottom.Position = UDim2.new(0, bottomX, 0, 5)
		self.bottom.Size = UDim2.new(1, -bottomX - gap, 0, 66)
		self.commitInput.Size = UDim2.new(1, -320, 0, 26)
	end
end

function History:changedPaths()
	local map = {}
	for _, file in ipairs((self.gitStatus and self.gitStatus.files) or {}) do
		local path = tostring(file.path or ""):gsub("%.lua$", ""):gsub("/", ".")
		map[path] = file.status or "modified"
	end
	return map
end

function History:scriptMatches(scriptRecord, query, deleted)
	query = string.lower(self.Utils.trim(query or ""))
	if query == "" then
		return true
	end
	local haystack = table.concat({ tostring(scriptRecord.path or ""), tostring(scriptRecord.className or ""), deleted and "deleted" or "active", tostring(scriptRecord.updatedAt or ""), tostring(scriptRecord.deletedAt or "") }, " ")
	return string.find(string.lower(haystack), query, 1, true) ~= nil
end

function History:scriptRoot(scriptPath)
	local root = tostring(scriptPath or ""):match("^([^.]+)") or "Other"
	return root
end

function History:addScriptSection(rootName)
	local theme = self.Theme.get()
	local label = self.Utils.makeLabel(self.left, tostring(rootName), 11, theme, true)
	label.Font = Enum.Font.GothamBold
	label.Size = UDim2.new(1, -6, 0, 18)
	return label
end

function History:renderLists()
	if not self.left then
		return
	end
	local theme = self.Theme.get()
	self.Utils.clearChildren(self.left)
	local changed = self:changedPaths()
	local query = self.scriptSearch or ""
	if self.activeTab == "deleted" then
		for _, deletedRecord in ipairs(self.deleted) do
			if not self:scriptMatches(deletedRecord, query, true) then
				continue
			end
			local selected = self.selectedDeleted and self.selectedDeleted.path == deletedRecord.path and self.selectedDeleted.uniqueId == deletedRecord.uniqueId
			local row = self.Utils.makeButton(self.left, "✕  " .. tostring(deletedRecord.path), theme, "danger")
			row.TextXAlignment = Enum.TextXAlignment.Left
			row.Size = UDim2.new(1, -6, 0, 28)
			local color = selected and theme.red or theme.dangerSoft
			row.BackgroundColor3 = color
			row.TextColor3 = selected and theme.background or theme.text
			row:SetAttribute("StudioLinkNormalColor", color)
			row:SetAttribute("StudioLinkHoverColor", color:Lerp(theme.buttonHover, 0.25))
			row:SetAttribute("StudioLinkPressedColor", color:Lerp(theme.buttonPressed, 0.25))
			row.MouseButton1Click:Connect(function()
				self:selectDeleted(deletedRecord)
			end)
		end
	else
		local currentRoot = nil
		for _, scriptRecord in ipairs(self.scripts) do
			if not scriptRecord.deleted and self:scriptMatches(scriptRecord, query, false) then
				local rootName = self:scriptRoot(scriptRecord.path)
				if rootName ~= currentRoot then
					currentRoot = rootName
					self:addScriptSection(rootName)
				end
				local selected = self.selectedScript == scriptRecord.path and self.selectedScriptUniqueId == scriptRecord.uniqueId
				local changedOnly = changed[scriptRecord.path] ~= nil
				local icon = scriptRecord.className == "ModuleScript" and "◇ " or (scriptRecord.className == "LocalScript" and "◐ " or "● ")
				local row = self.Utils.makeButton(self.left, icon .. scriptRecord.path, theme, selected and "selected" or (changedOnly and "changed" or nil))
				row.TextXAlignment = Enum.TextXAlignment.Left
				row.Size = UDim2.new(1, -6, 0, 26)
				row.TextColor3 = theme.text
				row.MouseButton1Click:Connect(function()
					self:selectScript(scriptRecord.path, scriptRecord)
				end)
			end
		end
	end
	if self.remoteLabel then
		self.remoteLabel.Text = "Remote: " .. tostring((self.gitStatus and self.gitStatus.remoteUrl) or "not set")
	end
end

function History:historyBucket(timestamp)
	local text = tostring(timestamp or "unknown")
	local date = string.sub(text, 1, 10)
	local hour = string.sub(text, 12, 13)
	if date == "" or hour == "" then
		return "Unknown time"
	end
	return date .. " " .. hour .. ":00"
end

function History:formatDate(timestamp)
	local text = tostring(timestamp or "")
	if #text >= 16 then
		return string.sub(text, 1, 10) .. " " .. string.sub(text, 12, 16)
	end
	return text ~= "" and text or "unknown time"
end

function History:actionLabel(action)
	local labels = { created = "Created", modified = "Modified", updated = "Modified", renamed = "Renamed / moved", deleted = "Deleted", restored = "Restored" }
	return labels[tostring(action or "")] or tostring(action or "Change")
end

function History:actionVariant(action)
	action = tostring(action or "")
	if action == "created" or action == "restored" then
		return "success"
	end
	if action == "renamed" then
		return "warning"
	end
	if action == "deleted" then
		return "danger"
	end
	return "changed"
end

function History:styleActionRow(row, action, selected)
	local theme = self.Theme.get()
	if selected then
		row.BackgroundColor3 = theme.buttonSelected
		row.TextColor3 = theme.text
		row:SetAttribute("StudioLinkNormalColor", theme.buttonSelected)
		return
	end
	action = tostring(action or "")
	local color = theme.accentSoft
	if action == "created" then
		color = theme.successSoft
	elseif action == "modified" or action == "updated" then
		color = Color3.fromRGB(28, 74, 118)
	elseif action == "renamed" then
		color = Color3.fromRGB(92, 74, 28)
	elseif action == "deleted" then
		color = theme.dangerSoft
	elseif action == "restored" then
		color = Color3.fromRGB(54, 50, 108)
	end
	row.BackgroundColor3 = color
	row.TextColor3 = theme.text
	row:SetAttribute("StudioLinkNormalColor", color)
	row:SetAttribute("StudioLinkHoverColor", color:Lerp(theme.buttonHover, 0.35))
	row:SetAttribute("StudioLinkPressedColor", color:Lerp(theme.buttonPressed, 0.35))
end

function History:actionChangesContent(version)
	local action = tostring(version and version.action or "")
	return action == "created" or action == "modified" or action == "updated" or action == "restored" or tostring(version and version.source or "") ~= ""
end

function History:versionMatchesSearch(version)
	local query = string.lower(self.Utils.trim(self.historySearch or ""))
	if query == "" then
		return true
	end
	local haystack = table.concat({ tostring(version.action or ""), tostring(version.actor or ""), tostring(version.summary or ""), tostring(version.timestamp or ""), tostring(version.versionId or ""), tostring(version.source or "") }, " ")
	return string.find(string.lower(haystack), query, 1, true) ~= nil
end

function History:repoWebUrl()
	local remote = tostring((self.gitStatus and self.gitStatus.remoteUrl) or "")
	if remote == "" then
		return nil
	end
	remote = string.gsub(remote, "%.git$", "")
	return remote
end

function History:commitUrl(commit)
	local repo = self:repoWebUrl()
	local hash = commit and commit.hash
	if not repo or not hash or hash == "" then
		return nil
	end
	return repo .. "/commit/" .. tostring(hash)
end

function History:scriptFilePath(scriptPath)
	local path = tostring(scriptPath or "")
	if path == "" then
		return ""
	end
	path = string.gsub(path, "%.", "/")
	if not string.match(path, "%.lua$") and not string.match(path, "%.luau$") then
		path = path .. ".lua"
	end
	return path
end

function History:scriptUrl(commit, scriptPath)
	local repo = self:repoWebUrl()
	local hash = commit and commit.hash
	if not repo or not hash or not scriptPath then
		return nil
	end
	local encoded = self.Utils.urlEncode(self:scriptFilePath(scriptPath)):gsub("%%2F", "/"):gsub("%%2E", ".")
	return repo .. "/blob/" .. tostring(hash) .. "/" .. encoded
end

function History:openCommit(commit)
	local url = self:commitUrl(commit)
	if url then
		self.Utils.openUrl(self.plugin, url, self.manager)
	else
		self.Utils.notify("Set a GitHub remote to open commits in browser.", "StudioLink")
	end
end

function History:openScriptInCommit(commit)
	local url = self:scriptUrl(commit, self.selectedScript)
	if url then
		self.Utils.openUrl(self.plugin, url, self.manager)
	else
		self.Utils.notify("Select a script and set a GitHub remote to open file links.", "StudioLink")
	end
end

function History:groupHistoryVersions()
	local groupsByBucket = {}
	local ordered = {}
	for _, version in ipairs(self.historyVersions or {}) do
		local bucket = self:historyBucket(version.timestamp)
		local group = groupsByBucket[bucket]
		if not group then
			group = { bucket = bucket, versions = {} }
			groupsByBucket[bucket] = group
			table.insert(ordered, group)
		end
		table.insert(group.versions, version)
	end
	table.sort(ordered, function(a, b)
		return tostring(a.bucket) > tostring(b.bucket)
	end)
	for _, group in ipairs(ordered) do
		table.sort(group.versions, function(a, b)
			return tostring(a.timestamp or "") > tostring(b.timestamp or "")
		end)
	end
	return ordered
end

function History:addSectionLabel(text, muted)
	local theme = self.Theme.get()
	local label = self.Utils.makeLabel(self.commitList, text, muted and 12 or 14, theme, muted)
	label.Font = muted and Enum.Font.Gotham or Enum.Font.GothamBold
	label.Size = UDim2.new(1, -8, 0, muted and 24 or 30)
	return label
end

function History:addCommitRow(commit, scriptSpecific)
	local theme = self.Theme.get()
	local row = Instance.new("Frame")
	row.Size = UDim2.new(1, -6, 0, 36)
	row.Parent = self.commitList
	self.Utils.stylePanel(row, theme, "alt")
	local main = self.Utils.makeButton(row, "Repo snapshot · " .. self:formatDate(commit.timestamp) .. " · " .. tostring(commit.message or "snapshot"), theme, self.selectedCommit == commit and "selected" or nil)
	main.TextXAlignment = Enum.TextXAlignment.Left
	main.Position = UDim2.new(0, 8, 0, 5)
	main.Size = UDim2.new(1, scriptSpecific and -214 or -112, 0, 26)
	main.MouseButton1Click:Connect(function()
		self.selectedCommit = commit
		if scriptSpecific and self.selectedScript then
			self:loadDiff(commit)
		else
			self:loadRepoDiff(commit)
		end
	end)
	local openCommit = self.Utils.makeButton(row, "Open", theme)
	openCommit.Position = UDim2.new(1, scriptSpecific and -198 or -96, 0, 5)
	openCommit.Size = UDim2.new(0, 88, 0, 26)
	openCommit.MouseButton1Click:Connect(function()
		self:openCommit(commit)
	end)
	if scriptSpecific then
		local openScript = self.Utils.makeButton(row, "Script", theme)
		openScript.Position = UDim2.new(1, -102, 0, 5)
		openScript.Size = UDim2.new(0, 92, 0, 26)
		openScript.MouseButton1Click:Connect(function()
			self:openScriptInCommit(commit)
		end)
	end
end

function History:renderCommits()
	if not self.commitList then
		return
	end
	local theme = self.Theme.get()
	self.Utils.clearChildren(self.commitList)
	if self.searchInput then
		self.searchInput.Visible = self.activeTab == "history"
	end
	if self.activeTab == "history" then
		self:addSectionLabel("Automatic Script History")
		local groups = self:groupHistoryVersions()
		local shown = 0
		if #groups == 0 then
			local hint = self.Utils.makeLabel(self.commitList, self.selectedScript and "No automatic versions found for this script yet." or "Select a script to see automatic script versions.", 13, theme, true)
			hint.Size = UDim2.new(1, -8, 0, 28)
		end
		for _, group in ipairs(groups) do
			local matching = {}
			for _, version in ipairs(group.versions) do
				if self:versionMatchesSearch(version) then
					table.insert(matching, version)
				end
			end
			if #matching > 0 then
				local expanded = self.expandedHistoryGroups[group.bucket] ~= false
				local groupLabel = (expanded and "Hide " or "Show ") .. group.bucket .. " (" .. tostring(#matching) .. " matching versions)"
				local groupRow = self.Utils.makeButton(self.commitList, groupLabel, theme, expanded and "selected" or nil)
				groupRow.TextXAlignment = Enum.TextXAlignment.Left
				groupRow.Size = UDim2.new(1, -6, 0, 30)
				groupRow.MouseButton1Click:Connect(function()
					self.expandedHistoryGroups[group.bucket] = not expanded
					self:renderCommits()
				end)
				if expanded then
					for _, version in ipairs(matching) do
						shown = shown + 1
						local plus = self:actionChangesContent(version) and " +" or ""
						local versionNumber = tonumber(version.versionNumber) or shown
						local label = "    v" .. tostring(versionNumber) .. " · " .. self:actionLabel(version.action) .. plus .. " · " .. self:formatDate(version.timestamp) .. " · " .. tostring(version.actor or "daemon") .. " · " .. tostring(version.summary or "")
						local versionSelected = self.selectedVersion and self.selectedVersion.versionId == version.versionId
						local row = self.Utils.makeButton(self.commitList, label, theme, versionSelected and "selected" or self:actionVariant(version.action))
						self:styleActionRow(row, version.action, versionSelected)
						row.TextXAlignment = Enum.TextXAlignment.Left
						row.Size = UDim2.new(1, -6, 0, 30)
						row.MouseButton1Click:Connect(function()
							self.selectedVersion = version
							self.selectedCommit = nil
							self:renderCommits()
							self:renderDiff(self:actionLabel(version.action) .. " · " .. self:formatDate(version.timestamp) .. "\nActor: " .. tostring(version.actor or "daemon") .. "\nSummary: " .. tostring(version.summary or "") .. "\n\n" .. tostring(version.source or "Source hidden for this version."))
						end)
					end
				end
			end
		end
		if self.historySearch ~= "" and shown == 0 then
			local empty = self.Utils.makeLabel(self.commitList, "No script versions match your search.", 13, theme, true)
			empty.Size = UDim2.new(1, -8, 0, 28)
		end
	elseif self.activeTab == "deleted" then
		local hint = self.Utils.makeLabel(self.commitList, "Select a deleted script to preview and restore it.", 13, theme, true)
		hint.Size = UDim2.new(1, -8, 0, 28)
	else
		self:addSectionLabel("Git Snapshots / Repo Checkpoints")
		self:addSectionLabel("Repo-level commits. Click one to see what changed across the whole place repo.", true)
		if not self:repoWebUrl() then
			self:addSectionLabel("Set a GitHub remote to enable commit/file links.", true)
		end
		for _, commit in ipairs(self.commits) do
			self:addCommitRow(commit, false)
		end
	end
end

function History:render()
	if not self.root then
		return
	end
	local theme = self.Theme.get()
	self.root.BackgroundColor3 = theme.background
	self.left.BackgroundColor3 = theme.surface
	self.right.BackgroundColor3 = theme.background
	self.commitList.BackgroundColor3 = theme.surface
	self.diffFrame.BackgroundColor3 = theme.panel
	self.bottom.BackgroundColor3 = theme.toolbar
	self.Utils.stylePanel(self.tabBar, theme, "toolbar")
	self.Utils.stylePanel(self.left, theme, "alt")
	self.Utils.stylePanel(self.commitList, theme, "alt")
	self.Utils.stylePanel(self.diffFrame, theme, "large")
	self.Utils.stylePanel(self.bottom, theme, "toolbar")
	self.commitInput.BackgroundColor3 = theme.panel
	self.commitInput.BorderColor3 = theme.border
	self.commitInput.TextColor3 = theme.text
	self.commitInput.PlaceholderColor3 = theme.textMuted
	self.scriptSearchInput.BackgroundColor3 = theme.panel
	self.scriptSearchInput.BorderColor3 = theme.border
	self.scriptSearchInput.TextColor3 = theme.text
	self.scriptSearchInput.PlaceholderColor3 = theme.textMuted
	self.searchInput.BackgroundColor3 = theme.panel
	self.searchInput.BorderColor3 = theme.border
	self.searchInput.TextColor3 = theme.text
	self.searchInput.PlaceholderColor3 = theme.textMuted
	for _, button in ipairs({ self.restoreButton, self.commitButton, self.pushButton, self.pullButton, self.autoRemoteButton, self.remoteButton }) do
		self.Utils.styleButton(button, theme)
	end
	for key, button in pairs(self.tabButtons or {}) do
		self.Utils.styleButton(button, theme, key == self.activeTab and "selected" or nil)
	end
	self:renderLists()
	self:renderCommits()
	if not self.selectedScript and not self.selectedDeleted then
		self:renderDiff("Select a script on the left to see only that script's automatic versions. Use Git Snapshots for whole-repo checkpoints.")
	end
end

function History:renderDiff(text)
	if not self.diffFrame then
		return
	end
	local theme = self.Theme.get()
	self.Utils.clearChildren(self.diffFrame)
	local content = tostring(text or "")
	if content == "" then
		content = " "
	end
	for line in string.gmatch(content .. "\n", "([^\n]*)\n") do
		if line == "" then
			line = " "
		end
		if line ~= nil then
			local label = Instance.new("TextLabel")
			label.BackgroundTransparency = 1
			label.Font = Enum.Font.Code
			label.TextSize = 13
			label.TextXAlignment = Enum.TextXAlignment.Left
			label.Text = line
			label.Size = UDim2.new(1, -8, 0, 18)
			local first = string.sub(line, 1, 1)
			label.TextColor3 = first == "+" and theme.green or (first == "-" and theme.red or theme.text)
			label.Parent = self.diffFrame
		end
	end
end

function History:selectScript(path, scriptRecord)
	self.selectedScript = path
	self.selectedScriptRecord = scriptRecord
	self.selectedScriptUniqueId = scriptRecord and scriptRecord.uniqueId
	self.selectedVersion = nil
	self.selectedCommit = nil
	self.selectedDeleted = nil
	self.historyVersions = {}
	self:renderLists()
	self:renderCommits()
	if self.activeTab == "git" then
		self:renderDiff("Loading commits for " .. path .. "...")
		self.manager:send("git:log", { limit = 50 }, function(payload)
			self.commits = payload.commits or {}
			self:renderDiff("Select a commit to view diff for " .. path)
			self:renderCommits()
		end)
		return
	end
	self:renderDiff("Loading script history for " .. path .. "...")
	self.manager:send("history:get", { path = path, includeSource = true }, function(payload)
		self.historyVersions = payload.versions or {}
		self:renderDiff("Select a version to preview " .. path)
		self:renderCommits()
	end)
end

function History:selectDeleted(deletedRecord)
	self.selectedDeleted = deletedRecord
	self.selectedScript = deletedRecord.path
	self:renderDiff("Deleted: " .. tostring(deletedRecord.path) .. "\nDeleted at: " .. tostring(deletedRecord.deletedAt or "unknown") .. "\nSize: " .. tostring(deletedRecord.size or 0) .. " bytes\n\n" .. tostring(deletedRecord.lastKnownSource or "Source hidden."))
end

function History:loadDiff(commit)
	if not self.selectedScript then
		self:loadRepoDiff(commit)
		return
	end
	self:renderDiff("Loading script diff inside repo snapshot...")
	self.manager:send("git:diff", { path = self:scriptFilePath(self.selectedScript), fromCommit = commit.hash }, function(payload)
		self.diff = payload.diff or "No diff."
		self:renderDiff("Script diff inside repo snapshot\nScript: " .. tostring(self.selectedScript) .. "\nSnapshot: " .. string.sub(tostring(commit.hash or ""), 1, 7) .. " · " .. self:formatDate(commit.timestamp) .. "\n\n" .. self.diff)
	end)
end

function History:loadRepoDiff(commit)
	self:renderDiff("Loading repo snapshot diff...")
	self.manager:send("git:diff", { path = ".", fromCommit = commit.hash }, function(payload)
		self.diff = payload.diff or "No diff."
		self:renderDiff("Repo snapshot diff\nSnapshot: " .. string.sub(tostring(commit.hash or ""), 1, 7) .. " · " .. self:formatDate(commit.timestamp) .. "\nThis is a whole-project checkpoint, not one script version.\n\n" .. self.diff)
	end)
end

function History:confirmRestore(message, onConfirm)
	local theme = self.Theme.get()
	local popup = Instance.new("Frame")
	popup.Name = "ConfirmRestore"
	popup.Size = UDim2.new(0, 430, 0, 132)
	popup.Position = UDim2.new(0.5, -215, 0.5, -66)
	popup.BackgroundColor3 = theme.panel
	popup.BorderColor3 = theme.border
	popup.Parent = self.root
	self.Utils.stylePanel(popup, theme, "large")
	local title = self.Utils.makeLabel(popup, "Confirm Restore", 18, theme)
	title.Font = Enum.Font.GothamBold
	title.Position = UDim2.new(0, 12, 0, 10)
	title.Size = UDim2.new(1, -24, 0, 24)
	local body = self.Utils.makeLabel(popup, message, 13, theme, true)
	body.Position = UDim2.new(0, 12, 0, 42)
	body.Size = UDim2.new(1, -24, 0, 42)
	local cancel = self.Utils.makeButton(popup, "Cancel", theme)
	cancel.Position = UDim2.new(1, -188, 1, -38)
	cancel.Size = UDim2.new(0, 82, 0, 28)
	cancel.MouseButton1Click:Connect(function()
		popup:Destroy()
	end)
	local restore = self.Utils.makeButton(popup, "Restore", theme)
	restore.Position = UDim2.new(1, -96, 1, -38)
	restore.Size = UDim2.new(0, 84, 0, 28)
	restore.MouseButton1Click:Connect(function()
		popup:Destroy()
		onConfirm()
	end)
end

function History:restoreDeleted(scriptRecord)
	self:confirmRestore("Restore deleted script " .. tostring(scriptRecord.path) .. " back into Studio?", function()
		self.manager:send("script:restore", {
			path = scriptRecord.path,
			uniqueId = scriptRecord.uniqueId,
			versionId = scriptRecord.versionId or scriptRecord.lastVersionId,
			summary = "restore: " .. scriptRecord.path,
			pendingStudioDeploy = true,
		}, function(payload)
			if self.callbacks.applyScript and payload.script then
				self.callbacks.applyScript(payload.script)
			end
			self:refresh()
		end)
	end)
end

function History:restoreSelected()
	if self.activeTab == "deleted" then
		if not self.selectedDeleted then
			self.Utils.notify("Select a deleted script first")
			return
		end
		self:restoreDeleted(self.selectedDeleted)
		return
	end
	if self.activeTab == "history" then
		if not self.selectedScript or not self.selectedVersion then
			self.Utils.notify("Select a script version first")
			return
		end
		self:confirmRestore("Restore " .. tostring(self.selectedScript) .. " to selected history version?", function()
			self.manager:send("script:restore", {
				path = self.selectedScript,
				uniqueId = self.selectedVersion.uniqueId,
				versionId = self.selectedVersion.versionId,
				summary = "restore: " .. self.selectedScript,
				pendingStudioDeploy = true,
			}, function(payload)
				if self.callbacks.applyScript and payload.script then
					self.callbacks.applyScript(payload.script)
				end
				self:refresh()
			end)
		end)
		return
	end
	if not self.selectedScript or not self.selectedCommit then
		self.Utils.notify("Select a script and commit first")
		return
	end
	local hash = self.selectedCommit.hash
	self:confirmRestore("Restore " .. tostring(self.selectedScript) .. " to git commit " .. string.sub(hash, 1, 7) .. "?", function()
		self.manager:send("git:restore", { path = self.selectedScript, commit = hash, summary = "restore: " .. self.selectedScript .. " to " .. string.sub(hash, 1, 7) }, function(payload)
			if self.callbacks.applyScript and payload.script then
				self.callbacks.applyScript(payload.script)
			end
			self.manager:send("git:commit", { message = "restore: " .. self.selectedScript .. " to " .. string.sub(hash, 1, 7) }, function()
				self:refresh()
			end)
		end)
	end)
end

function History:promptRemote()
	local theme = self.Theme.get()
	local existing = self.root:FindFirstChild("RemotePrompt")
	if existing then
		existing:Destroy()
	end
	local popup = Instance.new("Frame")
	popup.Name = "RemotePrompt"
	popup.Size = UDim2.new(0, 420, 0, 92)
	popup.Position = UDim2.new(0.5, -210, 0.5, -46)
	popup.BackgroundColor3 = theme.panel
	popup.BorderColor3 = theme.border
	popup.Parent = self.root
	self.Utils.stylePanel(popup, theme, "large")
	local input = Instance.new("TextBox")
	input.PlaceholderText = "https://github.com/user/repo.git"
	input.Text = ""
	input.ClearTextOnFocus = false
	input.BackgroundColor3 = theme.background
	input.BorderColor3 = theme.border
	input.TextColor3 = theme.text
	input.PlaceholderColor3 = theme.textMuted
	input.Position = UDim2.new(0, 10, 0, 12)
	input.Size = UDim2.new(1, -20, 0, 30)
	input.Parent = popup
	local cancel = self.Utils.makeButton(popup, "Close", theme)
	cancel.Position = UDim2.new(1, -212, 0, 52)
	cancel.Size = UDim2.new(0, 82, 0, 28)
	cancel.MouseButton1Click:Connect(function()
		popup:Destroy()
	end)
	local save = self.Utils.makeButton(popup, "Save Remote", theme)
	save.Position = UDim2.new(1, -120, 0, 52)
	save.Size = UDim2.new(0, 110, 0, 28)
	save.MouseButton1Click:Connect(function()
		self.manager:send("git:setRemote", { remoteUrl = self.Utils.trim(input.Text) }, function()
			popup:Destroy()
			self:refresh()
		end)
	end)
end

function History:refresh()
	self.manager:send("script:list", { includeSource = false, includeDeleted = true }, function(payload)
		self.scripts = payload.scripts or {}
		self:renderLists()
	end)
	self.manager:send("history:getDeleted", { includeSource = true }, function(payload)
		self.deleted = payload.scripts or {}
		self:renderLists()
	end)
	self.manager:send("git:status", {}, function(payload)
		self.gitStatus = payload
		self:renderLists()
	end)
	self.manager:send("git:log", { limit = 50 }, function(payload)
		self.commits = payload.commits or {}
		self:renderCommits()
	end)
end

function History:open()
	self.transitionToken = (self.transitionToken or 0) + 1
	self:createWidget()
	self.Utils.prepareFadeIn(self.root)
	self.widget.Enabled = true
	self.Utils.animateIn(self.root)
	self:refresh()
end

function History:close()
	if self.widget and self.widget.Enabled then
		self.transitionToken = (self.transitionToken or 0) + 1
		local token = self.transitionToken
		self.Utils.animateOut(self.root, function()
			if self.transitionToken == token and self.widget then
				self.widget.Enabled = false
			end
		end)
	end
end

return History
end

local function load_AgentLog()
local AgentLog = {}
AgentLog.__index = AgentLog

local TAGS = {
	["script_write"] = "EDIT",
	["script_create"] = "NEW",
	["script_delete"] = "DELETE",
	["script_rename"] = "RENAME",
	["script_restore"] = "RESTORE",
	["script_cleanup_stale"] = "CLEANUP",
	["watch:created"] = "NEW",
	["watch:updated"] = "EDIT",
	["watch:deleted"] = "DELETE",
	["watch:renamed"] = "MOVE",
	["watch:restored"] = "RESTORE",
	["git_commit"] = "COMMIT",
	["git_restore"] = "REVERT",
	["git_push"] = "PUSH",
	["git_pull"] = "PULL",
	["git:commit"] = "COMMIT",
	error = "ERROR",
}

function AgentLog.new(plugin, manager, Theme, Utils, callbacks)
	local self = setmetatable({}, AgentLog)
	self.plugin = plugin
	self.manager = manager
	self.Theme = Theme
	self.Utils = Utils
	self.callbacks = callbacks or {}
	self.actions = {}
	self.actionKeys = {}
	self.clearedBefore = tostring((plugin and plugin:GetSetting("activityClearedBefore")) or "")
	self.widget = nil
	self.list = nil
	manager:on("agent:action", function(payload)
		self:addAction(payload)
	end)
	manager:on("agent:recentActions:response", function(payload)
		self:setActions(payload.actions or {})
	end)
	manager:on("watch:event", function(payload)
		self:addWatchEvent(payload)
	end)
	manager:on("error", function(payload)
		self:addAction({ timestamp = "now", tool = "error", summary = tostring(payload.message or payload.code or "Daemon error"), error = true })
	end)
	Theme.onChanged(function()
		self:render()
	end)
	return self
end

function AgentLog:createWidget()
	if self.widget then
		return
	end
	local info = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 520, 520, 340, 320)
	self.widget = self.plugin:CreateDockWidgetPluginGui("StudioLinkAgentLog", info)
	self.widget.Title = "StudioLink Activity"
	self.widget:GetPropertyChangedSignal("Enabled"):Connect(function()
		if not self.widget.Enabled and self.callbacks.onClosed then
			self.callbacks.onClosed()
		end
	end)
	local theme = self.Theme.get()
	local root = Instance.new("Frame")
	root.Name = "Root"
	root.Size = UDim2.fromScale(1, 1)
	root.BackgroundColor3 = theme.background
	root.Parent = self.widget
	self.root = root

	local header = Instance.new("Frame")
	header.Name = "Header"
	header.Size = UDim2.new(1, 0, 0, 44)
	header.Parent = root
	self.header = header
	self.Utils.stylePanel(header, self.Theme.get(), "toolbar")
	local title = self.Utils.makeLabel(header, "Activity", 18, self.Theme.get())
	title.Font = Enum.Font.GothamBold
	title.Position = UDim2.new(0, 14, 0, 10)
	title.Size = UDim2.new(1, -130, 0, 24)
	self.clearButton = self.Utils.makeButton(header, "Clear Log", self.Theme.get())
	self.clearButton.Position = UDim2.new(1, -104, 0, 8)
	self.clearButton.Size = UDim2.new(0, 90, 0, 28)
	self.clearButton.MouseButton1Click:Connect(function()
		self.clearedBefore = DateTime.now():ToIsoDate()
		if self.plugin then
			self.plugin:SetSetting("activityClearedBefore", self.clearedBefore)
		end
		self.actions = {}
		self.actionKeys = {}
		self:render()
	end)

	self.list = Instance.new("ScrollingFrame")
	self.list.Name = "Actions"
	self.list.Position = UDim2.new(0, 0, 0, 44)
	self.list.Size = UDim2.new(1, 0, 1, -44)
	self.list.BorderSizePixel = 0
	self.list.ScrollBarThickness = 8
	self.list.CanvasSize = UDim2.new()
	self.list.AutomaticCanvasSize = Enum.AutomaticSize.Y
	self.list.Parent = root
	self.Utils.stylePanel(self.list, self.Theme.get(), "alt")
	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, 6)
	layout.Parent = self.list
	local padding = Instance.new("UIPadding")
	padding.PaddingTop = UDim.new(0, 10)
	padding.PaddingLeft = UDim.new(0, 10)
	padding.PaddingRight = UDim.new(0, 10)
	padding.Parent = self.list
	self:render()
end

function AgentLog:setActions(actions)
	self.actions = {}
	self.actionKeys = {}
	for i = #actions, 1, -1 do
		self:addAction(actions[i], true)
	end
	self:render()
end

function AgentLog:addWatchEvent(payload)
	if not payload or payload.origin == "studio-snapshot" then
		return
	end
	local kind = tostring(payload.kind or "")
	local path = tostring(payload.path or (payload.script and payload.script.path) or "script")
	local labels = {
		created = "Created ",
		updated = "Modified ",
		deleted = "Deleted ",
		renamed = "Renamed/moved ",
		restored = "Restored ",
	}
	local prefix = labels[kind]
	if not prefix then
		return
	end
	local summary = prefix .. path
	if kind == "renamed" and payload.oldPath then
		summary = "Renamed/moved " .. tostring(payload.oldPath) .. " → " .. path
	end
	self:addAction({ timestamp = tostring(payload.timestamp or "now"), tool = "watch:" .. kind, summary = summary })
end

function AgentLog:isCleared(action)
	local cutoff = tostring(self.clearedBefore or "")
	if cutoff == "" then
		return false
	end
	local timestamp = tostring(action and action.timestamp or "")
	return timestamp ~= "" and timestamp <= cutoff
end

function AgentLog:addAction(action, skipRender)
	if not action or self:isCleared(action) then
		return
	end
	local key = tostring(action.id or "")
	if key == "" then
		key = tostring(action.tool or "action") .. ":" .. tostring(action.timestamp or "now") .. ":" .. tostring(action.summary or "")
	end
	if self.actionKeys[key] then
		return
	end
	self.actionKeys[key] = true
	table.insert(self.actions, 1, action)
	while #self.actions > 200 do
		local removed = table.remove(self.actions)
		if removed then
			local removedKey = tostring(removed.id or "")
			if removedKey == "" then
				removedKey = tostring(removed.tool or "action") .. ":" .. tostring(removed.timestamp or "now") .. ":" .. tostring(removed.summary or "")
			end
			self.actionKeys[removedKey] = nil
		end
	end
	if not skipRender then
		self:render()
	end
end

function AgentLog:render()
	if not self.root then
		return
	end
	local theme = self.Theme.get()
	self.root.BackgroundColor3 = theme.background
	self.list.BackgroundColor3 = theme.background
	self.Utils.stylePanel(self.header, theme, "toolbar")
	self.Utils.stylePanel(self.list, theme, "alt")
	self.Utils.styleButton(self.clearButton, theme)
	self.Utils.clearChildren(self.list)
	for _, action in ipairs(self.actions) do
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, -6, 0, 54)
		row.Parent = self.list
		self.Utils.stylePanel(row, theme, "large")
		local tag = TAGS[action.tool] or (action.error and TAGS.error) or "ACTION"
		local pill = self.Utils.makePill(row, tag, action.error and theme.red or theme.accentSoft, theme)
		pill.Position = UDim2.new(0, 10, 0, 10)
		local summary = self.Utils.makeLabel(row, tostring(action.summary or action.tool or "Action"), 13, theme)
		summary.Position = UDim2.new(0, 92, 0, 8)
		summary.Size = UDim2.new(1, -104, 0, 22)
		local timestamp = self.Utils.makeLabel(row, tostring(action.timestamp or "now"), 11, theme, true)
		timestamp.Position = UDim2.new(0, 92, 0, 30)
		timestamp.Size = UDim2.new(1, -104, 0, 16)
	end
end

function AgentLog:open()
	self.transitionToken = (self.transitionToken or 0) + 1
	self:createWidget()
	self.Utils.prepareFadeIn(self.root)
	self.widget.Enabled = true
	self.Utils.animateIn(self.root)
	self.manager:send("agent:recentActions", {}, function(payload)
		self:setActions(payload.actions or {})
	end)
end

function AgentLog:close()
	if self.widget and self.widget.Enabled then
		self.transitionToken = (self.transitionToken or 0) + 1
		local token = self.transitionToken
		self.Utils.animateOut(self.root, function()
			if self.transitionToken == token and self.widget then
				self.widget.Enabled = false
			end
		end)
	end
end

return AgentLog
end

--[[
	StudioLink Roblox Studio plugin
	HTTP RPC bridge for http://127.0.0.1:45678.

	Preserves the RoAgent script scanning, path resolution, live feed watching,
	and suppression primitives while using the StudioLink HTTP RPC transport
	and StudioLink panels.
--]]

local PLUGIN_VERSION = "1.0.8"
local SOURCE_DEBOUNCE_SECONDS = 0.5

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")

if RunService:IsRunning() then
	return
end

local Theme = load_Theme()
local Utils = load_Utils()
local ConnectionManager = load_ConnectionManager()
local HomePanel = load_Home()
local HistoryPanel = load_History()
local AgentLogPanel = load_AgentLog()

local ROOT_SERVICES = {
	"ServerScriptService",
	"ServerStorage",
	"ReplicatedStorage",
	"ReplicatedFirst",
	"StarterGui",
	"StarterPack",
	"StarterPlayer",
	"Lighting",
	"Teams",
	"SoundService",
	"Chat",
}

local SPECIAL_PATHS = {
	StarterPlayerScripts = { service = "StarterPlayer", property = "StarterPlayerScripts" },
	StarterCharacterScripts = { service = "StarterPlayer", property = "StarterCharacterScripts" },
}

local watchedScripts = {}
local watchedContainers = {}
local sourceDebounceTokens = {}
local uniqueIdOwners = {}
local suppressPaths = {}
local liveStarted = false
local connection = nil
local panels = {}
local activePanelName = nil
local initialSnapshotSent = false
local initialSnapshotSynced = false
local panelsDisabled = false
local suppressPanelCloseSetting = false
local autoGithubRemoteAttempted = false

local function isScript(inst)
	return inst and (inst:IsA("Script") or inst:IsA("LocalScript") or inst:IsA("ModuleScript"))
end

local function isAllowedRoot(path)
	local root = string.match(tostring(path or ""), "^[^%.]+") or ""
	if root == "StarterPlayerScripts" or root == "StarterCharacterScripts" then
		return true
	end
	for _, name in ipairs(ROOT_SERVICES) do
		if root == name then
			return true
		end
	end
	return false
end

local function isManagedScriptPath(path)
	path = tostring(path or "")
	if path == "" or string.find(path, "%.%.", 1, true) or string.find(path, "//", 1, true) then
		return false
	end
	if not isAllowedRoot(path) then
		return false
	end
	if string.sub(path, 1, 10) == "Workspace." or path == "Workspace" then
		return false
	end
	if string.sub(path, 1, 8) == "Players." or path == "Players" then
		return false
	end
	local lowerPath = string.lower(path)
	local leaf = string.match(path, "[^%.]+$") or path
	local lowerLeaf = string.lower(leaf)
	if string.match(lowerLeaf, "^roagent%d*$") or string.match(lowerLeaf, "^roagentupdate%d*$") or string.match(lowerLeaf, "^studiolink") then
		return false
	end
	if string.find(lowerPath, "playermodule", 1, true) or string.find(lowerPath, "camerascript", 1, true) or string.find(lowerPath, "controlscript", 1, true) then
		return false
	end
	if lowerLeaf == "animate" then
		return false
	end
	return true
end

local function getRootServices()
	local services = {}
	for _, name in ipairs(ROOT_SERVICES) do
		local ok, svc = pcall(function()
			if name == "Workspace" then
				return workspace
			end
			return game:GetService(name)
		end)
		if ok and svc then
			table.insert(services, svc)
		end
	end
	return services
end

local function getFullPath(instance)
	local parts = {}
	local current = instance
	while current and current ~= game do
		table.insert(parts, 1, current.Name)
		current = current.Parent
	end
	return table.concat(parts, ".")
end

local function isManagedScript(inst)
	if not isScript(inst) then
		return false
	end
	if script and (inst == script or inst:IsDescendantOf(script)) then
		return false
	end
	return isManagedScriptPath(getFullPath(inst))
end

local function getPlaceInfo()
	local rawPlaceId = tonumber(game.PlaceId) or 0
	local placeId = tostring(rawPlaceId)
	if rawPlaceId <= 0 then
		placeId = "unsaved-" .. HttpService:GenerateGUID(false)
	end
	return {
		placeName = game.Name or "Untitled",
		placeId = placeId,
		gameId = tostring(game.GameId or 0),
		jobId = game.JobId or "",
	}
end

local function getScriptSource(scriptInstance)
	local ok, source = pcall(function()
		return scriptInstance.Source
	end)
	if ok and type(source) == "string" then
		return source
	end
	return ""
end

local function rememberUniqueId(instance, uniqueId, isFallback)
	local owner = uniqueIdOwners[uniqueId]
	if owner and owner ~= instance and owner.Parent ~= nil then
		if isFallback then
			local generated = HttpService:GenerateGUID(false)
			pcall(function()
				instance:SetAttribute("RoAgentUniqueId", generated)
			end)
			uniqueIdOwners[generated] = instance
			return generated
		end
	end
	uniqueIdOwners[uniqueId] = instance
	return uniqueId
end

local function getUniqueId(instance)
	local ok, uniqueId = pcall(function()
		return instance.UniqueId
	end)
	if ok and uniqueId ~= nil then
		local text = tostring(uniqueId)
		if text ~= "" then
			return rememberUniqueId(instance, text, false)
		end
	end

	local attrOk, attrValue = pcall(function()
		return instance:GetAttribute("RoAgentUniqueId")
	end)
	if attrOk and type(attrValue) == "string" and attrValue ~= "" then
		return rememberUniqueId(instance, attrValue, true)
	end

	local generated = HttpService:GenerateGUID(false)
	pcall(function()
		instance:SetAttribute("RoAgentUniqueId", generated)
	end)
	uniqueIdOwners[generated] = instance
	return generated
end

local function scanScripts()
	local scripts = {}
	local function scan(container)
		for _, child in ipairs(container:GetChildren()) do
			if isManagedScript(child) then
				local source = getScriptSource(child)
				table.insert(scripts, {
					path = getFullPath(child),
					className = child.ClassName,
					uniqueId = getUniqueId(child),
					source = source,
					size = #source,
				})
			else
				scan(child)
			end
		end
	end
	for _, svc in ipairs(getRootServices()) do
		scan(svc)
	end
	return scripts
end

local function getServiceByPathPart(name)
	local special = SPECIAL_PATHS[name]
	if special then
		local ok, svc = pcall(function()
			return game:GetService(special.service)
		end)
		if ok and svc then
			return svc[special.property]
		end
	end
	if name == "Workspace" or name == "workspace" then
		return workspace
	end
	local ok, svc = pcall(function()
		return game:GetService(name)
	end)
	if ok and svc then
		return svc
	end
	return game:FindFirstChild(name)
end

local function normalizeScriptPath(path, className)
	local text = tostring(path or "")
	text = string.gsub(text, "\\", "/")
	local inferredClassName = className
	local function normalizeLeaf(leaf)
		if string.match(leaf, "%.server%.lua$") or string.match(leaf, "%.server%.luau$") then
			inferredClassName = inferredClassName or "Script"
			leaf = string.gsub(leaf, "%.server%.lua$", "")
			leaf = string.gsub(leaf, "%.server%.luau$", "")
			return leaf
		end
		if string.match(leaf, "%.client%.lua$") or string.match(leaf, "%.client%.luau$") then
			inferredClassName = inferredClassName or "LocalScript"
			leaf = string.gsub(leaf, "%.client%.lua$", "")
			leaf = string.gsub(leaf, "%.client%.luau$", "")
			return leaf
		end
		if string.match(leaf, "%.lua$") or string.match(leaf, "%.luau$") then
			inferredClassName = inferredClassName or "ModuleScript"
			leaf = string.gsub(leaf, "%.lua$", "")
			leaf = string.gsub(leaf, "%.luau$", "")
			return leaf
		end
		return leaf
	end
	if string.find(text, "/", 1, true) then
		local parts = {}
		for part in string.gmatch(text, "[^/]+") do
			table.insert(parts, part)
		end
		if #parts > 0 then
			parts[#parts] = normalizeLeaf(parts[#parts])
		end
		text = table.concat(parts, ".")
	else
		text = normalizeLeaf(text)
	end
	return text, inferredClassName
end

local function splitPath(path)
	local normalized = normalizeScriptPath(path)
	local parts = {}
	for part in string.gmatch(normalized or "", "[^.]+") do
		table.insert(parts, part)
	end
	return parts
end

local function resolvePath(path, createFolders)
	local parts = splitPath(path)
	if #parts == 0 then
		return nil, nil
	end
	local current = getServiceByPathPart(parts[1])
	if not current then
		return nil, nil
	end
	for i = 2, #parts - 1 do
		local child = current:FindFirstChild(parts[i])
		if not child and createFolders then
			child = Instance.new("Folder")
			child.Name = parts[i]
			child.Parent = current
		end
		if not child then
			return nil, nil
		end
		current = child
	end
	return current, parts[#parts]
end

local function findScriptByUniqueId(uniqueId)
	if not uniqueId or uniqueId == "" then
		return nil
	end
	for _, svc in ipairs(getRootServices()) do
		for _, descendant in ipairs(svc:GetDescendants()) do
			if isManagedScript(descendant) and getUniqueId(descendant) == uniqueId then
				return descendant
			end
		end
	end
	return nil
end

local function findScript(path, uniqueId)
	local byId = findScriptByUniqueId(uniqueId)
	if byId then
		return byId
	end
	local normalizedPath = normalizeScriptPath(path)
	local container, name = resolvePath(normalizedPath, false)
	if not container then
		return nil
	end
	local child = container:FindFirstChild(name)
	if isScript(child) then
		return child
	end
	return nil
end

local function releaseSuppressionLater(path)
	task.delay(1, function()
		suppressPaths[path] = math.max((suppressPaths[path] or 1) - 1, 0)
		if suppressPaths[path] == 0 then
			suppressPaths[path] = nil
		end
	end)
end

local function withSuppressed(path, fn)
	suppressPaths[path] = (suppressPaths[path] or 0) + 1
	local ok, result = pcall(fn)
	releaseSuppressionLater(path)
	if not ok then
		Utils.notify(result)
		return false, result
	end
	return true, result
end

local function upsertScript(path, source, className, uniqueId)
	local normalizedPath, normalizedClassName = normalizeScriptPath(path, className)
	if not isManagedScriptPath(normalizedPath) then
		return nil
	end
	className = normalizedClassName or className or "Script"
	return withSuppressed(normalizedPath, function()
		local container, name = resolvePath(normalizedPath, true)
		if not container then
			error("Cannot resolve container for " .. tostring(path))
		end
		local existing = findScriptByUniqueId(uniqueId) or container:FindFirstChild(name)
		if existing then
			if not isScript(existing) then
				error("Refusing to replace non-script instance at " .. tostring(normalizedPath))
			end
			if existing.ClassName ~= className then
				error("Refusing to replace " .. tostring(existing.ClassName) .. " with " .. tostring(className) .. " at " .. tostring(normalizedPath))
			end
			existing.Source = source or ""
			return existing
		end
		local inst = Instance.new(className)
		inst.Name = name
		inst.Source = source or ""
		inst.Parent = container
		return inst
	end)
end

local function deleteScript(path, uniqueId)
	local normalizedPath = normalizeScriptPath(path)
	if not isManagedScriptPath(normalizedPath) then
		return false
	end
	return withSuppressed(normalizedPath, function()
		local scriptInstance = findScript(normalizedPath, uniqueId)
		if scriptInstance then
			scriptInstance:Destroy()
		end
		return true
	end)
end

local function reconcileInitialSnapshot(_daemonScripts)
	if initialSnapshotSent or not connection then
		return false
	end
	initialSnapshotSent = true
	local studioScripts = scanScripts()
	connection:send("script:syncSnapshot", {
		scripts = studioScripts,
		summary = "Authoritative Studio snapshot sync",
	}, function()
		initialSnapshotSynced = true
	end, { queueIfDisconnected = true })
	return true
end

local function pushLive(event, scriptInstance, explicitPath, explicitSource, explicitClassName, explicitOldPath, explicitUniqueId)
	local path = explicitPath or (scriptInstance and getFullPath(scriptInstance))
	if not path or path == "" then
		return
	end
	if suppressPaths[path] then
		return
	end
	local className = explicitClassName or (scriptInstance and scriptInstance.ClassName) or "Script"
	local uniqueId = explicitUniqueId or (scriptInstance and getUniqueId(scriptInstance))
	local source = explicitSource
	if source == nil and scriptInstance and event ~= "deleted" then
		source = getScriptSource(scriptInstance)
	end
	if source == nil then
		source = ""
	end
	if not connection then
		return
	end
	if event == "created" then
		connection:sendScriptEvent("script:create", {
			path = path,
			uniqueId = uniqueId,
			className = className,
			source = source,
			createParents = true,
			overwrite = true,
			summary = "Created " .. path,
			origin = "studio-plugin",
		})
	elseif event == "updated" then
		connection:sendScriptEvent("script:write", {
			path = path,
			uniqueId = uniqueId,
			className = className,
			source = source,
			summary = "Updated " .. path,
			origin = "studio-plugin",
		})
	elseif event == "deleted" then
		connection:sendScriptEvent("script:delete", {
			path = path,
			uniqueId = uniqueId,
			summary = "Deleted " .. path,
			origin = "studio-plugin",
		})
	elseif event == "renamed" then
		connection:sendScriptEvent("script:rename", {
			fromPath = explicitOldPath,
			uniqueId = uniqueId,
			toPath = path,
			createParents = true,
			summary = "Renamed " .. tostring(explicitOldPath) .. " to " .. path,
			origin = "studio-plugin",
		})
	end
end

local function emitDeleted(scriptInstance, explicitPath, explicitClassName)
	local state = watchedScripts[scriptInstance]
	local path = explicitPath or (state and state.path) or getFullPath(scriptInstance)
	local className = explicitClassName or (state and state.className) or scriptInstance.ClassName
	if not path or path == "" then
		return
	end
	if state and state.deletedSent then
		return
	end
	if suppressPaths[path] then
		return
	end
	if state then
		state.deletedSent = true
	end
	pushLive("deleted", nil, path, "", className, nil, state and state.uniqueId)
end

local function watchScript(scriptInstance)
	if watchedScripts[scriptInstance] or not isManagedScript(scriptInstance) then
		return
	end
	local state = {
		path = getFullPath(scriptInstance),
		className = scriptInstance.ClassName,
		uniqueId = getUniqueId(scriptInstance),
		deletedSent = false,
	}
	watchedScripts[scriptInstance] = state

	scriptInstance:GetPropertyChangedSignal("Source"):Connect(function()
		if not scriptInstance.Parent then
			return
		end
		local currentPath = getFullPath(scriptInstance)
		if suppressPaths[currentPath] or suppressPaths[state.path] then
			return
		end
		local token = (sourceDebounceTokens[scriptInstance] or 0) + 1
		sourceDebounceTokens[scriptInstance] = token
		task.delay(SOURCE_DEBOUNCE_SECONDS, function()
			if sourceDebounceTokens[scriptInstance] ~= token then
				return
			end
			if not scriptInstance.Parent then
				return
			end
			local latestPath = getFullPath(scriptInstance)
			if suppressPaths[latestPath] or suppressPaths[state.path] then
				return
			end
			state.path = latestPath
			state.className = scriptInstance.ClassName
			pushLive("updated", scriptInstance, latestPath)
		end)
	end)

	scriptInstance:GetPropertyChangedSignal("Name"):Connect(function()
		if not scriptInstance.Parent then
			return
		end
		local oldPath = state.path
		local newPath = getFullPath(scriptInstance)
		if oldPath == newPath then
			return
		end
		if not suppressPaths[oldPath] and not suppressPaths[newPath] then
			pushLive("renamed", scriptInstance, newPath, nil, state.className, oldPath)
		end
		state.path = newPath
		state.className = scriptInstance.ClassName
		state.uniqueId = getUniqueId(scriptInstance)
		state.deletedSent = false
	end)

	scriptInstance.Destroying:Connect(function()
		emitDeleted(scriptInstance)
	end)

	scriptInstance.AncestryChanged:Connect(function(_, parent)
		if parent == nil then
			task.defer(function()
				if not scriptInstance.Parent then
					emitDeleted(scriptInstance)
				end
			end)
			return
		end
		task.defer(function()
			if not scriptInstance.Parent or not isManagedScript(scriptInstance) then
				return
			end
			local oldPath = state.path
			local newPath = getFullPath(scriptInstance)
			if oldPath ~= newPath then
				if not suppressPaths[oldPath] and not suppressPaths[newPath] then
					pushLive("renamed", scriptInstance, newPath, nil, state.className, oldPath)
				end
				state.path = newPath
				state.className = scriptInstance.ClassName
				state.uniqueId = getUniqueId(scriptInstance)
				state.deletedSent = false
			end
		end)
	end)
end

local function watchContainer(container)
	if watchedContainers[container] then
		return
	end
	watchedContainers[container] = true
	container.DescendantAdded:Connect(function(descendant)
		if isManagedScript(descendant) then
			local wasWatched = watchedScripts[descendant] ~= nil
			watchScript(descendant)
			local state = watchedScripts[descendant]
			if state and not wasWatched then
				state.path = getFullPath(descendant)
				state.className = descendant.ClassName
				state.uniqueId = getUniqueId(descendant)
				state.deletedSent = false
			end
			task.defer(function()
				if descendant.Parent and not wasWatched then
					local currentPath = getFullPath(descendant)
					if not suppressPaths[currentPath] then
						pushLive("created", descendant, currentPath)
					end
				end
			end)
		end
	end)
	container.DescendantRemoving:Connect(function(descendant)
		if isScript(descendant) and watchedScripts[descendant] then
			task.defer(function()
				if descendant.Parent and isManagedScript(descendant) then
					return
				end
				emitDeleted(descendant)
			end)
			task.delay(2, function()
				if not descendant.Parent or not isManagedScript(descendant) then
					watchedScripts[descendant] = nil
					sourceDebounceTokens[descendant] = nil
				end
			end)
		end
	end)
end

local function scanForUnwatchedScripts(emitCreates)
	for _, svc in ipairs(getRootServices()) do
		watchContainer(svc)
		for _, descendant in ipairs(svc:GetDescendants()) do
			if isManagedScript(descendant) and not watchedScripts[descendant] then
				watchScript(descendant)
				if emitCreates then
					local path = getFullPath(descendant)
					if not suppressPaths[path] then
						pushLive("created", descendant, path)
					end
				end
			end
		end
	end
end

local function startLiveFeed()
	if liveStarted then
		return
	end
	liveStarted = true
	scanForUnwatchedScripts(false)
	task.spawn(function()
		while liveStarted do
			task.wait(2)
			scanForUnwatchedScripts(true)
		end
	end)
end

local function applyScriptListUpdates(scripts)
	if not initialSnapshotSynced then
		return
	end
	local acknowledged = {}
	for _, scriptRecord in ipairs(scripts or {}) do
		local shouldDeploy = scriptRecord.pendingStudioDeploy == true or scriptRecord.pendingStudioDeploy == nil
		if shouldDeploy and scriptRecord.path and not scriptRecord.deleted and scriptRecord.source ~= nil and isManagedScriptPath(scriptRecord.path) then
			local current = findScript(scriptRecord.path, scriptRecord.uniqueId)
			local currentSource = current and getScriptSource(current) or nil
			if currentSource ~= scriptRecord.source then
				local ok = upsertScript(scriptRecord.path, scriptRecord.source, scriptRecord.className or "Script", scriptRecord.uniqueId)
				if ok then
					table.insert(acknowledged, { path = scriptRecord.path, uniqueId = scriptRecord.uniqueId })
				end
			else
				table.insert(acknowledged, { path = scriptRecord.path, uniqueId = scriptRecord.uniqueId })
			end
		end
	end
	if #acknowledged > 0 and connection then
		connection:sendScriptEvent("script:ackDeploy", { refs = acknowledged })
	end
end

local function applyWatchEvent(payload)
	if payload.origin == "studio-plugin" or payload.origin == "studio-snapshot" then
		return
	end
	local kind = payload.kind
	local scriptRecord = payload.script or {}
	local path = payload.path or scriptRecord.path
	if not isManagedScriptPath(path) then
		return
	end
	local uniqueId = payload.uniqueId or scriptRecord.uniqueId
	if kind == "created" or kind == "updated" or kind == "restored" then
		upsertScript(path, scriptRecord.source or "", scriptRecord.className or "Script", uniqueId)
	elseif kind == "deleted" then
		deleteScript(path, uniqueId)
	elseif kind == "renamed" then
		if payload.oldPath then
			deleteScript(payload.oldPath, uniqueId)
		end
		upsertScript(path, scriptRecord.source or "", scriptRecord.className or "Script", uniqueId)
	end
end

local function closeAllPanels()
	suppressPanelCloseSetting = true
	for _, panel in pairs(panels) do
		panel:close()
	end
	suppressPanelCloseSetting = false
end

local function normalizePanelName(name)
	if name == "settings" then
		return "home"
	end
	return name
end

local function panelIsOpen(name)
	local panel = panels[name]
	return activePanelName == name and panel and panel.widget and panel.widget.Enabled
end

local function openPanel(name, toggle, page)
	name = normalizePanelName(name)
	if panelsDisabled and name ~= "home" then
		Utils.notify("History and Activity are disabled until StudioLink is updated.")
		name = "home"
		page = "home"
	end
	local alreadyOpen = panelIsOpen(name)
	if toggle and alreadyOpen then
		panels[name]:close()
		activePanelName = nil
		if plugin then
			plugin:SetSetting("activePanel", "")
		end
		return false
	end
	activePanelName = name
	if plugin then
		plugin:SetSetting("activePanel", name)
	end
	if alreadyOpen then
		if page and panels[name] and panels[name].setPage then
			panels[name]:setPage(page)
		end
		return true
	end
	closeAllPanels()
	if panels[name] then
		panels[name]:open(page)
	end
	return true
end

local function rememberPanelClosed(name)
	if suppressPanelCloseSetting then
		return
	end
	if activePanelName == name and plugin then
		activePanelName = nil
		plugin:SetSetting("activePanel", "")
	end
end

local function openMainPage(page, toggle)
	page = page or "home"
	local alreadyOnPage = panels.home and panels.home.page == page
	local allowToggleClose = toggle and panelIsOpen("home") and alreadyOnPage
	openPanel("home", allowToggleClose, page)
end

local function buildToolbar()
	local toolbar = plugin:CreateToolbar("StudioLink")
	local homeButton = toolbar:CreateButton("Home", "Open StudioLink", "rbxassetid://6034509993")
	local historyButton = toolbar:CreateButton("History", "Open script history", "rbxassetid://6031075938")
	local githubButton = toolbar:CreateButton("Github", "Open GitHub setup", "rbxassetid://6031094678")
	local settingsButton = toolbar:CreateButton("Settings", "Open StudioLink settings", "rbxassetid://6031280882")
	local logButton = toolbar:CreateButton("Logs", "Open StudioLink logs", "rbxassetid://6031068420")
	homeButton.Click:Connect(function()
		openMainPage("home", true)
	end)
	historyButton.Click:Connect(function()
		openMainPage("history", true)
	end)
	githubButton.Click:Connect(function()
		openMainPage("github", true)
	end)
	settingsButton.Click:Connect(function()
		openMainPage("settings", true)
	end)
	logButton.Click:Connect(function()
		openMainPage("logs", true)
	end)
end

if plugin then
	Theme.init(plugin)
	local placeInfo = getPlaceInfo()
	connection = ConnectionManager.new({
		plugin = plugin,
		utils = Utils,
		placeId = placeInfo.placeId,
		placeInfo = placeInfo,
		pluginVersion = PLUGIN_VERSION,
	})
	connection:on("watch:event", applyWatchEvent)
	connection:on("script:list:response", function(payload)
		if reconcileInitialSnapshot(payload.scripts or {}) then
			return
		end
		applyScriptListUpdates(payload.scripts or {})
	end)
	connection:on("update:status", function(payload)
		panelsDisabled = payload.pluginIncompatible == true or payload.daemonIncompatible == true
		if panelsDisabled and activePanelName ~= "home" then
			openPanel("home")
		end
	end)
	panels.home = HomePanel.new(plugin, connection, Theme, Utils, {
		openHistory = function()
			openMainPage("history")
		end,
		openLog = function()
			openMainPage("logs")
		end,
		openSettings = function()
			openMainPage("settings")
		end,
		applyScript = function(scriptRecord)
			if scriptRecord and scriptRecord.path then
				upsertScript(scriptRecord.path, scriptRecord.source or "", scriptRecord.className or "Script", scriptRecord.uniqueId)
			end
		end,
		onClosed = function()
			rememberPanelClosed("home")
		end,
	})
	panels.history = HistoryPanel.new(plugin, connection, Theme, Utils, {
		onClosed = function()
			rememberPanelClosed("history")
		end,
		applyScript = function(scriptRecord)
			if scriptRecord and scriptRecord.path then
				upsertScript(scriptRecord.path, scriptRecord.source or "", scriptRecord.className or "Script", scriptRecord.uniqueId)
			end
		end,
	})
	panels.log = AgentLogPanel.new(plugin, connection, Theme, Utils, {
		onClosed = function()
			rememberPanelClosed("log")
		end,
	})
	if panels.home and panels.home.createWidget then
		panels.home:createWidget()
		if panels.home.widget then panels.home.widget.Enabled = false end
	end
	buildToolbar()
	task.defer(function()
		for _, panel in pairs(panels) do
			if panel.createWidget and not panel.widget then
				panel:createWidget()
			end
			if panel.widget then
				panel.widget.Enabled = false
			end
		end
	end)
	local savedPanel = plugin:GetSetting("activePanel")
	local savedMainPage = plugin:GetSetting("mainPage") or "home"
	if savedPanel == "settings" then
		savedMainPage = "settings"
		savedPanel = "home"
	elseif savedPanel == "history" then
		savedMainPage = "history"
		savedPanel = "home"
	elseif savedPanel == "log" then
		savedMainPage = "logs"
		savedPanel = "home"
	end
	if savedPanel == "home" then
		task.defer(function()
			openMainPage(savedMainPage)
		end)
	end
	task.delay(1, function()
		connection:connect()
	end)
	task.delay(2, startLiveFeed)
end

print("[StudioLink] Plugin loaded v" .. PLUGIN_VERSION)
`;
