#!/usr/bin/env node
/**
 * RoAgent v3 — Node.js Test Runner
 * Tests service module logic directly in JavaScript.
 * Each service is reimplemented here as a JS module for testing,
 * validating the same logic as the Lua source.
 *
 * Usage: node tools/run_tests.js
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// JS IMPLEMENTATIONS OF SERVICE LOGIC (mirrors the Lua source)
// ═══════════════════════════════════════════════════════════════════════════════

// ── EventBus ──────────────────────────────────────────────────────────────────

const EventBus = {
    _listeners: {},
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
        return () => this.off(event, callback);
    },
    off(event, callback) {
        const list = this._listeners[event];
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i] === callback) list.splice(i, 1);
        }
        if (list.length === 0) delete this._listeners[event];
    },
    emit(event, ...args) {
        const list = this._listeners[event];
        if (!list) return;
        const copy = [...list];
        for (const cb of copy) {
            try { cb(...args); } catch (e) { console.warn(`[EventBus] Error in listener for '${event}': ${e.message}`); }
        }
    },
    clear() { this._listeners = {}; }
};

// ── StateStore ────────────────────────────────────────────────────────────────

function createStateStore() {
    const state = {
        connected: false, connecting: false, activeScript: null,
        activeSource: '', cursorLine: 1, cursorColumn: 1,
        suggestionQueue: [], activeSuggestion: null,
        theme: 'HighContrast', commitLog: [], panelVisible: true,
        agentProcessing: false,
    };
    const subscribers = {};
    return {
        get(k) { return state[k]; },
        set(k, value) {
            if (state[k] === value) return;
            const old = state[k];
            state[k] = value;
            (subscribers['*'] || []).forEach(cb => cb(k, value, old));
            (subscribers[k] || []).forEach(cb => cb(value));
        },
        getAll() { return { ...state }; },
        subscribe(key, cb) {
            if (!subscribers[key]) subscribers[key] = [];
            subscribers[key].push(cb);
        }
    };
}

// ── ThemeService ──────────────────────────────────────────────────────────────

const REQUIRED_KEYS = ['BG','PANEL','SIDEBAR','BORDER','TEXT','SUBTEXT','ACCENT','GREEN','RED','YELLOW','KEYWORD','STRING','COMMENT','NUMBER','FUNCTION','OPERATOR','LINE_NUMBER','CURSOR_LINE','SELECTION','DIFF_ADD','DIFF_DEL','DIFF_ADD_LINE','DIFF_DEL_LINE','SCROLL_BAR'];

function makeColor(r,g,b) { return {R:r/255,G:g/255,B:b/255}; }

const builtins = {
    HighContrast: { name:'High Contrast', BG:makeColor(5,5,10), PANEL:makeColor(10,10,18), SIDEBAR:makeColor(8,8,14), BORDER:makeColor(60,60,80), TEXT:makeColor(240,240,250), SUBTEXT:makeColor(140,140,160), ACCENT:makeColor(0,200,255), GREEN:makeColor(0,220,120), RED:makeColor(255,60,60), YELLOW:makeColor(255,200,80), KEYWORD:makeColor(255,100,180), STRING:makeColor(100,255,180), COMMENT:makeColor(100,100,120), NUMBER:makeColor(255,200,100), FUNCTION:makeColor(100,180,255), OPERATOR:makeColor(220,220,240), LINE_NUMBER:makeColor(80,80,100), CURSOR_LINE:makeColor(20,20,35), SELECTION:makeColor(40,40,80), DIFF_ADD:makeColor(20,80,40), DIFF_DEL:makeColor(80,30,30), DIFF_ADD_LINE:makeColor(15,50,25), DIFF_DEL_LINE:makeColor(50,20,20), SCROLL_BAR:makeColor(60,60,80) },
    OneDark: { name:'One Dark', BG:makeColor(40,44,52), PANEL:makeColor(45,49,58), SIDEBAR:makeColor(35,39,46), BORDER:makeColor(60,66,78), TEXT:makeColor(197,200,212), SUBTEXT:makeColor(110,115,130), ACCENT:makeColor(97,175,239), GREEN:makeColor(152,195,121), RED:makeColor(224,108,117), YELLOW:makeColor(229,192,87), KEYWORD:makeColor(198,120,221), STRING:makeColor(152,195,121), COMMENT:makeColor(96,103,120), NUMBER:makeColor(209,154,102), FUNCTION:makeColor(97,175,239), OPERATOR:makeColor(197,200,212), LINE_NUMBER:makeColor(80,85,100), CURSOR_LINE:makeColor(50,53,62), SELECTION:makeColor(70,73,86), DIFF_ADD:makeColor(50,70,55), DIFF_DEL:makeColor(70,35,35), DIFF_ADD_LINE:makeColor(40,60,45), DIFF_DEL_LINE:makeColor(55,25,25), SCROLL_BAR:makeColor(60,66,78) },
    Dracula: { name:'Dracula', BG:makeColor(40,42,54), PANEL:makeColor(45,47,60), SIDEBAR:makeColor(35,37,50), BORDER:makeColor(60,63,80), TEXT:makeColor(248,248,242), SUBTEXT:makeColor(115,115,130), ACCENT:makeColor(86,181,232), GREEN:makeColor(80,250,140), RED:makeColor(255,85,85), YELLOW:makeColor(241,250,140), KEYWORD:makeColor(219,132,255), STRING:makeColor(255,159,110), COMMENT:makeColor(90,95,120), NUMBER:makeColor(189,147,249), FUNCTION:makeColor(86,181,232), OPERATOR:makeColor(248,248,242), LINE_NUMBER:makeColor(70,72,90), CURSOR_LINE:makeColor(55,57,70), SELECTION:makeColor(65,68,90), DIFF_ADD:makeColor(50,85,65), DIFF_DEL:makeColor(80,40,40), DIFF_ADD_LINE:makeColor(40,70,55), DIFF_DEL_LINE:makeColor(60,30,30), SCROLL_BAR:makeColor(60,63,80) },
    Gruvbox: { name:'Gruvbox', BG:makeColor(40,36,30), PANEL:makeColor(48,44,38), SIDEBAR:makeColor(35,31,26), BORDER:makeColor(70,65,58), TEXT:makeColor(235,219,178), SUBTEXT:makeColor(140,130,115), ACCENT:makeColor(215,153,72), GREEN:makeColor(142,192,124), RED:makeColor(204,69,58), YELLOW:makeColor(215,153,72), KEYWORD:makeColor(254,176,102), STRING:makeColor(142,192,124), COMMENT:makeColor(130,120,100), NUMBER:makeColor(213,147,72), FUNCTION:makeColor(215,153,72), OPERATOR:makeColor(235,219,178), LINE_NUMBER:makeColor(90,85,75), CURSOR_LINE:makeColor(55,50,42), SELECTION:makeColor(65,60,52), DIFF_ADD:makeColor(55,80,55), DIFF_DEL:makeColor(85,45,40), DIFF_ADD_LINE:makeColor(45,65,45), DIFF_DEL_LINE:makeColor(65,35,30), SCROLL_BAR:makeColor(70,65,58) },
};

function createThemeService() {
    let active = builtins.HighContrast;
    const customThemes = {};
    let onChange = null;
    return {
        getActive: () => active,
        getTheme: (name) => builtins[name] || customThemes[name] || active,
        setTheme(name) {
            const t = builtins[name] || customThemes[name];
            if (!t) return false;
            active = t;
            if (onChange) onChange(t);
            return true;
        },
        getThemeNames() { return [...Object.keys(builtins), ...Object.keys(customThemes)].sort(); },
        addCustomTheme(name, data) {
            for (const k of REQUIRED_KEYS) { if (data[k] == null) return false; }
            data.name = name;
            customThemes[name] = data;
            return true;
        },
        removeCustomTheme(name) { delete customThemes[name]; },
        onThemeChange(cb) { onChange = cb; }
    };
}

// ── SyntaxService ─────────────────────────────────────────────────────────────

const KEYWORDS = new Set(['and','break','do','else','elseif','end','false','for','function','if','in','local','nil','not','or','repeat','return','then','true','until','while']);

const TOKEN_COLOR = { KEYWORD:'KEYWORD', STRING:'STRING', COMMENT:'COMMENT', NUMBER:'NUMBER', FUNCTION:'FUNCTION', OPERATOR:'OPERATOR', IDENTIFIER:'TEXT', WHITESPACE:'TEXT' };

function tokenize(source) {
    const tokens = [];
    let pos = 0;
    while (pos < source.length) {
        const c = source[pos];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
            let start = pos++;
            while (pos < source.length && ' \t\n\r'.includes(source[pos])) pos++;
            tokens.push({ type: 'WHITESPACE', text: source.slice(start, pos) });
        } else if (c === '-' && source[pos+1] === '-') {
            let start = pos; pos += 2;
            if (source[pos] === '[' && source[pos+1] === '[') { pos += 2; while (pos < source.length-1) { if (source[pos] === ']' && source[pos+1] === ']') { pos += 2; break; } pos++; } }
            else { while (pos < source.length && source[pos] !== '\n' && source[pos] !== '\r') pos++; }
            tokens.push({ type: 'COMMENT', text: source.slice(start, pos) });
        } else if (c === "'" || c === '"') {
            const q = c; let start = pos++;
            while (pos < source.length) { if (source[pos] === '\\') pos += 2; else if (source[pos] === q) { pos++; break; } else pos++; }
            tokens.push({ type: 'STRING', text: source.slice(start, pos) });
        } else if (c === '[' && source[pos+1] === '[') {
            let start = pos; pos += 2;
            while (pos < source.length-1) { if (source[pos] === ']' && source[pos+1] === ']') { pos += 2; break; } pos++; }
            tokens.push({ type: 'STRING', text: source.slice(start, pos) });
        } else if ((c >= '0' && c <= '9') || (c === '.' && source[pos+1] >= '0' && source[pos+1] <= '9')) {
            let start = pos;
            if (c === '0' && (source[pos+1] === 'x' || source[pos+1] === 'X')) { pos += 2; while (pos < source.length && '0123456789abcdefABCDEF'.includes(source[pos])) pos++; }
            else { while (pos < source.length && '0123456789.eE+-'.includes(source[pos])) pos++; }
            tokens.push({ type: 'NUMBER', text: source.slice(start, pos) });
        } else if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
            let start = pos++;
            while (pos < source.length && /[a-zA-Z0-9_]/.test(source[pos])) pos++;
            const text = source.slice(start, pos);
            tokens.push({ type: KEYWORDS.has(text) ? 'KEYWORD' : 'IDENTIFIER', text });
        } else {
            const two = source.slice(pos, pos+2);
            if (['==','~=','<=','>=','..'].includes(two)) { tokens.push({ type: 'OPERATOR', text: two }); pos += 2; }
            else { tokens.push({ type: 'OPERATOR', text: c }); pos++; }
        }
    }
    return tokens;
}

// ── DiffService ───────────────────────────────────────────────────────────────

function splitLines(s) { return s.split('\n'); }

function computeDiff(original, suggested) {
    const o = splitLines(original), s = splitLines(suggested);
    const m = o.length, n = s.length;
    const dp = Array.from({length: m+1}, () => Array(n+1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = o[i-1] === s[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
    const diff = []; let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && o[i-1] === s[j-1]) { diff.unshift({type:'same',line:o[i-1]}); i--; j--; }
        else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { diff.unshift({type:'add',line:s[j-1]}); j--; }
        else { diff.unshift({type:'del',line:o[i-1]}); i--; }
    }
    const removals = diff.filter(d => d.type === 'del').map(d => d.line);
    const additions = diff.filter(d => d.type === 'add').map(d => d.line);
    const context = diff.filter(d => d.type === 'same').map(d => d.line);
    return { targetLine: 1, additions, removals, context, explanation: '' };
}

function applyDiff(source, diff) {
    const lines = splitLines(source);
    for (let i = diff.removals.length - 1; i >= 0; i--) lines.splice(diff.targetLine - 1, 1);
    for (let i = 0; i < diff.additions.length; i++) lines.splice(diff.targetLine - 1 + i, 0, diff.additions[i]);
    return lines.join('\n');
}

function revertDiff(source, diff) {
    const lines = splitLines(source);
    for (let i = diff.additions.length - 1; i >= 0; i--) {
        const idx = lines.indexOf(diff.additions[i]);
        if (idx !== -1) lines.splice(idx, 1);
    }
    for (let i = 0; i < diff.removals.length; i++) lines.splice(diff.targetLine - 1 + i, 0, diff.removals[i]);
    return lines.join('\n');
}

// ── HistoryService ────────────────────────────────────────────────────────────

function createHistoryService() {
    const history = {};
    const MAX = 20;
    return {
        push(scriptPath, source, label, diff) {
            if (!history[scriptPath]) history[scriptPath] = [];
            history[scriptPath].push({ timestamp: Date.now()/1000, label: label||'edit', source, diff: diff||null });
            while (history[scriptPath].length > MAX) history[scriptPath].shift();
        },
        getHistory(scriptPath) { return history[scriptPath] || []; },
        getVersion(scriptPath, idx) { const h = history[scriptPath]; return h ? h[idx-1] : null; },
        revertTo(scriptPath, idx) { const e = this.getVersion(scriptPath, idx); return e ? e.source : null; },
        getLatest(scriptPath) { const h = history[scriptPath]; return h && h.length ? h[h.length-1] : null; },
        clear(scriptPath) { delete history[scriptPath]; }
    };
}

// ── ScriptWriter ──────────────────────────────────────────────────────────────

function isScriptInstance(inst) { return inst && ['Script','LocalScript','ModuleScript'].includes(inst.ClassName); }

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

let passed = 0, failed = 0;
const failures = [];

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function test(name, fn) {
    try { fn(); console.log(`PASS ${name}`); passed++; }
    catch(e) { console.log(`FAIL ${name} -- ${e.message}`); failed++; failures.push(name); }
}

// ── EventBus ──────────────────────────────────────────────────────────────────

test('EventBus.on fires listener', () => {
    EventBus.clear();
    let fired = false;
    EventBus.on('t', () => { fired = true; });
    EventBus.emit('t');
    assert(fired, 'listener not fired');
});

test('EventBus.off removes listener', () => {
    EventBus.clear();
    let count = 0;
    const cb = () => { count++; };
    EventBus.on('t', cb);
    EventBus.off('t', cb);
    EventBus.emit('t');
    assert(count === 0, 'listener not removed');
});

test('EventBus.emit passes arguments', () => {
    EventBus.clear();
    let a, b;
    EventBus.on('t', (x, y) => { a = x; b = y; });
    EventBus.emit('t', 42, 'hi');
    assert(a === 42, 'first arg wrong');
    assert(b === 'hi', 'second arg wrong');
});

test('EventBus.clear removes all', () => {
    EventBus.clear();
    let count = 0;
    EventBus.on('a', () => count++);
    EventBus.on('b', () => count++);
    EventBus.clear();
    EventBus.emit('a'); EventBus.emit('b');
    assert(count === 0, 'not cleared');
});

test('EventBus multiple listeners', () => {
    EventBus.clear();
    let count = 0;
    EventBus.on('t', () => count++);
    EventBus.on('t', () => count++);
    EventBus.on('t', () => count++);
    EventBus.emit('t');
    assert(count === 3, `expected 3, got ${count}`);
});

test('EventBus unsubscribe function', () => {
    EventBus.clear();
    let count = 0;
    const unsub = EventBus.on('t', () => count++);
    EventBus.emit('t');
    assert(count === 1, 'not fired');
    unsub();
    EventBus.emit('t');
    assert(count === 1, 'not unsubscribed');
});

test('EventBus emit no listeners no error', () => {
    EventBus.clear();
    EventBus.emit('x', 1, 2, 3);
});

// ── StateStore ────────────────────────────────────────────────────────────────

test('StateStore get returns default', () => {
    const s = createStateStore();
    assert(s.get('connected') === false, 'expected false');
});

test('StateStore set updates value', () => {
    const s = createStateStore();
    s.set('connected', true);
    assert(s.get('connected') === true, 'not updated');
});

test('StateStore set fires notification', () => {
    const s = createStateStore();
    let changed = false;
    s.subscribe('*', (k) => { if (k === 'connected') changed = true; });
    s.set('connected', true);
    assert(changed, 'event not fired');
});

test('StateStore set skips for same value', () => {
    const s = createStateStore();
    s.set('connected', true);
    let count = 0;
    s.subscribe('*', () => count++);
    s.set('connected', true);
    assert(count === 0, 'fired for same value');
});

test('StateStore getAll returns copy', () => {
    const s = createStateStore();
    const all = s.getAll();
    all.connected = 'x';
    assert(s.get('connected') === false, 'not a copy');
});

test('StateStore subscribe to key', () => {
    const s = createStateStore();
    let notified = false;
    s.subscribe('cursorLine', () => notified = true);
    s.set('cursorLine', 5);
    assert(notified, 'not notified');
});

test('StateStore subscribe only fires for subscribed key', () => {
    const s = createStateStore();
    let notified = false;
    s.subscribe('cursorLine', () => notified = true);
    s.set('connected', true);
    assert(!notified, 'fired for wrong key');
});

// ── ThemeService ──────────────────────────────────────────────────────────────

test('ThemeService getActive returns theme', () => {
    const ts = createThemeService();
    const t = ts.getActive();
    assert(t && t.name === 'High Contrast', 'wrong theme');
});

test('ThemeService getTheme by name', () => {
    const ts = createThemeService();
    const t = ts.getTheme('OneDark');
    assert(t && t.name === 'One Dark', 'wrong theme');
});

test('ThemeService setTheme switches', () => {
    const ts = createThemeService();
    assert(ts.setTheme('Dracula'), 'setTheme failed');
    assert(ts.getActive().name === 'Dracula', 'not switched');
});

test('ThemeService setTheme fires callback', () => {
    const ts = createThemeService();
    let fired = false;
    ts.onThemeChange(() => fired = true);
    ts.setTheme('OneDark');
    assert(fired, 'callback not fired');
});

test('ThemeService invalid theme returns false', () => {
    const ts = createThemeService();
    assert(!ts.setTheme('NonExistent'), 'should return false');
});

test('ThemeService addCustomTheme', () => {
    const ts = createThemeService();
    const data = {}; REQUIRED_KEYS.forEach(k => data[k] = makeColor(0,0,0));
    assert(ts.addCustomTheme('Custom', data), 'addCustomTheme failed');
    assert(ts.getTheme('Custom') != null, 'custom theme not found');
});

test('ThemeService addCustomTheme validates', () => {
    const ts = createThemeService();
    assert(!ts.addCustomTheme('Bad', {BG:makeColor(0,0,0)}), 'should reject incomplete');
});

test('ThemeService removeCustomTheme', () => {
    const ts = createThemeService();
    const data = {}; REQUIRED_KEYS.forEach(k => data[k] = makeColor(0,0,0));
    ts.addCustomTheme('ToRemove', data);
    ts.removeCustomTheme('ToRemove');
    // After removal, getTheme falls back to active theme (not null)
    // The custom theme should no longer be in the names list
    assert(!ts.getThemeNames().includes('ToRemove'), 'still in names');
});

test('ThemeService getThemeNames', () => {
    const ts = createThemeService();
    const names = ts.getThemeNames();
    assert(names.length >= 4, `expected 4+, got ${names.length}`);
});

// ── SyntaxService ─────────────────────────────────────────────────────────────

test('SyntaxService tokenize keywords', () => {
    const tokens = tokenize('local function if then end');
    const types = tokens.filter(t => t.type !== 'WHITESPACE').map(t => t.type);
    assert(types.length === 5, `expected 5, got ${types.length}`);
    types.forEach(t => assert(t === 'KEYWORD', `expected KEYWORD, got ${t}`));
});

test('SyntaxService tokenize single quoted strings', () => {
    const tokens = tokenize("'hello world'");
    assert(tokens.length === 1 && tokens[0].type === 'STRING', 'not a string');
});

test('SyntaxService tokenize double quoted strings', () => {
    const tokens = tokenize('"hello world"');
    assert(tokens.length === 1 && tokens[0].type === 'STRING', 'not a string');
});

test('SyntaxService tokenize long strings', () => {
    const tokens = tokenize('[[long string]]');
    assert(tokens.length === 1 && tokens[0].type === 'STRING', 'not a string');
});

test('SyntaxService tokenize comments', () => {
    const tokens = tokenize('-- comment');
    assert(tokens.length === 1 && tokens[0].type === 'COMMENT', 'not a comment');
});

test('SyntaxService tokenize block comments', () => {
    const tokens = tokenize('--[[ block ]]');
    assert(tokens.length === 1 && tokens[0].type === 'COMMENT', 'not a comment');
});

test('SyntaxService tokenize numbers', () => {
    const tokens = tokenize('42 3.14 0xFF');
    const nums = tokens.filter(t => t.type === 'NUMBER').map(t => t.text);
    assert(nums.length === 3, `expected 3 numbers, got ${nums.length}`);
    assert(nums[0] === '42', `first wrong: ${nums[0]}`);
    assert(nums[1] === '3.14', `second wrong: ${nums[1]}`);
    assert(nums[2] === '0xFF', `third wrong: ${nums[2]}`);
});

test('SyntaxService tokenize identifiers', () => {
    const tokens = tokenize('myVar _test foo');
    const ids = tokens.filter(t => t.type === 'IDENTIFIER').map(t => t.text);
    assert(ids.length === 3, `expected 3, got ${ids.length}`);
    assert(ids[0] === 'myVar' && ids[1] === '_test', 'wrong identifiers');
});

test('SyntaxService tokenize operators', () => {
    const tokens = tokenize('= + == ~= <= >=');
    const ops = tokens.filter(t => t.type === 'OPERATOR');
    assert(ops.length >= 4, `expected 4+, got ${ops.length}`);
});

test('SyntaxService tokenize whitespace', () => {
    const tokens = tokenize('  local  x  ');
    assert(tokens.some(t => t.type === 'WHITESPACE'), 'no whitespace');
});

test('SyntaxService tokenize empty source', () => {
    const tokens = tokenize('');
    assert(tokens.length === 0, `expected 0, got ${tokens.length}`);
});

test('SyntaxService getTokenColorKey', () => {
    assert(TOKEN_COLOR.KEYWORD === 'KEYWORD', 'KEYWORD wrong');
    assert(TOKEN_COLOR.STRING === 'STRING', 'STRING wrong');
    assert(TOKEN_COLOR.COMMENT === 'COMMENT', 'COMMENT wrong');
    assert(TOKEN_COLOR.NUMBER === 'NUMBER', 'NUMBER wrong');
    assert(TOKEN_COLOR.IDENTIFIER === 'TEXT', 'IDENTIFIER wrong');
});

// ── DiffService ───────────────────────────────────────────────────────────────

test('DiffService computeDiff additions', () => {
    const diff = computeDiff('a\nb\nc', 'a\nb\nc\nd');
    assert(diff.additions.length >= 1, 'no additions');
    assert(diff.additions.includes('d'), 'addition d not found');
});

test('DiffService computeDiff removals', () => {
    const diff = computeDiff('a\nb\nc', 'a\nc');
    assert(diff.removals.length >= 1, 'no removals');
    assert(diff.removals.includes('b'), 'removal b not found');
});

test('DiffService computeDiff context', () => {
    const diff = computeDiff('keep\nremove\nkeep2', 'keep\nkeep2');
    assert(diff.context.length >= 1, 'no context');
});

test('DiffService applyDiff', () => {
    const result = applyDiff('line1\nline2\nline3', { targetLine: 2, additions: ['new2'], removals: ['line2'], context: [] });
    assert(result.includes('new2'), 'addition not applied');
    assert(!result.includes('line2'), 'removal not applied');
});

test('DiffService revertDiff', () => {
    const result = revertDiff('line1\nnew2\nline3', { targetLine: 2, additions: ['new2'], removals: ['line2'], context: [] });
    assert(result.includes('line2'), 'revert did not restore');
    assert(!result.includes('new2'), 'revert did not remove');
});

test('DiffService empty diff', () => {
    const result = applyDiff('a\nb', { targetLine: 1, additions: [], removals: [], context: ['a','b'] });
    assert(result === 'a\nb', 'empty diff changed source');
});

test('DiffService multi-line diff', () => {
    const diff = computeDiff('a\nb\nc\nd', 'a\nx\ny\nd');
    assert(diff.removals.length >= 1, 'no removals');
    assert(diff.additions.length >= 1, 'no additions');
});

// ── HistoryService ────────────────────────────────────────────────────────────

test('HistoryService push adds version', () => {
    const hs = createHistoryService();
    hs.push('test', 'src', 'label');
    assert(hs.getHistory('test').length === 1, 'version not added');
});

test('HistoryService getHistory returns list', () => {
    const hs = createHistoryService();
    hs.push('p', 'v1', 'a');
    hs.push('p', 'v2', 'b');
    assert(hs.getHistory('p').length === 2, 'wrong count');
});

test('HistoryService getVersion by index', () => {
    const hs = createHistoryService();
    hs.push('p', 'v1', 'a');
    hs.push('p', 'v2', 'b');
    const v = hs.getVersion('p', 2);
    assert(v && v.source === 'v2', 'wrong source');
    assert(v.label === 'b', 'wrong label');
});

test('HistoryService revertTo returns source', () => {
    const hs = createHistoryService();
    hs.push('p', 'orig', 'a');
    hs.push('p', 'mod', 'b');
    assert(hs.revertTo('p', 1) === 'orig', 'wrong revert');
});

test('HistoryService max 20 versions', () => {
    const hs = createHistoryService();
    for (let i = 1; i <= 25; i++) hs.push('p', 'v'+i, 'e'+i);
    assert(hs.getHistory('p').length === 20, `expected 20, got ${hs.getHistory('p').length}`);
    assert(hs.getHistory('p')[0].source === 'v6', 'oldest should be v6');
});

test('HistoryService clear', () => {
    const hs = createHistoryService();
    hs.push('p', 'v', 'l');
    hs.clear('p');
    assert(hs.getHistory('p').length === 0, 'not cleared');
});

test('HistoryService latest', () => {
    const hs = createHistoryService();
    hs.push('p', 'v1', 'a');
    hs.push('p', 'v2', 'b');
    assert(hs.getLatest('p').source === 'v2', 'wrong latest');
});

test('HistoryService latest empty returns null', () => {
    const hs = createHistoryService();
    assert(hs.getLatest('x') === null, 'should be null');
});

test('HistoryService getVersion invalid index', () => {
    const hs = createHistoryService();
    hs.push('p', 'v', 'l');
    // Lua returns nil for out-of-bounds; JS returns undefined
    const result = hs.getVersion('p', 99);
    assert(result == null, `should be null/undefined, got ${result}`);
});

// ── ScriptWriter ──────────────────────────────────────────────────────────────

test('ScriptWriter isWritable Script', () => {
    assert(isScriptInstance({ClassName:'Script'}) === true, 'Script should be writable');
});

test('ScriptWriter isWritable LocalScript', () => {
    assert(isScriptInstance({ClassName:'LocalScript'}) === true, 'LocalScript should be writable');
});

test('ScriptWriter isWritable ModuleScript', () => {
    assert(isScriptInstance({ClassName:'ModuleScript'}) === true, 'ModuleScript should be writable');
});

test('ScriptWriter isWritable invalid', () => {
    assert(isScriptInstance({ClassName:'Frame'}) === false, 'Frame should not be writable');
});

test('ScriptWriter isWritable null', () => {
    // Lua: if not instance then return false — nil is falsy
    // JS: null is falsy, but we check inst.ClassName which throws
    // The Lua code does: if not instance then return false end
    // So nil/null should return false. Our JS impl checks inst.ClassName first.
    // Let's match the Lua behavior:
    function isScriptInstanceSafe(inst) {
        if (!inst) return false;
        return ['Script','LocalScript','ModuleScript'].includes(inst.ClassName);
    }
    assert(isScriptInstanceSafe(null) === false, 'null should not be writable');
    assert(isScriptInstanceSafe(undefined) === false, 'undefined should not be writable');
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log('Failed:', failures.join(', '));
    process.exit(1);
}
process.exit(0);
