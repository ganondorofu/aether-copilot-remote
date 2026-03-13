/* Aether — Frontend v5 */

// ===== SVG ICON PATHS (20x20 viewBox, stroke-based) =====
const IP = {
  logo:      '<circle cx="10" cy="4.5" r="2.5" fill="currentColor" stroke="none"/><circle cx="4" cy="16" r="2.5" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none"/><line x1="10" y1="7" x2="4" y2="13.5"/><line x1="10" y1="7" x2="16" y2="13.5"/><line x1="6.5" y1="16" x2="13.5" y2="16"/>',
  menu:      '<path d="M3 5h14M3 10h14M3 15h14"/>',
  plus:      '<path d="M10 4v12M4 10h12"/>',
  x:         '<path d="M5 5l10 10M15 5L5 15"/>',
  send:      '<path d="M3 10l14-7v14z" fill="currentColor" stroke="none"/>',
  stop:      '<rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
  settings:  '<circle cx="10" cy="10" r="2.5"/><path d="M10 2v2.5M10 15.5v2.5M2 10h2.5M15.5 10H18M4.5 4.5l1.7 1.7M13.8 13.8l1.7 1.7M4.5 15.5l1.7-1.7M13.8 6.2l1.7-1.7"/>',
  folder:    '<path d="M2 6.5a1.5 1.5 0 011.5-1.5h3.5l2 2h7a1.5 1.5 0 011.5 1.5v7a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 16V6.5z"/>',
  file:      '<path d="M5 3h6l5 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M11 3v4h5"/>',
  terminal:  '<path d="M5 8l4 3-4 3"/><path d="M11 15h5"/>',
  edit:      '<path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z"/>',
  trash:     '<path d="M4 5h12"/><path d="M6 5v10a1 1 0 001 1h6a1 1 0 001-1V5"/><path d="M8 2h4v3H8z"/><path d="M8 8v5M12 8v5"/>',
  search:    '<circle cx="9" cy="9" r="5"/><path d="M13 13l4 4"/>',
  globe:     '<circle cx="10" cy="10" r="7"/><path d="M3 10h14"/><path d="M10 3c-2.5 2-2.5 12 0 14"/><path d="M10 3c2.5 2 2.5 12 0 14"/>',
  eye:       '<path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
  tool:      '<path d="M14.5 5.5l-2.2 2.2 2.5 2.5 2.2-2.2a3.5 3.5 0 01-5 5L6 19l-3-3 6-6a3.5 3.5 0 015.5-4.5z"/>',
  bulb:      '<path d="M10 2a5 5 0 013 9v2H7v-2a5 5 0 013-9z"/><path d="M7.5 15h5M8.5 17h3"/>',
  chevDown:  '<path d="M6 8l4 4 4-4"/>',
  chevRight: '<path d="M8 6l4 4-4 4"/>',
  lock:      '<rect x="5" y="9" width="10" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 016 0V9"/>',
  sun:       '<circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4"/>',
  moon:      '<path d="M16.5 11A6.5 6.5 0 019 3.5 7 7 0 1016.5 11z"/>',
  logout:    '<path d="M12 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4"/><path d="M8 15l-4-4 4-4"/><path d="M4 11h10"/>',
  attach:    '<path d="M14.5 7l-6.5 6.5a2.5 2.5 0 01-3.5-3.5L11 3.5a1.5 1.5 0 012.1 2.1L7 12"/>',
  image:     '<rect x="2" y="4" width="16" height="12" rx="1.5"/><circle cx="7" cy="9" r="1.5" fill="currentColor" stroke="none"/><path d="M18 14l-4-4-8 8"/>',
  check:     '<path d="M4 10l4 4 8-8"/>',
  up:        '<path d="M10 16V4"/><path d="M5 9l5-5 5 5"/>',
  code:      '<path d="M7 7L3 10l4 3"/><path d="M13 7l4 3-4 3"/>',
  copy:      '<rect x="7" y="7" width="9" height="11" rx="1"/><path d="M5 15V4a1 1 0 011-1h8"/>',
  msg:       '<path d="M3 4h14a1 1 0 011 1v9a1 1 0 01-1 1H7l-4 3V5a1 1 0 011-1z"/>',
};
function icon(name, sz = 18) {
  return `<svg class="icon" viewBox="0 0 20 20" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${IP[name]||''}</svg>`;
}
const TK = {read:'eye',edit:'edit',create:'file',delete:'trash',search:'search',execute:'terminal',think:'bulb',fetch:'globe',move:'folder',other:'tool'};
function toolIcon(kind) { return icon(TK[kind]||'tool', 16); }

// ===== STATE =====
const S = {
  token: localStorage.getItem('aether-token'),
  wsId: localStorage.getItem('aether-workspace'),
  sid: localStorage.getItem('aether-session'),
  cwd: '', sessions: [], commands: [],
  models: [], modes: [], configOptions: [],
  currentModelId: '', currentModeId: '',
  yoloLevel: 0, running: false, replaying: false,
  connected: false, attachments: [],
};
const chats = new Map(); // sid -> { el, agentEl, agentBuf, thoughtEl, thoughtBuf, tools }
let socket = null;

// ===== DOM REFS =====
const $ = id => document.getElementById(id);

