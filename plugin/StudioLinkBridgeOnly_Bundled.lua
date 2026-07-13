-- StudioLink bridge-only bundled Roblox Studio plugin
-- HTTP-primary build. Paste this whole file as a local plugin script.
-- Generated from plugin/StudioLinkBridgeOnly.lua; do not hand-edit.

local function load_BridgeUtils()
local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")

local BridgeUtils = {}

function BridgeUtils.uuid()
	return HttpService:GenerateGUID(false)
end

function BridgeUtils.encodeJson(value)
	return HttpService:JSONEncode(value or {})
end

function BridgeUtils.decodeJson(text)
	local ok, decoded = pcall(function()
		return HttpService:JSONDecode(text)
	end)
	if ok then
		return decoded
	end
	return nil
end

function BridgeUtils.notify(text, title)
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
	warn("[StudioLink Bridge] " .. tostring(text))
end

function BridgeUtils.urlEncode(text)
	text = tostring(text or "")
	text = string.gsub(text, "\n", "\r\n")
	text = string.gsub(text, "([^%w%-%_%.%~])", function(char)
		return string.format("%%%02X", string.byte(char))
	end)
	return text
end

return BridgeUtils
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
	self.downloadUrl = options.downloadUrl or "https://rblxagent.com/download"
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
	self.daemonInstallPromptShown = false
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

function ConnectionManager:_promptDaemonInstall(errorText)
	if self.daemonInstallPromptShown then
		return
	end
	self.daemonInstallPromptShown = true
	self:_fire("daemon:missing", {
		downloadUrl = self.downloadUrl,
		error = tostring(errorText or ""),
	})
	self:_notify("StudioLink desktop app is not running. Open StudioLink to download and install it.")
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
		self:_promptDaemonInstall(result)
		self:_scheduleReconnect()
		return
	end
	self.daemonInstallPromptShown = false
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

--[[
	StudioLink bridge-only Roblox Studio plugin.

	This entrypoint intentionally owns no product UI. It exists only to link
	Roblox Studio script state to the local StudioLink daemon so all setup,
	history, Git, agent, and coding UI can move to the desktop app.
--]]

local PLUGIN_VERSION = "2.0.0-bridge"
local SOURCE_DEBOUNCE_SECONDS = 0.5

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")

if RunService:IsRunning() then
	return
end

local Utils = load_BridgeUtils()
local ConnectionManager = load_ConnectionManager()

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
local initialSnapshotSent = false
local initialSnapshotSynced = false

local function log(message)
	warn("[StudioLink Bridge] " .. tostring(message))
end

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

local function splitPath(path)
	local parts = {}
	for part in string.gmatch(tostring(path or ""), "[^%.]+") do
		table.insert(parts, part)
	end
	return parts
end

local function rootForPart(part)
	local special = SPECIAL_PATHS[part]
	if special then
		local ok, svc = pcall(function()
			return game:GetService(special.service)
		end)
		return ok and svc and svc:FindFirstChild(special.property) or nil
	end
	local ok, svc = pcall(function()
		return game:GetService(part)
	end)
	return ok and svc or nil
end

local function findScriptByUniqueId(uniqueId)
	if not uniqueId then
		return nil
	end
	local owner = uniqueIdOwners[uniqueId]
	if owner and owner.Parent ~= nil then
		return owner
	end
	for _, svc in ipairs(getRootServices()) do
		for _, descendant in ipairs(svc:GetDescendants()) do
			if isScript(descendant) then
				local ok, current = pcall(function()
					return descendant.UniqueId
				end)
				local attrOk, attrValue = pcall(function()
					return descendant:GetAttribute("RoAgentUniqueId")
				end)
				if (ok and tostring(current) == tostring(uniqueId)) or (attrOk and tostring(attrValue) == tostring(uniqueId)) then
					uniqueIdOwners[uniqueId] = descendant
					return descendant
				end
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
	local parts = splitPath(path)
	if #parts < 2 then
		return nil
	end
	local current = rootForPart(parts[1])
	for index = 2, #parts do
		current = current and current:FindFirstChild(parts[index]) or nil
	end
	return isScript(current) and current or nil
end

