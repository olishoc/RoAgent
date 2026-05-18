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
