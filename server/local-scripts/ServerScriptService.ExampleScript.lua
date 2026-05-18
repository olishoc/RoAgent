-- ServerScriptService.ExampleScript.lua
-- Example script in local-scripts folder

-- This file will sync to:
--   ServerScriptService.ExampleScript

local HttpService = game:GetService("HttpService")

print("Hello from synced script!")

-- Auto-reload when this file changes in VS Code
_G.reloadScript = function()
    print("Script reloaded!")
end
