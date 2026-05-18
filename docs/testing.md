# RoAgent v3 — Testing

## Overview

Testing happens at two levels:
1. Luau unit tests for individual modules (no Studio required)
2. Mock agent server for integration testing

---

## Level 1: Luau Unit Tests

### Location

All test files live in plugin/tests/:
- plugin/tests/run.lua          -- Test runner
- plugin/tests/test_EventBus.lua
- plugin/tests/test_StateStore.lua
- plugin/tests/test_ThemeService.lua
- plugin/tests/test_ScriptWriter.lua
- plugin/tests/test_DiffService.lua
- plugin/tests/test_SyntaxService.lua
- plugin/tests/test_HistoryService.lua

### Running Tests

Open the plugin in Roblox Studio. The test runner can be triggered from the
toolbar dropdown menu (select "Run Tests"). Results appear in the Studio Output
window.

For command-line execution (CI), use a Lua interpreter that supports the
standard library:
```
lua plugin/tests/run.lua
```

The runner exits with code 0 if all tests pass, code 1 if any test fails.

### Runner Output Format

```
PASS EventBus.on fires listener
PASS EventBus.off removes listener
PASS EventBus.emit passes arguments
FAIL StateStore.set fires notification -- expected true got false
PASS ThemeService.getTheme returns active theme

Results: 4 passed, 1 failed
```

### Test File Structure

Each test file returns a table of test functions:

```lua
local tests = {}

function tests.test_something()
    -- arrange
    local result = Module.doThing()
    -- assert
    assert(result == expected, "expected " .. tostring(expected) .. " got " .. tostring(result))
end

return tests
```

### Test Coverage

#### test_EventBus.lua
| Test | What it covers |
|------|---------------|
| on fires listener | Subscribing and receiving an event |
| off removes listener | Unsubscribing prevents future calls |
| emit passes arguments | Arguments are forwarded correctly |
| clear removes all listeners | No listeners fire after clear |
| multiple listeners | All listeners fire for one event |
| unsubscribe function | Returned function removes the listener |

#### test_StateStore.lua
| Test | What it covers |
|------|---------------|
| get returns default | Unset keys return default values |
| set updates value | Values are stored and retrieved |
| set fires notification | Subscribers are notified on change |
| set skips notification | Identical values do not fire notification |
| subscribe to key | Only fires for the subscribed key |
| getAll returns copy | Returned table is a copy, not a reference |

#### test_ThemeService.lua
| Test | What it covers |
|------|---------------|
| getActive returns theme | Active theme is returned |
| getTheme by name | Named theme is returned |
| setTheme switches | Active theme changes |
| setTheme persists | Theme name is saved to config |
| setTheme fires callback | Change listener is called |
| invalid theme returns false | Unknown theme names are rejected |
| addCustomTheme | Custom theme is registered |
| addCustomTheme validates | Missing fields are rejected |
| removeCustomTheme | Custom theme is removed |
| getThemeNames | All theme names are listed |

#### test_DiffService.lua
| Test | What it covers |
|------|---------------|
| computeDiff additions | Added lines are detected |
| computeDiff removals | Removed lines are detected |
| computeDiff context | Context lines are included |
| formatDiff | Diff is formatted for display |
| applyDiff | Diff is applied to source |
| revertDiff | Diff is reverted from source |
| empty diff | No changes produces empty diff |
| multi-line diff | Multiple changed lines are handled |

#### test_SyntaxService.lua
| Test | What it covers |
|------|---------------|
| tokenize keywords | Lua keywords are identified |
| tokenize strings | Single and double quoted strings |
| tokenize long strings | [[ ]] long strings |
| tokenize comments | -- line comments |
| tokenize block comments | --[[ ]] block comments |
| tokenize numbers | Integers, floats, hex |
| tokenize identifiers | Variable names |
| tokenize operators | =, +, ==, ~=, etc. |
| tokenize whitespace | Spaces, tabs, newlines |
| empty source | Empty string returns empty token list |

#### test_HistoryService.lua
| Test | What it covers |
|------|---------------|
| push adds version | Version is recorded |
| getHistory returns list | All versions for a script are returned |
| getVersion by index | Specific version is retrieved |
| revertTo returns source | Reverted source is correct |
| max 20 versions | Oldest version is dropped at 21 |
| clear removes all | History is emptied for a script |
| latest returns most recent | Latest version entry is returned |

#### test_ScriptWriter.lua
| Test | What it covers |
|------|---------------|
| isWritable script | Script instance is writable |
| isWritable localScript | LocalScript instance is writable |
| isWritable moduleScript | ModuleScript instance is writable |
| isWritable invalid | Non-script instances are rejected |
| applyChange produces correct source | Change is applied correctly |
| revertChange restores original | Revert restores previous source |

### Adding New Tests

1. Open the relevant test file in plugin/tests/.
2. Add a new function to the tests table:
   ```lua
   function tests.test_new_feature()
       -- arrange
       -- act
       -- assert
   end
   ```
3. Run the test runner to verify.

---

## Level 2: Mock Agent Server

### Location

tools/mock_agent.py

### Running

```
python tools/mock_agent.py
```

The server starts on 127.0.0.1:8765 by default. Use --port to change:
```
python tools/mock_agent.py --port 9000
```

### Endpoints

#### GET /health
Returns {"ok": true, "model": "mock", "provider": "mock", "maxTokens": 4096}

#### GET /ping
Returns {"ok": true}

#### POST /suggest
Returns a configurable suggestion. Default response:
```
{
  "suggestion": {
    "targetLine": 1,
    "replacement": "-- mock suggestion",
    "additions": ["-- mock suggestion"],
    "removals": [],
    "context": [],
    "explanation": "Mock suggestion for testing"
  }
}
```

#### POST /mock/set (control endpoint)
Configure the next /suggest response. Body formats:

Valid suggestion:
```
{"mode": "suggestion", "data": {"targetLine": 2, "replacement": "local x = 1", ...}}
```

Empty response:
```
{"mode": "empty"}
```

Timeout (server waits 30 seconds before responding):
```
{"mode": "timeout"}
```

Server error:
```
{"mode": "error", "status": 500, "message": "Internal Server Error"}
```

Reset to default:
```
{"mode": "reset"}
```

### Log Format

Every request is logged to stdout:
```
[2026-05-10 12:00:00] GET /health -> 200
[2026-05-10 12:00:01] POST /suggest -> 200 (suggestion)
[2026-05-10 12:00:02] POST /mock/set -> 200 (mode: error)
[2026-05-10 12:00:03] POST /suggest -> 500
```

### Integration Testing Workflow

1. Start the mock server: `python tools/mock_agent.py`
2. Open Roblox Studio with the plugin loaded.
3. Click the RoAgent toolbar button to open the editor.
4. Select a script in the Explorer.
5. The editor panel opens and connects to the mock server.
6. Type in the editor to trigger suggestion requests.
7. Use POST /mock/set to configure different responses:
   - Test suggestion display with mode "suggestion"
   - Test empty response handling with mode "empty"
   - Test timeout handling with mode "timeout"
   - Test error handling with mode "error"
8. Verify the plugin behaves correctly for each scenario.
9. Check the mock server log for request/response details.