// ===== UTILS =====
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function timeAgo(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  if (s<60) return 'now'; if (s<3600) return Math.floor(s/60)+'m'; if (s<86400) return Math.floor(s/3600)+'h'; return Math.floor(s/86400)+'d';
}
function fmtSize(n) {
  if (n<1024) return n+'B'; if (n<1048576) return (n/1024).toFixed(1)+'K'; return (n/1048576).toFixed(1)+'M';
}
function scrollDown(force) {
  if (S.replaying && !force) return;
  const c = $('chat');
  const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 150;
  if (nearBottom || force) requestAnimationFrame(() => c.scrollTop = c.scrollHeight);
}
function initScrollBtn() {
  const chat = $('chat'), btn = $('scroll-bottom-btn');
  btn.onclick = () => { chat.scrollTop = chat.scrollHeight; };
  chat.addEventListener('scroll', () => {
    const near = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 120;
    btn.hidden = near;
  });
}
function renderMd(text) {
  try {
    const raw = marked.parse(text || '');
    return typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(raw) : raw;
  } catch { return esc(text); }
}
function highlightCode(el) {
  if (typeof hljs !== 'undefined') el.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
}

// ===== THEME =====
function initTheme() {
  const t = localStorage.getItem('aether-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
  if ($('hljs-dark')) $('hljs-dark').disabled = t !== 'dark';
  if ($('hljs-light')) $('hljs-light').disabled = t !== 'light';
}
function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('aether-theme', t);
  if ($('hljs-dark')) $('hljs-dark').disabled = t !== 'dark';
  if ($('hljs-light')) $('hljs-light').disabled = t !== 'light';
  $('theme-btn').innerHTML = icon(t === 'dark' ? 'moon' : 'sun');
}

