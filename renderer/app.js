/* ══════════════════════════════════════════════════════════════
   SSH Manager — Renderer Application (ESM-free, loaded via script tags)
   xterm is loaded globally via UMD bundles in index.html
   ══════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────
let servers = [];
const tabs = new Map();
let activeTabId = null;
let currentSettings = null;

// ─── Theme Presets ──────────────────────────────────────────────
const THEME_PRESETS = [
  {
    name: 'GitHub Dark',
    theme: { background:'#0d1117', foreground:'#e6edf3', cursor:'#58a6ff', black:'#484f58', red:'#ff7b72', green:'#3fb950', yellow:'#d29922', blue:'#58a6ff', magenta:'#d2a8ff', cyan:'#39d353', white:'#e6edf3', brightBlack:'#6e7681', brightRed:'#ffa198', brightGreen:'#56d364', brightYellow:'#e3b341', brightBlue:'#79c0ff', brightMagenta:'#d2a8ff', brightCyan:'#56d364', brightWhite:'#ffffff', selectionBackground:'rgba(88,166,255,0.25)' }
  },
  {
    name: 'Monokai',
    theme: { background:'#272822', foreground:'#f8f8f2', cursor:'#f8f8f0', black:'#272822', red:'#f92672', green:'#a6e22e', yellow:'#f4bf75', blue:'#66d9ef', magenta:'#ae81ff', cyan:'#a1efe4', white:'#f8f8f2', brightBlack:'#75715e', brightRed:'#f92672', brightGreen:'#a6e22e', brightYellow:'#f4bf75', brightBlue:'#66d9ef', brightMagenta:'#ae81ff', brightCyan:'#a1efe4', brightWhite:'#f9f8f5', selectionBackground:'rgba(166,226,46,0.2)' }
  },
  {
    name: 'Dracula',
    theme: { background:'#282a36', foreground:'#f8f8f2', cursor:'#f8f8f2', black:'#21222c', red:'#ff5555', green:'#50fa7b', yellow:'#f1fa8c', blue:'#bd93f9', magenta:'#ff79c6', cyan:'#8be9fd', white:'#f8f8f2', brightBlack:'#6272a4', brightRed:'#ff6e6e', brightGreen:'#69ff94', brightYellow:'#ffffa5', brightBlue:'#d6acff', brightMagenta:'#ff92df', brightCyan:'#a4ffff', brightWhite:'#ffffff', selectionBackground:'rgba(189,147,249,0.3)' }
  },
  {
    name: 'Nord',
    theme: { background:'#2e3440', foreground:'#d8dee9', cursor:'#d8dee9', black:'#3b4252', red:'#bf616a', green:'#a3be8c', yellow:'#ebcb8b', blue:'#81a1c1', magenta:'#b48ead', cyan:'#88c0d0', white:'#e5e9f0', brightBlack:'#4c566a', brightRed:'#bf616a', brightGreen:'#a3be8c', brightYellow:'#ebcb8b', brightBlue:'#81a1c1', brightMagenta:'#b48ead', brightCyan:'#8fbcbb', brightWhite:'#eceff4', selectionBackground:'rgba(136,192,208,0.2)' }
  },
  {
    name: 'Solarized',
    theme: { background:'#002b36', foreground:'#839496', cursor:'#839496', black:'#073642', red:'#dc322f', green:'#859900', yellow:'#b58900', blue:'#268bd2', magenta:'#d33682', cyan:'#2aa198', white:'#eee8d5', brightBlack:'#586e75', brightRed:'#cb4b16', brightGreen:'#586e75', brightYellow:'#657b83', brightBlue:'#839496', brightMagenta:'#6c71c4', brightCyan:'#93a1a1', brightWhite:'#fdf6e3', selectionBackground:'rgba(38,139,210,0.3)' }
  },
  {
    name: 'One Dark',
    theme: { background:'#282c34', foreground:'#abb2bf', cursor:'#528bff', black:'#5c6370', red:'#e06c75', green:'#98c379', yellow:'#e5c07b', blue:'#61afef', magenta:'#c678dd', cyan:'#56b6c2', white:'#abb2bf', brightBlack:'#4b5263', brightRed:'#be5046', brightGreen:'#98c379', brightYellow:'#d19a66', brightBlue:'#61afef', brightMagenta:'#c678dd', brightCyan:'#56b6c2', brightWhite:'#ffffff', selectionBackground:'rgba(97,175,239,0.2)' }
  },
];

// ─── DOM refs ───────────────────────────────────────────────────
const $serverList = document.getElementById('server-list');
const $tabBar     = document.getElementById('tab-bar');
const $termCont   = document.getElementById('terminal-container');
const $welcome    = document.getElementById('welcome');
const $modal      = document.getElementById('modal-overlay');
const $form       = document.getElementById('server-form');
const $modalTitle = document.getElementById('modal-title');
const $btnAdd     = document.getElementById('btn-add');
const $btnCancel  = document.getElementById('btn-cancel');
const $fAuth      = document.getElementById('f-auth');

// ─── Toast ──────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ─── Servers Rendering ──────────────────────────────────────────
async function loadServers() {
  servers = await window.sshAPI.getServers();
  renderServerList();
}

function renderServerList() {
  $serverList.innerHTML = '';
  servers.forEach(s => {
    const li = document.createElement('li');
    li.className = 'server-item' + (tabs.has(s.id) && activeTabId === s.id ? ' active' : '');
    li.innerHTML = `
      <span class="server-dot ${tabs.has(s.id) ? 'connected' : ''}"></span>
      <div class="server-info">
        <div class="server-name">${esc(s.name)}</div>
        <div class="server-host">${esc(s.username)}@${esc(s.host)}:${s.port || 22}</div>
      </div>
      <div class="server-actions">
        <button class="btn-edit" title="编辑">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-delete" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    li.addEventListener('dblclick', () => connectServer(s));
    li.addEventListener('click', () => { if (tabs.has(s.id)) switchTab(s.id); });
    li.querySelector('.btn-edit').addEventListener('click', (e) => { e.stopPropagation(); openModal(s); });
    li.querySelector('.btn-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteServer(s); });
    $serverList.appendChild(li);
  });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ─── Server CRUD ────────────────────────────────────────────────
function openModal(server = null) {
  $modalTitle.textContent = server ? '编辑服务器' : '添加服务器';
  document.getElementById('f-id').value   = server?.id || '';
  document.getElementById('f-name').value = server?.name || '';
  document.getElementById('f-host').value = server?.host || '';
  document.getElementById('f-port').value = server?.port || 22;
  document.getElementById('f-user').value = server?.username || '';
  document.getElementById('f-auth').value = server?.authType || 'password';
  document.getElementById('f-pass').value = server?.password || '';
  document.getElementById('f-key').value  = server?.privateKey || '';
  toggleAuthFields();
  $modal.classList.remove('hidden');
  document.getElementById('f-name').focus();
}

function closeModal() {
  $modal.classList.add('hidden');
  $form.reset();
}

function toggleAuthFields() {
  const isKey = $fAuth.value === 'key';
  document.getElementById('lbl-pass').classList.toggle('hidden', isKey);
  document.getElementById('f-pass').classList.toggle('hidden', isKey);
  document.getElementById('lbl-key').classList.toggle('hidden', !isKey);
  document.getElementById('f-key').classList.toggle('hidden', !isKey);
}

$fAuth.addEventListener('change', toggleAuthFields);
$btnAdd.addEventListener('click', () => openModal());
$btnCancel.addEventListener('click', closeModal);
$modal.addEventListener('click', (e) => { if (e.target === $modal) closeModal(); });

$form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const server = {
    id:         document.getElementById('f-id').value || crypto.randomUUID(),
    name:       document.getElementById('f-name').value.trim(),
    host:       document.getElementById('f-host').value.trim(),
    port:       parseInt(document.getElementById('f-port').value) || 22,
    username:   document.getElementById('f-user').value.trim(),
    authType:   document.getElementById('f-auth').value,
    password:   document.getElementById('f-pass').value,
    privateKey: document.getElementById('f-key').value,
  };
  servers = await window.sshAPI.saveServer(server);
  renderServerList();
  closeModal();
  toast(`已保存 "${server.name}"`, 'success');
});

async function deleteServer(server) {
  if (tabs.has(server.id)) closeTab(server.id);
  servers = await window.sshAPI.deleteServer(server.id);
  renderServerList();
  toast(`已删除 "${server.name}"`, 'info');
}

// ─── SSH Connection ─────────────────────────────────────────────
async function connectServer(server) {
  if (tabs.has(server.id)) { switchTab(server.id); return; }

  toast(`正在连接 ${server.name}...`, 'info');

  try {
    await window.sshAPI.connect({
      id:         server.id,
      host:       server.host,
      port:       server.port || 22,
      username:   server.username,
      authType:   server.authType,
      password:   server.password,
      privateKey: server.privateKey,
    });
    createTerminalTab(server);
    toast(`已连接 ${server.name}`, 'success');
  } catch (err) {
    // Strip Electron IPC wrapper: "Error: Error invoking remote method 'xxx': actual message"
    let msg = String(err);
    const match = msg.match(/Error invoking remote method '[^']+': (.+)/);
    if (match) msg = match[1];
    toast(`连接失败：${msg}`, 'error');
  }
}

// ─── Terminal / Tabs ────────────────────────────────────────────
function createTerminalTab(server) {
  const id = server.id;

  // xterm globals loaded via script tags
  const s = currentSettings || getDefaultSettings();
  const term = new Terminal({
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    lineHeight: 1.3,
    cursorBlink: true,
    cursorStyle: 'bar',
    theme: buildThemeFromSettings(s),
  });

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon.WebLinksAddon());

  const panel = document.createElement('div');
  panel.className = 'terminal-panel';
  panel.id = `term-${id}`;
  $termCont.appendChild(panel);

  term.open(panel);
  fitAddon.fit();

  term.onData((data) => window.sshAPI.sendInput(id, data));

  const removeData = window.sshAPI.onData(({ id: sid, data }) => {
    if (sid === id) term.write(data);
  });

  const removeClosed = window.sshAPI.onClosed(({ id: sid }) => {
    if (sid === id) {
      term.write('\r\n\x1b[31m>>> 连接已关闭 <<<\x1b[0m\r\n');
      const tabDot = document.querySelector(`.tab[data-id="${id}"] .tab-dot`);
      if (tabDot) tabDot.classList.add('disconnected');
      renderServerList();
    }
  });

  const resizeObs = new ResizeObserver(() => {
    fitAddon.fit();
    window.sshAPI.resize(id, term.cols, term.rows);
  });
  resizeObs.observe(panel);

  tabs.set(id, { term, fitAddon, panel, resizeObs, removeData, removeClosed, server });

  addTabElement(server);
  switchTab(id);
  renderServerList();

  setTimeout(() => {
    fitAddon.fit();
    window.sshAPI.resize(id, term.cols, term.rows);
  }, 100);
}

function addTabElement(server) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.id = server.id;
  tab.innerHTML = `
    <span class="tab-dot"></span>
    <span class="tab-label">${esc(server.name)}</span>
    <button class="tab-close" title="关闭">×</button>
  `;
  tab.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-close')) switchTab(server.id);
  });
  tab.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(server.id);
  });
  $tabBar.appendChild(tab);
}

function switchTab(id) {
  activeTabId = id;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.id === id));
  document.querySelectorAll('.terminal-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`term-${id}`);
  if (panel) panel.classList.add('active');
  $welcome.style.display = 'none';

  const tabInfo = tabs.get(id);
  if (tabInfo) {
    setTimeout(() => { tabInfo.fitAddon.fit(); tabInfo.term.focus(); }, 50);
  }
  renderServerList();
}

function closeTab(id) {
  const tabInfo = tabs.get(id);
  if (!tabInfo) return;

  tabInfo.removeData();
  tabInfo.removeClosed();
  tabInfo.resizeObs.disconnect();
  tabInfo.term.dispose();
  tabInfo.panel.remove();
  window.sshAPI.disconnect(id);
  document.querySelector(`.tab[data-id="${id}"]`)?.remove();
  tabs.delete(id);

  if (tabs.size > 0) {
    switchTab([...tabs.keys()].pop());
  } else {
    activeTabId = null;
    $welcome.style.display = '';
  }
  renderServerList();
}

// ─── Keyboard shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
    e.preventDefault();
    if (activeTabId) closeTab(activeTabId);
  }
  if (e.key === 'Escape') {
    if (!$modal.classList.contains('hidden')) closeModal();
    if (!$settingsOverlay.classList.contains('hidden')) closeSettings();
  }
});

// ─── Settings ───────────────────────────────────────────────────
const $settingsOverlay = document.getElementById('settings-overlay');
const $btnSettings     = document.getElementById('btn-settings');
const $btnSettingsSave = document.getElementById('btn-settings-save');
const $btnSettingsCancel = document.getElementById('btn-settings-cancel');
const $themePresets    = document.getElementById('theme-presets');
const $fontSize        = document.getElementById('s-fontsize');
const $fontSizeVal     = document.getElementById('s-fontsize-val');

function getDefaultSettings() {
  return {
    theme: { ...THEME_PRESETS[0].theme },
    themeName: 'GitHub Dark',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Menlo', 'Consolas', monospace"
  };
}

function buildThemeFromSettings(s) {
  return {
    background:  s.theme.background,
    foreground:  s.theme.foreground,
    cursor:      s.theme.cursor,
    cursorAccent: s.theme.background,
    selectionBackground: s.theme.selectionBackground || 'rgba(88,166,255,0.25)',
    black:       s.theme.black,
    red:         s.theme.red,
    green:       s.theme.green,
    yellow:      s.theme.yellow,
    blue:        s.theme.blue,
    magenta:     s.theme.magenta,
    cyan:        s.theme.cyan,
    white:       s.theme.white,
    brightBlack: s.theme.brightBlack,
    brightRed:   s.theme.brightRed,
    brightGreen: s.theme.brightGreen,
    brightYellow:s.theme.brightYellow,
    brightBlue:  s.theme.brightBlue,
    brightMagenta:s.theme.brightMagenta,
    brightCyan:  s.theme.brightCyan,
    brightWhite: s.theme.brightWhite,
  };
}

function applySettingsToAllTerminals() {
  if (!currentSettings) return;
  const theme = buildThemeFromSettings(currentSettings);
  tabs.forEach(({ term, fitAddon }) => {
    term.options.theme = theme;
    term.options.fontSize = currentSettings.fontSize;
    term.options.fontFamily = currentSettings.fontFamily;
    fitAddon.fit();
  });
}

function renderThemePresets() {
  $themePresets.innerHTML = '';
  THEME_PRESETS.forEach(preset => {
    const div = document.createElement('div');
    div.className = 'theme-preset' + (currentSettings?.themeName === preset.name ? ' active' : '');
    div.innerHTML = `
      <div class="theme-preset-preview" style="background:${preset.theme.background};color:${preset.theme.foreground}">$ ls</div>
      <span>${preset.name}</span>
    `;
    div.addEventListener('click', () => {
      currentSettings.themeName = preset.name;
      currentSettings.theme = { ...preset.theme };
      fillSettingsForm();
      renderThemePresets();
    });
    $themePresets.appendChild(div);
  });
}

function fillSettingsForm() {
  if (!currentSettings) return;
  document.getElementById('s-bg').value = currentSettings.theme.background;
  document.getElementById('s-fg').value = currentSettings.theme.foreground;
  document.getElementById('s-cursor').value = currentSettings.theme.cursor;
  document.getElementById('s-green').value = currentSettings.theme.green;
  document.getElementById('s-red').value = currentSettings.theme.red;
  document.getElementById('s-yellow').value = currentSettings.theme.yellow;
  document.getElementById('s-blue').value = currentSettings.theme.blue;
  document.getElementById('s-magenta').value = currentSettings.theme.magenta;
  document.getElementById('s-cyan').value = currentSettings.theme.cyan;
  $fontSize.value = currentSettings.fontSize;
  $fontSizeVal.textContent = currentSettings.fontSize + 'px';
}

function readSettingsForm() {
  currentSettings.theme.background = document.getElementById('s-bg').value;
  currentSettings.theme.foreground = document.getElementById('s-fg').value;
  currentSettings.theme.cursor = document.getElementById('s-cursor').value;
  currentSettings.theme.green = document.getElementById('s-green').value;
  currentSettings.theme.red = document.getElementById('s-red').value;
  currentSettings.theme.yellow = document.getElementById('s-yellow').value;
  currentSettings.theme.blue = document.getElementById('s-blue').value;
  currentSettings.theme.magenta = document.getElementById('s-magenta').value;
  currentSettings.theme.cyan = document.getElementById('s-cyan').value;
  currentSettings.fontSize = parseInt($fontSize.value);
  // Check if colors match a preset
  const match = THEME_PRESETS.find(p =>
    p.theme.background === currentSettings.theme.background &&
    p.theme.foreground === currentSettings.theme.foreground
  );
  currentSettings.themeName = match ? match.name : 'Custom';
}

function openSettings() {
  fillSettingsForm();
  renderThemePresets();
  $settingsOverlay.classList.remove('hidden');
}

function closeSettings() {
  $settingsOverlay.classList.add('hidden');
}

$btnSettings.addEventListener('click', openSettings);
$btnSettingsCancel.addEventListener('click', closeSettings);
$settingsOverlay.addEventListener('click', (e) => { if (e.target === $settingsOverlay) closeSettings(); });

$fontSize.addEventListener('input', () => {
  $fontSizeVal.textContent = $fontSize.value + 'px';
});

$btnSettingsSave.addEventListener('click', async () => {
  readSettingsForm();
  applySettingsToAllTerminals();
  await window.sshAPI.saveSettings(currentSettings);
  closeSettings();
  toast('主题已应用', 'success');
});

async function loadSettings() {
  const saved = await window.sshAPI.getSettings();
  if (saved && saved.theme) {
    currentSettings = saved;
    // Ensure themeName exists
    if (!currentSettings.themeName) currentSettings.themeName = 'Custom';
  } else {
    currentSettings = getDefaultSettings();
  }
}

// ─── Init ───────────────────────────────────────────────────────
async function init() {
  await loadSettings();
  await loadServers();
}
init();
