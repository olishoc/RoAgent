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
