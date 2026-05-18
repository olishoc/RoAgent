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