// ===== AUTH =====
async function checkAuth() {
  try {
    const h = S.token ? { Authorization: 'Bearer ' + S.token } : {};
    const r = await fetch('/api/auth/status', { headers: h });
    const d = await r.json();
    if (d.status === 'authenticated') { showApp(); return; }
    $('auth-overlay').style.display = '';
    $('app').style.display = 'none';
    if (d.status === 'setup') {
      $('auth-subtitle').textContent = 'Create your account to get started';
      $('auth-submit').textContent = 'Create Account';
      $('auth-form').dataset.mode = 'setup';
    } else {
      $('auth-subtitle').textContent = 'Sign in to continue';
      $('auth-submit').textContent = 'Sign In';
      $('auth-form').dataset.mode = 'login';
    }
  } catch (e) {
    $('auth-error').textContent = 'Connection error: ' + e.message;
  }
}
async function doAuth(e) {
  e.preventDefault();
  const mode = $('auth-form').dataset.mode;
  const username = $('auth-user').value.trim();
  const password = $('auth-pass').value;
  if (!username || !password) return;
  $('auth-error').textContent = '';
  $('auth-submit').disabled = true;
  try {
    const r = await fetch('/api/auth/' + mode, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const d = await r.json();
    if (!r.ok) { $('auth-error').textContent = d.error || 'Failed'; return; }
    S.token = d.token;
    localStorage.setItem('aether-token', d.token);
    showApp();
  } catch (e) {
    $('auth-error').textContent = 'Error: ' + e.message;
  } finally {
    $('auth-submit').disabled = false;
  }
}
function showApp() {
  $('auth-overlay').style.display = 'none';
  $('app').style.display = '';
  if (!socket) connect();
}

// ===== CONNECT =====
function connect() {
  updateBadge('connecting');
  socket = io({ auth: { token: S.token }, reconnection: true, reconnectionDelay: 2000 });
  socket.on('connect', () => {
    S.connected = true;
    socket.emit('auto_connect', { workspaceId: S.wsId, sessionId: S.sid, cwd: S.cwd || undefined });
  });
  socket.on('disconnect', () => { S.connected = false; updateBadge('disconnected'); });
  socket.on('connect_error', e => {
    if (e.message === 'auth_required' || e.message === 'auth_invalid') {
      S.token = null; localStorage.removeItem('aether-token'); checkAuth();
    } else { updateBadge('error'); }
  });
  socket.on('msg', handleMsg);
}

// ===== MESSAGE HANDLER =====
function handleMsg(d) {
  try {
  switch (d.type) {
    case 'init': handleInit(d); break;
    case 'replay_start': {
      S.replaying = true;
      S._replayingSid = d.sessionId || S.sid;
      const rSid = S._replayingSid;
      const rc = chats.get(rSid);
      if (rc) { rc.el.innerHTML = ''; rc.agentEl = null; rc.agentBuf = ''; rc.thoughtEl = null; rc.thoughtBuf = ''; rc.tools.clear(); }
      break;
    }
    case 'replay_end': S.replaying = false; S._replayingSid = null; scrollDown(true); break;
    case 'chunk': handleChunk(d); break;
    case 'tool': addToolCard(d); break;
    case 'tool_update': updateToolCard(d); break;
    case 'plan': renderPlan(d); break;
    case 'commands': S.commands = d.commands || []; break;
    case 'mode_update': S.currentModeId = d.modeId || ''; renderModes(); break;
    case 'model_update':
      if (d.availableModels) S.models = d.availableModels;
      if (!d.sessionId || d.sessionId === S.sid) { S.currentModelId = d.modelId || ''; renderModels(); }
      break;
    case 'config_update': S.configOptions = d.configOptions || []; renderSettings(); break;
    case 'usage': renderUsage(d.usage); break;
    case 'permission': showPermission(d); break;
    case 'permission_resolved': dismissPermission(d.requestId); break;
    case 'session_created': if (!S.replaying) handleSessionCreated(d); break;
    case 'session_switched': if (!S.replaying) handleSessionSwitched(d); break;
    case 'session_deleted': if (!S.replaying) handleSessionDeleted(d); break;
    case 'session_renamed': if (!S.replaying) handleSessionRenamed(d); break;
    case 'prompt_start': if (!S.replaying) setRunning(true, d.sessionId); break;
    case 'prompt_end': if (!S.replaying) setRunning(false, d.sessionId); break;
    case 'done': handleDone(d); break;
    case 'user_message': appendMsg(d.sessionId, `<div class="msg msg-user">${esc(d.text||'')}</div>`); break;
    case 'error': appendMsg(d.sessionId, `<div class="msg msg-error">${esc(d.message||'Error')}</div>`); break;
    case 'status': appendMsg(d.sessionId, `<div class="msg msg-status">${esc(d.message||'')}</div>`); break;
    case 'auto_approved': appendMsg(d.sessionId, `<div class="msg msg-auto-approved">${icon('check',14)} Auto-approved: ${esc(d.title||'')} (${esc(d.kind||'')})</div>`); break;
    case 'stderr': break; // suppress
    case 'yolo_update': if (!d.sessionId || d.sessionId === S.sid) { S.yoloLevel = d.level; $('yolo-select').value = d.level; } break;
    case 'dir_listing': renderDirListing(d); break;
  }
  } catch (e) { console.error('handleMsg error:', e, d); }
}

function handleInit(d) {
  S.wsId = d.workspaceId;
  S.sid = d.sessionId;
  S.sessions = d.sessions || [];
  S.cwd = d.cwd || '';
  S.yoloLevel = d.yoloLevel ?? 0;
  if (d.modes) { S.modes = d.modes.availableModes || []; S.currentModeId = d.modes.currentModeId || ''; }
  if (d.models) { S.models = d.models.availableModels || []; S.currentModelId = d.models.currentModelId || ''; }
  S.configOptions = d.configOptions || [];
  localStorage.setItem('aether-workspace', S.wsId);
  localStorage.setItem('aether-session', S.sid);
  updateBadge('connected');
  $('yolo-select').value = S.yoloLevel;
  renderModels(); renderModes(); renderSidebar(); updateHeader();
  ensureChat(S.sid);
  showActiveChat();
  scrollDown(true);
}

function handleChunk(d) {
  const sid = d.sessionId || S.sid;
  const c = ensureChat(sid);
  if (d.role === 'agent') {
    if (!c.agentEl) {
      c.agentBuf = '';
      const div = document.createElement('div');
      div.className = 'msg msg-agent';
      div.innerHTML = '<div class="md-content"></div>';
      c.agentEl = div;
      c.el.appendChild(div);
    }
    c.agentBuf += d.text;
    scheduleChunkRender(c, 'agent');
  } else if (d.role === 'thought') {
    if (!c.thoughtEl) {
      c.thoughtBuf = '';
      const div = document.createElement('div');
      div.className = 'msg msg-thought';
      div.innerHTML = `<button class="thought-toggle">${icon('bulb',14)} Thinking...</button><div class="thought-content" style="white-space:pre-wrap;margin-top:4px"></div>`;
      div.querySelector('.thought-toggle').onclick = () => {
        const content = div.querySelector('.thought-content');
        content.style.display = content.style.display === 'none' ? '' : 'none';
      };
      c.thoughtEl = div;
      c.el.appendChild(div);
    }
    c.thoughtBuf += d.text;
    scheduleChunkRender(c, 'thought');
  }
}
// Throttle markdown re-renders during streaming (max every 80ms)
const CHUNK_THROTTLE_MS = 80;
function scheduleChunkRender(c, role) {
  const key = '_renderTimer_' + role;
  if (c[key]) return;
  c[key] = setTimeout(() => {
    c[key] = null;
    let rendered = false;
    if (role === 'agent' && c.agentEl) {
      const md = c.agentEl.querySelector('.md-content');
      if (md) { md.innerHTML = renderMd(c.agentBuf); rendered = true; }
    } else if (role === 'thought' && c.thoughtEl) {
      const tc = c.thoughtEl.querySelector('.thought-content');
      if (tc) { tc.textContent = c.thoughtBuf; rendered = true; }
    }
    if (rendered) scrollDown();
  }, CHUNK_THROTTLE_MS);
}

function addToolCard(d) {
  const sid = d.sessionId || S.sid;
  const c = ensureChat(sid);
  // Finalize any open agent element so tool card appears in correct order
  if (c.agentEl && c.agentBuf) {
    if (c._renderTimer_agent) { clearTimeout(c._renderTimer_agent); c._renderTimer_agent = null; }
    const md = c.agentEl.querySelector('.md-content');
    if (md) { md.innerHTML = renderMd(c.agentBuf); highlightCode(c.agentEl); }
    c.agentEl = null; c.agentBuf = '';
  }
  const div = document.createElement('div');
  div.className = 'tool-card';
  div.dataset.toolId = d.toolCallId;
  const contentText = renderToolContent(d.content);
  const locs = (d.locations||[]).map(l => `<span class="tool-loc">${esc(l.uri||l.path||'')}</span>`).join('');
  div.innerHTML = `
    <div class="tool-header">
      <span class="tool-icon">${toolIcon(d.kind)}</span>
      <span class="tool-title">${esc(d.title||d.kind||'Tool')}</span>
      <span class="tool-badge ${d.status||'pending'}">${d.status||'pending'}</span>
    </div>
    ${contentText ? `<div class="tool-content" style="display:none"><pre>${contentText}</pre></div><button class="tool-content-toggle">Show details</button>` : ''}
    ${locs ? `<div class="tool-locations">${locs}</div>` : ''}
  `;
  attachToolToggle(div);
  c.tools.set(d.toolCallId, div);
  c.el.appendChild(div);
  scrollDown();
}

function updateToolCard(d) {
  const sid = d.sessionId || S.sid;
  const c = chats.get(sid);
  if (!c) return;
  let div = c.tools.get(d.toolCallId);
  if (!div) { addToolCard(d); return; }
  const badge = div.querySelector('.tool-badge');
  if (badge) { badge.textContent = d.status||''; badge.className = 'tool-badge '+(d.status||''); }
  if (d.content?.length) {
    let tc = div.querySelector('.tool-content');
    if (!tc) {
      tc = document.createElement('div');
      tc.className = 'tool-content';
      tc.style.display = 'none';
      const btn = document.createElement('button');
      btn.className = 'tool-content-toggle';
      btn.textContent = 'Show details';
      div.querySelector('.tool-header').after(tc);
      tc.after(btn);
      attachToolToggle(div);
    }
    tc.innerHTML = `<pre>${renderToolContent(d.content)}</pre>`;
  }
  if (d.locations?.length) {
    let lc = div.querySelector('.tool-locations');
    if (!lc) { lc = document.createElement('div'); lc.className = 'tool-locations'; div.appendChild(lc); }
    lc.innerHTML = d.locations.map(l => `<span class="tool-loc">${esc(l.uri||l.path||'')}</span>`).join('');
  }
  scrollDown();
}

function renderToolContent(content) {
  if (!content?.length) return '';
  return content.map(c => {
    if (c.type === 'text') return esc(c.text||'');
    if (c.type === 'diff') return renderDiff(c.text||'');
    return esc(JSON.stringify(c));
  }).join('\n');
}
function attachToolToggle(div) {
  const btn = div.querySelector('.tool-content-toggle');
  if (!btn) return;
  btn.onclick = () => {
    const tc = div.querySelector('.tool-content');
    if (!tc) return;
    const show = tc.style.display === 'none';
    tc.style.display = show ? '' : 'none';
    btn.textContent = show ? 'Hide details' : 'Show details';
  };
}
function renderDiff(text) {
  return text.split('\n').map(l => {
    if (l.startsWith('+++') || l.startsWith('---')) return `<span class="diff-path">${esc(l)}</span>`;
    if (l.startsWith('+')) return `<span class="diff-add">${esc(l)}</span>`;
    if (l.startsWith('-')) return `<span class="diff-del">${esc(l)}</span>`;
    if (l.startsWith('@@')) return `<span class="diff-path">${esc(l)}</span>`;
    return esc(l);
  }).join('\n');
}

function handleDone(d) {
  const sid = d.sessionId || S.sid;
  const c = ensureChat(sid);
  // Cancel any pending chunk renders
  if (c._renderTimer_agent) { clearTimeout(c._renderTimer_agent); c._renderTimer_agent = null; }
  if (c._renderTimer_thought) { clearTimeout(c._renderTimer_thought); c._renderTimer_thought = null; }
  // Finalize agent message + highlight code
  if (c.agentEl && c.agentBuf) {
    const md = c.agentEl.querySelector('.md-content');
    if (md) { md.innerHTML = renderMd(c.agentBuf); highlightCode(c.agentEl); }
    c.agentEl = null; c.agentBuf = '';
  }
  // Collapse thought
  if (c.thoughtEl) {
    const tc = c.thoughtEl.querySelector('.thought-content');
    if (tc) tc.style.display = 'none';
    const tg = c.thoughtEl.querySelector('.thought-toggle');
    if (tg) tg.innerHTML = `${icon('bulb',14)} Thought (${(c.thoughtBuf||'').length} chars)`;
    c.thoughtEl = null; c.thoughtBuf = '';
  }
  c.tools.clear();
  appendMsg(sid, `<div class="msg msg-done">${icon('check',14)} Done (${esc(d.stopReason||'completed')})</div>`);
  if (d.usage) renderUsage(d.usage);
}

function handleSessionCreated(d) {
  S.sessions = d.sessions || S.sessions;
  S.sid = d.sessionId;
  S.cwd = d.cwd || S.cwd;
  localStorage.setItem('aether-session', S.sid);
  if (d.modes) { S.modes = d.modes.availableModes || S.modes; S.currentModeId = d.modes.currentModeId || S.currentModeId; }
  if (d.models) { S.models = d.models.availableModels || S.models; S.currentModelId = d.models.currentModelId || ''; }
  if (d.yoloLevel !== undefined) { S.yoloLevel = d.yoloLevel; $('yolo-select').value = S.yoloLevel; }
  if (d.configOptions) S.configOptions = d.configOptions;
  ensureChat(S.sid);
  showActiveChat(); renderSidebar(); updateHeader(); renderModels(); renderModes();
}
function handleSessionSwitched(d) {
  S.sessions = d.sessions || S.sessions;
  S.sid = d.sessionId;
  S.cwd = d.cwd || S.cwd;
  localStorage.setItem('aether-session', S.sid);
  // Per-session model & yolo
  if (d.models) { S.models = d.models.availableModels || S.models; S.currentModelId = d.models.currentModelId || ''; renderModels(); }
  if (d.yoloLevel !== undefined) { S.yoloLevel = d.yoloLevel; $('yolo-select').value = S.yoloLevel; }
  ensureChat(S.sid);
  showActiveChat(); renderSidebar(); updateHeader();
  scrollDown(true);
}
function handleSessionDeleted(d) {
  S.sessions = d.sessions || S.sessions;
  if (d.deletedSessionId) { const c = chats.get(d.deletedSessionId); if (c?.el) c.el.remove(); chats.delete(d.deletedSessionId); }
  S.sid = d.sessionId; S.cwd = d.cwd || S.cwd;
  ensureChat(S.sid);
  showActiveChat(); renderSidebar(); updateHeader();
}
function handleSessionRenamed(d) {
  S.sessions = d.sessions || S.sessions;
  renderSidebar(); updateHeader();
}

// ===== CHAT HELPERS =====
function ensureChat(sid) {
  if (!sid) return null;
  if (chats.has(sid)) return chats.get(sid);
  const el = document.createElement('div');
  el.className = 'session-chat';
  el.dataset.session = sid;
  el.style.display = 'none';
  $('chat').appendChild(el);
  const c = { el, agentEl: null, agentBuf: '', thoughtEl: null, thoughtBuf: '', tools: new Map() };
  chats.set(sid, c);
  return c;
}
function showActiveChat() {
  document.querySelectorAll('.session-chat').forEach(el => {
    el.style.display = el.dataset.session === S.sid ? '' : 'none';
  });
  // Update send/cancel buttons for the active session's running state
  const activeRunning = runningSessions.has(S.sid);
  S.running = activeRunning;
  $('send-btn').hidden = activeRunning;
  $('cancel-btn').hidden = !activeRunning;
  scrollDown(true);
}
function appendMsg(sid, html) {
  const c = ensureChat(sid || S.sid);
  if (!c) return;
  const d = document.createElement('div');
  d.innerHTML = html;
  while (d.firstChild) c.el.appendChild(d.firstChild);
  scrollDown();
}
function addUserMsg(text, sid) {
  appendMsg(sid, `<div class="msg msg-user">${esc(text)}</div>`);
}
const runningSessions = new Set();
function setRunning(v, sid) {
  sid = sid || S.sid;
  if (v) runningSessions.add(sid); else runningSessions.delete(sid);
  // Only show cancel/hide send for the ACTIVE session
  const activeRunning = runningSessions.has(S.sid);
  S.running = activeRunning;
  $('send-btn').hidden = activeRunning;
  $('cancel-btn').hidden = !activeRunning;
  updateBadge(runningSessions.size > 0 ? 'running' : 'connected');
}
function updateBadge(status) {
  const b = $('status-badge');
  b.textContent = status;
  b.className = 'badge ' + ({connected:'ok',running:'ok',connecting:'warn',disconnected:'error',error:'error'}[status]||'');
  const dot = $('status-dot');
  dot.className = 'status-dot ' + ({connected:'ok',running:'ok',connecting:'connecting',disconnected:'error',error:'error'}[status]||'');
}

// ===== SIDEBAR =====
function sessionDateLabel(ts) {
  if (!ts) return 'Older';
  const now = new Date(), d = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate()-7);
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate()-30);
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'Previous 7 Days';
  if (d >= monthAgo) return 'Previous 30 Days';
  return d.toLocaleDateString(undefined, { year:'numeric', month:'long' });
}
function renderSidebar() {
  const list = $('sidebar-sessions');
  list.innerHTML = '';
  if (!S.sessions.length) { list.innerHTML = '<div class="sidebar-empty">No sessions yet</div>'; return; }
  const sorted = [...S.sessions].sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  let lastLabel = '';
  for (const s of sorted) {
    const label = sessionDateLabel(s.createdAt);
    if (label !== lastLabel) {
      lastLabel = label;
      const hdr = document.createElement('div');
      hdr.className = 'session-date-header';
      hdr.textContent = label;
      list.appendChild(hdr);
    }
    const div = document.createElement('div');
    div.className = 'session-item' + (s.sessionId === S.sid ? ' active' : '');
    div.innerHTML = `
      <div class="session-item-avatar">${icon('msg', 16)}</div>
      <div class="session-item-body">
        <div class="session-item-top">
          <span class="session-item-title">${esc(s.title||'Untitled')}</span>
        </div>
        <div class="session-item-subtitle">${esc(s.cwd||'')}</div>
        <div class="session-item-status"><span class="session-item-status-dot${s.busy?' running':''}"></span></div>
      </div>
      <button class="session-item-delete" title="Delete">${icon('x',12)}</button>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.closest('.session-item-delete')) return;
      if (s.sessionId !== S.sid) socket.emit('switch_session', { sessionId: s.sessionId });
      closeSidebar();
    });
    div.querySelector('.session-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (S.sessions.length <= 1) return;
      socket.emit('delete_session', { sessionId: s.sessionId });
    });
    // Double-click to rename
    const titleEl = div.querySelector('.session-item-title');
    titleEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'session-item-rename';
      input.value = s.title || '';
      titleEl.replaceWith(input);
      input.focus(); input.select();
      const finish = () => {
        const val = input.value.trim();
        if (val && val !== s.title) socket.emit('rename_session', { sessionId: s.sessionId, title: val });
        else renderSidebar();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); } if (ev.key === 'Escape') renderSidebar(); });
    });
    list.appendChild(div);
  }
}
function toggleSidebar() {
  $('sidebar').classList.toggle('open');
  $('sidebar-overlay').classList.toggle('visible');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('visible');
}

// ===== HEADER =====
function updateHeader() {
  const s = S.sessions.find(s => s.sessionId === S.sid);
  $('header-session-title').textContent = s?.title || 'Aether';
  $('cwd-display').textContent = s?.cwd || S.cwd || '';
}

// ===== MODELS & MODES =====
function renderModels() {
  const sel = $('model-select');
  sel.innerHTML = '';
  for (const m of S.models) {
    const o = document.createElement('option');
    o.value = m.id;
    const mult = m._meta?.copilotUsage;
    o.textContent = (m.name||m.id) + (mult != null ? ` (${String(mult).replace(/x$/,'')}x)` : '');
    sel.appendChild(o);
  }
  // Default to first model if current is empty or unknown
  if ((!S.currentModelId || !S.models.some(m => m.id === S.currentModelId)) && S.models.length) {
    S.currentModelId = S.models[0].id;
  }
  sel.value = S.currentModelId;
}
function renderModes() {
  const tabs = $('mode-tabs');
  tabs.innerHTML = '';
  for (const m of S.modes) {
    const btn = document.createElement('button');
    btn.className = 'mode-tab' + (m.id === S.currentModeId ? ' active' : '');
    btn.textContent = m.name || m.id;
    btn.onclick = () => socket.emit('set_mode', { modeId: m.id });
    tabs.appendChild(btn);
  }
}
function renderUsage(u) {
  if (!u) return;
  const parts = [];
  if (u.percentRemaining != null) parts.push(`Quota: ${u.percentRemaining}%`);
  if (u.premiumRequestsUsed != null || u.premiumRequestsLimit != null) {
    parts.push(`Premium: ${u.premiumRequestsUsed ?? '?'}/${u.premiumRequestsLimit ?? '?'}`);
  }
  if (u.contextSize != null) parts.push(`ctx: ${(u.contextSize/1000).toFixed(0)}k`);
  if (u.inputTokens != null) parts.push(`in: ${u.inputTokens}`);
  if (u.outputTokens != null) parts.push(`out: ${u.outputTokens}`);
  $('usage-display').textContent = parts.join(' · ');
}

// ===== SETTINGS =====
function toggleSettings() {
  const p = $('settings-panel');
  p.hidden = !p.hidden;
  if (!p.hidden) renderSettings();
}
function renderSettings() {
  const body = $('settings-body');
  body.innerHTML = '';
  for (const opt of S.configOptions) {
    const div = document.createElement('div');
    div.className = 'config-item';
    const label = `<span class="config-label">${esc(opt.name||opt.configId||'')}</span>`;
    if (opt.type === 'boolean') {
      div.innerHTML = `${label}<button class="config-toggle ${opt.value?'on':''}" data-id="${esc(opt.configId)}"></button>`;
      div.querySelector('.config-toggle').onclick = (e) => {
        const on = !e.target.classList.contains('on');
        e.target.classList.toggle('on', on);
        socket.emit('set_config_option', { configId: opt.configId, valueType: 'boolean', value: on });
      };
    } else if (opt.options?.length) {
      div.innerHTML = `${label}<select class="config-select">${(opt.options||[]).map(o=>`<option value="${esc(String(o.value||o))}" ${o.value===opt.value||o===opt.value?'selected':''}>${esc(String(o.name||o.value||o))}</option>`).join('')}</select>`;
      div.querySelector('select').onchange = (e) => socket.emit('set_config_option', { configId: opt.configId, value: e.target.value });
    }
    if (div.innerHTML) body.appendChild(div);
  }
  if (!body.children.length) body.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:8px 0">No configuration options available</div>';
}

// ===== PLAN =====
function renderPlan(d) {
  const panel = $('plan-panel');
  const body = $('plan-body');
  const entries = d.entries || [];
  if (!entries.length) { panel.hidden = true; return; }
  panel.hidden = false;
  body.innerHTML = entries.map(e => {
    const cls = e.status === 'completed' ? 'completed' : e.status === 'in_progress' ? 'in_progress' : '';
    const ic = e.status === 'completed' ? icon('check',14) : e.status === 'in_progress' ? icon('chevRight',14) : '<span style="width:14px;display:inline-block">-</span>';
    return `<div class="plan-entry ${cls}"><span class="plan-icon">${ic}</span><span>${esc(e.content||'')}</span></div>`;
  }).join('');
}

// ===== PERMISSION =====
function dismissPermission(requestId) {
  const queue = $('permission-queue');
  if (!queue) return;
  queue.querySelectorAll('.permission-card').forEach(card => {
    if (card.dataset.requestId === requestId) card.remove();
  });
  if (!queue.children.length) $('permission-overlay').hidden = true;
}
function showPermission(d) {
  const overlay = $('permission-overlay');
  const queue = $('permission-queue');
  overlay.hidden = false;
  const card = document.createElement('div');
  card.className = 'permission-card';
  card.dataset.requestId = d.requestId;
  let detail = '';
  if (d.toolCall) {
    const raw = d.toolCall.rawInput || d.toolCall.content?.map(c=>c.text||'').join('\n') || '';
    if (raw) detail = `<div class="perm-detail">${esc(raw)}</div>`;
  }
  const opts = (d.options||[]).map(o => {
    const cls = o.kind?.includes('allow') ? 'allow' : o.kind?.includes('deny') ? 'reject' : '';
    return `<button class="perm-btn ${cls}" data-oid="${o.optionId}">${esc(o.name)}</button>`;
  }).join('');
  card.innerHTML = `
    <div class="perm-title">${icon('lock')} ${esc(d.title||d.toolCall?.title||'Permission Required')}</div>
    ${detail}
    <div class="perm-options">${opts}</div>
    <div class="perm-feedback"><input type="text" placeholder="Reject with feedback..."/><button>Reject</button></div>
  `;
  const finish = () => { card.remove(); if (!queue.children.length) overlay.hidden = true; };
  card.querySelectorAll('.perm-btn').forEach(btn => {
    btn.onclick = () => { socket.emit('permission_response', { requestId: d.requestId, optionId: btn.dataset.oid, sessionId: d.sessionId }); finish(); };
  });
  const fbBtn = card.querySelector('.perm-feedback button');
  const fbIn = card.querySelector('.perm-feedback input');
  fbBtn.onclick = () => { socket.emit('permission_response', { requestId: d.requestId, sessionId: d.sessionId, feedback: fbIn.value }); finish(); };
  queue.appendChild(card);
}

// ===== COMMAND PALETTE =====
function updateCommandPalette(text) {
  const pal = $('command-palette');
  const list = $('command-list');
  if (!text.startsWith('/') || text.includes(' ') || !S.commands.length) { pal.hidden = true; return; }
  const q = text.slice(1).toLowerCase();
  const matches = S.commands.filter(c => !q || c.name.toLowerCase().includes(q));
  if (!matches.length) { pal.hidden = true; return; }
  pal.hidden = false;
  list.innerHTML = matches.map(c => `<div class="cmd-item" data-cmd="${esc(c.name)}"><span class="cmd-name">/${esc(c.name)}</span><span class="cmd-desc">${esc(c.description||'')}</span></div>`).join('');
  list.querySelectorAll('.cmd-item').forEach(el => {
    el.onclick = () => { $('prompt').value = '/' + el.dataset.cmd + ' '; pal.hidden = true; $('prompt').focus(); };
  });
}

// ===== FILE BROWSER =====
let fbPath = '';
function openFileBrowser(initial) {
  fbPath = initial || S.cwd || '/home';
  $('file-browser-dialog').hidden = false;
  socket.emit('browse_dir', { path: fbPath }, renderDirListing);
}
function renderDirListing(d) {
  fbPath = d.path || fbPath;
  $('file-browser-path').textContent = fbPath;
  const list = $('file-browser-list');
  list.innerHTML = '';
  // Parent
  const parent = document.createElement('div');
  parent.className = 'file-item';
  parent.innerHTML = `${icon('up',16)} <span class="file-item-name">..</span>`;
  parent.onclick = () => { const p = fbPath.replace(/\/[^/]+\/?$/, '') || '/'; socket.emit('browse_dir', { path: p }, renderDirListing); };
  list.appendChild(parent);
  for (const e of (d.entries||[])) {
    const div = document.createElement('div');
    div.className = 'file-item';
    const sz = e.size != null ? `<span class="file-item-size">${fmtSize(e.size)}</span>` : '';
    div.innerHTML = `${icon(e.type === 'directory' ? 'folder' : 'file', 16)} <span class="file-item-name">${esc(e.name)}</span>${sz}`;
    if (e.type === 'directory') {
      div.onclick = () => socket.emit('browse_dir', { path: fbPath + '/' + e.name }, renderDirListing);
    }
    list.appendChild(div);
  }
  if (d.error) list.innerHTML += `<div style="color:var(--red);padding:8px;font-size:13px">${esc(d.error)}</div>`;
}

// ===== ATTACHMENTS =====
function handleFileInput(e) {
  const MAX_ATTACHMENTS = 10;
  for (const file of Array.from(e.target.files)) {
    if (S.attachments.length >= MAX_ATTACHMENTS) break;
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 10 * 1024 * 1024) continue;
    const reader = new FileReader();
    reader.onload = () => {
      S.attachments.push({ type: 'image', name: file.name, mimeType: file.type, data: reader.result.split(',')[1], preview: reader.result });
      renderAttachments();
    };
    reader.readAsDataURL(file);
  }
  e.target.value = '';
}
function renderAttachments() {
  const area = $('input-attachments');
  if (!S.attachments.length) { area.hidden = true; area.innerHTML = ''; return; }
  area.hidden = false;
  area.innerHTML = S.attachments.map((a, i) => `
    <div class="input-attach-item"><img src="${a.preview}" alt="${esc(a.name)}"/><button class="input-attach-remove" data-idx="${i}">${icon('x',10)}</button></div>
  `).join('');
  area.querySelectorAll('.input-attach-remove').forEach(btn => {
    btn.onclick = () => { S.attachments.splice(Number(btn.dataset.idx), 1); renderAttachments(); };
  });
}

// ===== INPUT =====
function handleSend() {
  const text = $('prompt').value.trim();
  if (!text && !S.attachments.length) return;
  if (!socket?.connected) return;
  addUserMsg(text, S.sid);
  const att = S.attachments.map(a => ({ type: a.type, data: a.data, mimeType: a.mimeType }));
  socket.emit('prompt', { sessionId: S.sid, text, attachments: att });
  $('prompt').value = '';
  $('prompt').style.height = 'auto';
  S.attachments = [];
  renderAttachments();
  $('command-palette').hidden = true;
  scrollDown(true);
}
function handleCancel() {
  if (socket) socket.emit('cancel', { sessionId: S.sid });
}

// ===== NEW SESSION =====
function openNewSession() {
  $('new-session-cwd').value = S.cwd || '';
  $('new-session-title').value = '';
  $('new-session-dialog').hidden = false;
}
function createNewSession() {
  const cwd = $('new-session-cwd').value.trim() || S.cwd;
  const title = $('new-session-title').value.trim();
  socket.emit('create_session', { cwd, title: title || undefined });
  $('new-session-dialog').hidden = true;
}

// ===== INIT =====
function init() {
  initTheme();

  // Set icons on buttons
  $('hamburger-btn').innerHTML = icon('menu');
  $('theme-btn').innerHTML = icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'moon' : 'sun');
  $('settings-btn').innerHTML = icon('settings');
  $('session-add-btn').innerHTML = icon('plus');
  $('logout-btn').innerHTML = `${icon('logout',14)} Logout`;
  $('attach-btn').innerHTML = icon('attach');
  $('send-btn').innerHTML = icon('send');
  $('cancel-btn').innerHTML = icon('stop');
  $('cwd-browse').innerHTML = icon('folder', 14);
  $('file-browser-close').innerHTML = icon('x');
  $('settings-close').innerHTML = icon('x');
  $('plan-toggle').innerHTML = icon('chevDown');

  // Event listeners
  $('auth-form').addEventListener('submit', doAuth);
  $('hamburger-btn').onclick = toggleSidebar;
  $('sidebar-overlay').onclick = closeSidebar;
  $('theme-btn').onclick = toggleTheme;
  $('settings-btn').onclick = toggleSettings;
  $('settings-close').onclick = () => $('settings-panel').hidden = true;
  $('session-add-btn').onclick = openNewSession;
  $('new-session-cancel').onclick = () => $('new-session-dialog').hidden = true;
  $('new-session-create').onclick = createNewSession;
  $('send-btn').onclick = handleSend;
  $('cancel-btn').onclick = handleCancel;
  $('attach-btn').onclick = () => $('file-input').click();
  $('file-input').onchange = handleFileInput;
  $('cwd-browse').onclick = () => openFileBrowser(S.cwd);
  $('file-browser-close').onclick = () => $('file-browser-dialog').hidden = true;
  $('file-browser-cancel').onclick = () => $('file-browser-dialog').hidden = true;
  $('file-browser-select').onclick = () => {
    $('file-browser-dialog').hidden = true;
    if (fbPath) {
      S.cwd = fbPath;
      $('cwd-display').textContent = fbPath;
    }
  };
  $('plan-toggle').onclick = () => {
    const body = $('plan-body');
    body.style.display = body.style.display === 'none' ? '' : 'none';
    $('plan-toggle').innerHTML = icon(body.style.display === 'none' ? 'chevRight' : 'chevDown');
  };
  $('model-select').onchange = (e) => { if (socket) socket.emit('set_model', { sessionId: S.sid, modelId: e.target.value }); };
  $('yolo-select').onchange = (e) => { if (socket) socket.emit('set_yolo', { sessionId: S.sid, level: Number(e.target.value) }); };
  $('logout-btn').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + S.token } }).catch(() => {});
    S.token = null; localStorage.removeItem('aether-token'); localStorage.removeItem('aether-workspace');
    if (socket) { socket.disconnect(); socket = null; }
    location.reload();
  };

  // Textarea
  const prompt = $('prompt');
  prompt.addEventListener('input', () => {
    prompt.style.height = 'auto';
    prompt.style.height = Math.min(prompt.scrollHeight, 120) + 'px';
    updateCommandPalette(prompt.value);
  });
  prompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend(); }
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth <= 768) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') $('command-palette').hidden = true;
  });

  checkAuth();
  initScrollBtn();
}

window.addEventListener('DOMContentLoaded', init);
