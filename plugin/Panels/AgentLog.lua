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
