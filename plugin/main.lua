--[[
	StudioLink Roblox Studio plugin
	HTTP RPC bridge for http://127.0.0.1:45678.

	Preserves the RoAgent script scanning, path resolution, live feed watching,
	and suppression primitives while using the StudioLink HTTP RPC transport
	and StudioLink panels.
--]]

local PLUGIN_VERSION = "1.0.10"
local SOURCE_DEBOUNCE_SECONDS = 0.5

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")

if RunService:IsRunning() then
	return
end

local Theme = require(script:WaitForChild("Theme"))
local Utils = require(script:WaitForChild("Utils"))
local ConnectionManager = require(script:WaitForChild("ConnectionManager"))
local HomePanel = require(script:WaitForChild("Panels"):WaitForChild("Home"))
local HistoryPanel = require(script:WaitForChild("Panels"):WaitForChild("History"))
local AgentLogPanel = require(script:WaitForChild("Panels"):WaitForChild("AgentLog"))

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
local daemonPromptWidget = nil

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

local function showDaemonInstallPrompt(payload)
	payload = payload or {}
	if daemonPromptWidget then
		daemonPromptWidget.Enabled = true
		return
	end
	local info = DockWidgetPluginGuiInfo.new(
		Enum.InitialDockState.Float,
		true,
		false,
		420,
		260,
		360,
		220
	)
	local widget = plugin:CreateDockWidgetPluginGui("StudioLinkDaemonInstallPrompt", info)
	widget.Title = "StudioLink desktop app required"
	daemonPromptWidget = widget
	local theme = Theme.get()

	local root = Instance.new("Frame")
	root.BackgroundColor3 = theme.panel
	root.BorderSizePixel = 0
	root.Size = UDim2.fromScale(1, 1)
	root.Parent = widget
	Utils.ensureGradient(root, theme)

	local padding = Instance.new("UIPadding")
	padding.PaddingTop = UDim.new(0, 18)
	padding.PaddingBottom = UDim.new(0, 18)
	padding.PaddingLeft = UDim.new(0, 18)
	padding.PaddingRight = UDim.new(0, 18)
	padding.Parent = root

	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0, 12)
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = root

	local title = Utils.makeLabel(root, "StudioLink desktop app required", 18, theme)
	title.Font = Enum.Font.GothamSemibold
	title.Size = UDim2.new(1, 0, 0, 28)
	title.LayoutOrder = 1

	local body = Utils.makeLabel(root, "StudioLink cannot connect to the desktop app. Install or start StudioLink, then return to Roblox Studio.", 13, theme, true)
	body.Size = UDim2.new(1, 0, 0, 58)
	body.LayoutOrder = 2

	local errorText = tostring(payload.error or "")
	if errorText ~= "" then
		local errorLabel = Utils.makeLabel(root, "Connection detail: " .. errorText, 11, theme, true)
		errorLabel.Size = UDim2.new(1, 0, 0, 42)
		errorLabel.LayoutOrder = 3
	end

	local buttons = Instance.new("Frame")
	buttons.BackgroundTransparency = 1
	buttons.Size = UDim2.new(1, 0, 0, 36)
	buttons.LayoutOrder = 4
	buttons.Parent = root

	local buttonLayout = Instance.new("UIListLayout")
	buttonLayout.FillDirection = Enum.FillDirection.Horizontal
	buttonLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left
	buttonLayout.Padding = UDim.new(0, 10)
	buttonLayout.SortOrder = Enum.SortOrder.LayoutOrder
	buttonLayout.Parent = buttons

	local download = Utils.makeButton(buttons, "Download StudioLink", theme, "primary")
	download.Size = UDim2.new(0, 160, 0, 34)
	download.LayoutOrder = 1
	download.MouseButton1Click:Connect(function()
		Utils.openUrl(plugin, tostring(payload.downloadUrl or "https://rblxagent.com/download"), connection)
	end)

	local retry = Utils.makeButton(buttons, "Retry", theme)
	retry.Size = UDim2.new(0, 82, 0, 34)
	retry.LayoutOrder = 2
	retry.MouseButton1Click:Connect(function()
		widget.Enabled = false
		if connection then
			connection.connecting = false
			connection:connect()
		end
	end)

	local dismiss = Utils.makeButton(buttons, "Dismiss", theme)
	dismiss.Size = UDim2.new(0, 90, 0, 34)
	dismiss.LayoutOrder = 3
	dismiss.MouseButton1Click:Connect(function()
		widget.Enabled = false
	end)

	widget.Enabled = true
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
	connection:on("daemon:missing", showDaemonInstallPrompt)
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
