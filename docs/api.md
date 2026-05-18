# RoAgent v3 — HTTP API Contract

The plugin communicates with a locally running agent server over HTTP. The
server runs on 127.0.0.1 at a configurable port (default 8765).

All request and response bodies are JSON. Content-Type is application/json.

---

## GET /health

Purpose: Check if the agent server is reachable and healthy.

Request: None.

Response (200):
```
{
  "ok": true,
  "model": "minimax/minimax-m2",
  "provider": "openrouter",
  "maxTokens": 4096
}
```

Response (500):
```
{
  "error": "error message"
}
```

Plugin behavior:
- On 200: Set connection state to CONNECTED.
- On 500 or timeout: Set connection state to ERR.
- On connection failure: Set connection state to ERR, schedule retry.

---

## GET /ping

Purpose: Lightweight heartbeat. Used by the plugin to verify the connection
is still alive.

Request: None.

Response (200):
```
{
  "ok": true
}
```

Plugin behavior:
- Sent every 30 seconds when connected.
- On failure: Mark as disconnected, start reconnect loop.

---

## POST /suggest

Purpose: Request an inline code suggestion for the current cursor position.

Request body:
```
{
  "source": "local x = 42\nlocal y = ",
  "cursorLine": 2,
  "cursorColumn": 10,
  "scriptPath": "ServerScriptService.MyModule",
  "scriptType": "ModuleScript"
}
```

Fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source | string | Yes | Full current script source |
| cursorLine | number | Yes | 1-based line number of cursor |
| cursorColumn | number | Yes | 1-based column number of cursor |
| scriptPath | string | No | Full instance path (e.g. "ServerScriptService.Foo") |
| scriptType | string | No | "Script", "LocalScript", or "ModuleScript" |

Response (200) with suggestion:
```
{
  "suggestion": {
    "targetLine": 2,
    "replacement": "local y = x * 2",
    "additions": ["local y = x * 2"],
    "removals": ["local y = "],
    "context": ["local x = 42"],
    "explanation": "Complete the variable assignment using the previously defined x"
  }
}
```

Response (200) with no suggestion:
```
{
  "suggestion": null
}
```

Fields:
| Field | Type | Description |
|-------|------|-------------|
| targetLine | number | The 1-based line number the suggestion applies to |
| replacement | string | The full replacement text for the target line |
| additions | string[] | Lines to add (shown in green) |
| removals | string[] | Lines to remove (shown in red) |
| context | string[] | Unchanged context lines around the change |
| explanation | string | One-line human-readable explanation |

Response (500):
```
{
  "error": "error message"
}
```

Plugin behavior:
- Debounced: Only send a request 500ms after the last keystroke.
- If a request is already in flight when a new one is triggered, cancel the
  old request and send the new one.
- On 200 with suggestion: Add to suggestion queue.
- On 200 with null suggestion: Do nothing.
- On 500 or timeout: Drop silently, continue polling.
- Maximum 3 concurrent requests. Additional requests are queued.

---

## POST /agent

Purpose: Full agent chat interaction. Sends conversation history and script
context, returns agent response with optional script actions.

Request body:
```
{
  "history": [
    {"role": "user", "content": "Add a jump cooldown"},
    {"role": "assistant", "content": "I'll add a jump cooldown to the player controller."}
  ],
  "allScripts": [
    {"path": "ServerScriptService.PlayerController", "className": "Script"}
  ],
  "activeSource": "local Players = game:GetService('Players')\n",
  "activePath": "ServerScriptService.PlayerController",
  "apiKey": "sk-or-v1-...",
  "model": "minimax/minimax-m2",
  "maxTokens": 4096
}
```

Fields:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| history | array | Yes | Array of {role, content} messages |
| allScripts | array | No | Array of {path, className} for all scripts |
| activeSource | string | No | Source of the currently active script |
| activePath | string | No | Path of the currently active script |
| apiKey | string | No | Override server API key for this request |
| model | string | No | Override model for this request |
| maxTokens | number | No | Override max tokens for this request |

Response (200):
```
{
  "message": "I've added a jump cooldown. Here's the updated script:\n\n```lua:ServerScriptService.PlayerController\nlocal Players = game:GetService('Players')\n```",
  "toolActions": [
    {
      "name": "write_script",
      "input": {
        "path": "ServerScriptService.PlayerController",
        "source": "local Players = game:GetService('Players')\n"
      }
    }
  ]
}
```

Fields:
| Field | Type | Description |
|-------|------|-------------|
| message | string | Full agent response text |
| toolActions | array | Array of {name, input} actions parsed from code blocks |

Plugin behavior:
- Parse toolActions from the response.
- For each write_script action, create a diff and add it to the suggestion queue.
- Display the message in the chat panel if open.

---

## GET /config

Purpose: Read the server's current runtime configuration.

Request: None.

Response (200):
```
{
  "model": "minimax/minimax-m2",
  "maxTokens": 4096,
  "hasKey": true
}
```

---

## POST /config

Purpose: Update the server's runtime configuration.

Request body (all fields optional):
```
{
  "model": "anthropic/claude-sonnet-4",
  "maxTokens": 8192,
  "apiKey": "sk-or-v1-..."
}
```

Response (200):
```
{
  "ok": true,
  "model": "anthropic/claude-sonnet-4",
  "maxTokens": 8192,
  "hasKey": true
}
```

---

## GET /info

Purpose: Get server metadata.

Request: None.

Response (200):
```
{
  "model": "minimax/minimax-m2",
  "provider": "openrouter",
  "maxTokens": 4096
}
```

---

## Error Handling

All endpoints return errors in the same format:
```
{
  "error": "descriptive error message"
}
```

HTTP status codes:
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (malformed JSON, missing required fields) |
| 500 | Server error (model API failure, internal error) |

Plugin error handling:
- 400: Log warning, do not retry.
- 500: Log warning, drop request, continue normal polling.
- Connection refused: Mark disconnected, retry every 5 seconds.
- Timeout (10 seconds): Drop request, continue normal polling.
- All errors are non-fatal. The plugin remains functional without a connection.

---

## Connection Lifecycle

1. Plugin loads, reads server URL from ConfigService.
2. Plugin sends GET /health to test connection.
3. On success: State = CONNECTED. Start heartbeat (GET /ping every 30s).
4. On failure: State = ERR. Start retry loop (GET /health every 5s).
5. While connected: Send POST /suggest on cursor debounce.
7. On heartbeat failure: State = ERR, start retry loop.
8. On user click "CONNECT": Send GET /health, go to step 3.
9. On user click "DISCONNECT": Cancel all requests, stop heartbeat, State = ERR.
