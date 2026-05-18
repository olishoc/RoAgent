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