local function getOrCreateParent(path)
	local parts = splitPath(path)
	if #parts < 2 then
		return nil, nil
	end
	local current = rootForPart(parts[1])
	if not current then
		return nil, nil
	end
	for index = 2, #parts - 1 do
		local child = current:FindFirstChild(parts[index])
		if not child then
			child = Instance.new("Folder")
			child.Name = parts[index]
			child.Parent = current
		end
		current = child
	end
	return current, parts[#parts]
end

local function withSuppressed(path, fn)
	suppressPaths[path] = true
	local ok, result = pcall(fn)
	task.delay(SOURCE_DEBOUNCE_SECONDS + 0.1, function()
		suppressPaths[path] = nil
	end)
	if not ok then
		log(result)
		return false
	end
	return result ~= false
end

local watchScript

local function upsertScript(path, source, className, uniqueId)
	if not isManagedScriptPath(path) then
		return false
	end
	local target = findScript(path, uniqueId)
	if not target then
		local parent, name = getOrCreateParent(path)
		if not parent or not name then
			return false
		end
		local ok, created = pcall(function()
			local inst = Instance.new(className or "Script")
			inst.Name = name
			inst.Parent = parent
			return inst
		end)
		if not ok then
			log(created)
			return false
		end
		target = created
	end
	if uniqueId then
		pcall(function()
			target:SetAttribute("RoAgentUniqueId", uniqueId)
		end)
		uniqueIdOwners[uniqueId] = target
	end
	return withSuppressed(path, function()
		target.Source = tostring(source or "")
		watchScript(target)
		return true
	end)
end

local function deleteScript(path, uniqueId)
	local target = findScript(path, uniqueId)
	if not target then
		return false
	end
	return withSuppressed(path, function()
		target:Destroy()
		return true
	end)
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

local function sendInitialSnapshot()
	if initialSnapshotSent or not connection then
		return
	end
	initialSnapshotSent = true
	local placeInfo = getPlaceInfo()
	connection:send("script:syncSnapshot", {
		scripts = scanScripts(),
		origin = "studio-plugin",
		placeName = placeInfo.placeName,
		gameId = placeInfo.gameId,
		jobId = placeInfo.jobId,
	}, function()
		initialSnapshotSynced = true
	end)
end

local function pushLive(kind, scriptInstance, path, className, oldPath)
	if not connection then
		return
	end
	if kind == "created" then
		connection:sendScriptEvent("script:create", {
			path = path,
			className = className or scriptInstance.ClassName,
			source = getScriptSource(scriptInstance),
			uniqueId = getUniqueId(scriptInstance),
			origin = "studio-plugin",
		})
	elseif kind == "updated" then
		connection:sendScriptEvent("script:write", {
			path = path,
			className = className or scriptInstance.ClassName,
			source = getScriptSource(scriptInstance),
			uniqueId = getUniqueId(scriptInstance),
			origin = "studio-plugin",
		})
	elseif kind == "deleted" then
		connection:sendScriptEvent("script:delete", {
			path = path,
			uniqueId = scriptInstance and getUniqueId(scriptInstance) or nil,
			origin = "studio-plugin",
		})
	elseif kind == "renamed" then
		connection:sendScriptEvent("script:rename", {
			fromPath = oldPath,
			toPath = path,
			className = className or scriptInstance.ClassName,
			uniqueId = getUniqueId(scriptInstance),
			origin = "studio-plugin",
		})
	end
end

local function emitDeleted(scriptInstance)
	local state = watchedScripts[scriptInstance]
	if not state or state.deletedSent then
		return
	end
	state.deletedSent = true
	if not suppressPaths[state.path] then
		pushLive("deleted", scriptInstance, state.path, state.className)
	end
end

watchScript = function(scriptInstance)
	if watchedScripts[scriptInstance] then
		return
	end
	if not isManagedScript(scriptInstance) then
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
			if sourceDebounceTokens[scriptInstance] ~= token or not scriptInstance.Parent then
				return
			end
			local latestPath = getFullPath(scriptInstance)
			if not suppressPaths[latestPath] and not suppressPaths[state.path] then
				state.path = latestPath
				state.className = scriptInstance.ClassName
				pushLive("updated", scriptInstance, latestPath)
			end
		end)
	end)

	scriptInstance:GetPropertyChangedSignal("Name"):Connect(function()
		if not scriptInstance.Parent then
			return
		end
		local oldPath = state.path
		local newPath = getFullPath(scriptInstance)
		if oldPath ~= newPath and not suppressPaths[oldPath] and not suppressPaths[newPath] then
			pushLive("renamed", scriptInstance, newPath, state.className, oldPath)
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
			if oldPath ~= newPath and not suppressPaths[oldPath] and not suppressPaths[newPath] then
				pushLive("renamed", scriptInstance, newPath, state.className, oldPath)
			end
			state.path = newPath
			state.className = scriptInstance.ClassName
			state.uniqueId = getUniqueId(scriptInstance)
			state.deletedSent = false
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
			task.defer(function()
				if descendant.Parent and not wasWatched then
					local path = getFullPath(descendant)
					if not suppressPaths[path] then
						pushLive("created", descendant, path)
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

local placeInfo = getPlaceInfo()
connection = ConnectionManager.new({
	plugin = plugin,
	utils = Utils,
	placeId = placeInfo.placeId,
	placeInfo = placeInfo,
	pluginVersion = PLUGIN_VERSION,
})

connection:onStatus(function(state)
	if state == "connected" then
		sendInitialSnapshot()
		startLiveFeed()
	end
end)

connection:on("watch:event", applyWatchEvent)
connection:on("script:list:response", function(payload)
	applyScriptListUpdates(payload.scripts or {})
end)
connection:on("daemon:missing", function(payload)
	log("Desktop app unavailable: " .. tostring(payload and payload.error or "unknown"))
end)

task.defer(function()
	connection:connect()
end)
