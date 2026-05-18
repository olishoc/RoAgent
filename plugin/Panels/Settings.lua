local Settings = {}
Settings.__index = Settings

function Settings.new(plugin, manager, Theme, Utils, callbacks)
	local self = setmetatable({}, Settings)
	self.plugin = plugin
	self.manager = manager
	self.Theme = Theme
	self.Utils = Utils
	self.callbacks = callbacks or {}
	self.connectionState = "disconnected"
	self.health = nil
	self.gitStatus = nil
	self.licenseStatus = nil
	self.updateStatus = nil
	manager:onStatus(function(state, details)
		self.connectionState = state
		self.health = details and details.health or self.health
		self:render()
	end)
	manager:on("daemon:health:response", function(payload)
		self.health = payload
		self:render()
	end)
	manager:on("git:status:response", function(payload)
		self.gitStatus = payload
		self:render()
	end)
	manager:on("license:status:response", function(payload)
		self.licenseStatus = payload
		self:render()
	end)
	manager:on("license:warning", function(payload)
		self.licenseStatus = payload
		self:render()
	end)
	manager:on("license:revoked", function(payload)
		self.licenseStatus = payload
		self:render()
	end)
	manager:on("update:status", function(payload)
		self.updateStatus = payload
		self:render()
	end)
	Theme.onChanged(function()
		self:render()
	end)
	return self
end

function Settings:createWidget()
	if self.widget then
		return
	end
	local info = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, false, false, 620, 700, 420, 500)
	self.widget = self.plugin:CreateDockWidgetPluginGui("StudioLinkSettings", info)
	self.widget.Title = "StudioLink Settings"
	self.widget:GetPropertyChangedSignal("Enabled"):Connect(function()
		if not self.widget.Enabled and self.callbacks.onClosed then
			self.callbacks.onClosed()
		end
	end)
	self.root = Instance.new("ScrollingFrame")
	self.root.Name = "Root"
	self.root.Size = UDim2.fromScale(1, 1)
	self.root.ScrollBarThickness = 8
	self.root.AutomaticCanvasSize = Enum.AutomaticSize.Y
	self.root.CanvasSize = UDim2.new()
	self.root.BorderSizePixel = 0
	self.root.Parent = self.widget
	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, 10)
	layout.Parent = self.root
	local padding = Instance.new("UIPadding")
	padding.PaddingTop = UDim.new(0, 14)
	padding.PaddingLeft = UDim.new(0, 14)
	padding.PaddingRight = UDim.new(0, 14)
	padding.PaddingBottom = UDim.new(0, 14)
	padding.Parent = self.root
	self:render()
end

function Settings:block(title, height, variant)
	local theme = self.Theme.get()
	local frame = self.Utils.makeCard(self.root, theme, height, variant or "large")
	local label = self.Utils.makeLabel(frame, title, 16, theme)
	label.Font = Enum.Font.GothamBold
	label.Position = UDim2.new(0, 16, 0, 12)
	label.Size = UDim2.new(1, -32, 0, 22)
	return frame, theme
end

function Settings:daemonVersion()
	return tostring((self.health and (self.health.daemonVersion or self.health.version)) or "unknown")
end

function Settings:daemonUptime()
	return math.floor((self.health and (self.health.uptimeSeconds or self.health.uptime)) or 0)
end

function Settings:line(parent, text, y, theme, muted)
	local label = self.Utils.makeLabel(parent, text, 13, theme, muted)
	label.Position = UDim2.new(0, 16, 0, y)
	label.Size = UDim2.new(1, -32, 0, 20)
	return label
end

