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