function Settings:render()
	if not self.root then
		return
	end
	local theme = self.Theme.get()
	self.root.BackgroundColor3 = theme.background
	self.Utils.clearChildren(self.root)

	local status, statusTheme = self:block("Daemon Status", 142, "hero")
	local connected = self.connectionState == "connected"
	local dotColor = connected and statusTheme.green or (self.connectionState == "reconnecting" and statusTheme.yellow or statusTheme.red)
	local stateText = connected and "Connected" or (self.connectionState == "reconnecting" and "Reconnecting" or "Disconnected")
	local state = self.Utils.makeLabel(status, stateText, 24, statusTheme)
	state.Font = Enum.Font.GothamBold
	state.TextColor3 = dotColor
	state.Position = UDim2.new(0, 16, 0, 40)
	state.Size = UDim2.new(1, -140, 0, 30)
	local pill = self.Utils.makePill(status, connected and "Online" or "Offline", dotColor, statusTheme)
	pill.Position = UDim2.new(1, -96, 0, 44)
	self:line(status, "Endpoint: " .. tostring((self.manager and self.manager.httpUrl) or "http://127.0.0.1:45678"), 76, statusTheme, true)
	self:line(status, "Daemon " .. self:daemonVersion() .. " · uptime " .. tostring(self:daemonUptime()) .. "s", 98, statusTheme, true)
	self:line(status, "Plugin " .. tostring((self.manager and self.manager.pluginVersion) or "unknown"), 120, statusTheme, true)

	local account = self:block("Account and Updates", 132)
	self:line(account, "License: " .. tostring((self.licenseStatus and self.licenseStatus.status) or "unknown"), 40, theme, true)
	local update = self.updateStatus or {}
	local updateText = "Plugin latest: " .. tostring(update.latestPluginVersion or "unknown") .. " · Daemon latest: " .. tostring(update.latestDaemonVersion or "unknown")
	self:line(account, updateText, 62, theme, true)
	local manage = self.Utils.makeButton(account, "Account / Download", theme)
	manage.Position = UDim2.new(0, 16, 0, 92)
	manage.Size = UDim2.new(0, 148, 0, 28)
	manage.MouseButton1Click:Connect(function()
		self.Utils.openUrl(self.plugin, "https://rblxagent.com/download", self.manager)
	end)
	local updateButton = self.Utils.makeButton(account, "Update Page", theme)
	updateButton.Position = UDim2.new(0, 176, 0, 92)
	updateButton.Size = UDim2.new(0, 112, 0, 28)
	updateButton.MouseButton1Click:Connect(function()
		local url = (self.updateStatus and self.updateStatus.updateUrl) or "https://rblxagent.com/update"
		self.Utils.openUrl(self.plugin, url, self.manager)
	end)

	local behavior = self:block("Behavior", 156)
	self:line(behavior, "Repo mode: automatic per-place repository", 40, theme, false)
	self:line(behavior, "Autostart: Windows installer setting (Phase 4)", 62, theme, true)
	self:line(behavior, "Protected scripts: Off / protected by default", 84, theme, true)
	self:line(behavior, "Roblox runtime scripts require future explicit opt-in.", 106, theme, true)
	local themeToggle = self.Utils.makeButton(behavior, "Theme: " .. self.Theme.name(), theme, "primary")
	themeToggle.Position = UDim2.new(0, 16, 0, 122)
	themeToggle.Size = UDim2.new(0, 132, 0, 28)
	themeToggle.MouseButton1Click:Connect(function()
		self.Theme.toggle(self.plugin)
	end)

	local maintenance = self:block("Maintenance", 112)
	self:line(maintenance, connected and "Daemon restart is available." or "Daemon unreachable: plugin cannot start a dead daemon.", 40, theme, not connected)
	local restart = self.Utils.makeButton(maintenance, "Restart Daemon", theme, connected and nil or "ghost")
	restart.Position = UDim2.new(0, 16, 0, 70)
	restart.Size = UDim2.new(0, 132, 0, 28)
	restart.MouseButton1Click:Connect(function()
		if not connected then
			self.Utils.notify("Daemon is unreachable. Start RoAgent from your OS, then reconnect.", "StudioLink")
			return
		end
		if self.manager and self.manager.restartDaemon then
			self.manager:restartDaemon(function(ok)
				if ok then
					self.connectionState = "reconnecting"
					self:render()
				end
			end)
		end
	end)
end

function Settings:refresh()
	self.manager:send("daemon:health", {}, function(payload)
		self.health = payload
		self:render()
	end)
	self.manager:send("git:status", {}, function(payload)
		self.gitStatus = payload
		self:render()
	end)
	self.manager:send("license:status", {}, function(payload)
		self.licenseStatus = payload
		self:render()
	end)
end

function Settings:open()
	self.transitionToken = (self.transitionToken or 0) + 1
	self:createWidget()
	self.Utils.prepareFadeIn(self.root)
	self.widget.Enabled = true
	self.Utils.animateIn(self.root)
	self:refresh()
end

function Settings:close()
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

return Settings
