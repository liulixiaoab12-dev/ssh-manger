const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client } = require('ssh2');

// ─── Data Persistence ──────────────────────────────────────────────
// Use userData dir (~/Library/Application Support/ssh-manager/) for writable storage
// The .app bundle is read-only on macOS
function getDataDir() {
  return path.join(app.getPath('userData'), 'data');
}

function ensureDataDir() {
  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  // Migrate bundled data on first launch
  const bundledDir = path.join(__dirname, 'data');
  for (const file of ['servers.json', 'settings.json']) {
    const target = path.join(dataDir, file);
    const source = path.join(bundledDir, file);
    if (!fs.existsSync(target) && fs.existsSync(source)) {
      fs.copyFileSync(source, target);
    }
  }
}

function getDataPath(filename) {
  return path.join(getDataDir(), filename);
}

function loadServers() {
  try {
    return JSON.parse(fs.readFileSync(getDataPath('servers.json'), 'utf-8'));
  } catch {
    return [];
  }
}

function saveServers(servers) {
  const p = getDataPath('servers.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(servers, null, 2));
}

// ─── Window ────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'SSH Manager',
    backgroundColor: '#0d1117',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  ensureDataDir();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── IPC: Server CRUD ──────────────────────────────────────────────
ipcMain.handle('get-servers', () => loadServers());

ipcMain.handle('save-server', (_e, server) => {
  const servers = loadServers();
  const idx = servers.findIndex(s => s.id === server.id);
  if (idx >= 0) servers[idx] = server;
  else servers.push(server);
  saveServers(servers);
  return servers;
});

ipcMain.handle('delete-server', (_e, id) => {
  let servers = loadServers();
  servers = servers.filter(s => s.id !== id);
  saveServers(servers);
  return servers;
});

// ─── IPC: Settings ─────────────────────────────────────────────────
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(getDataPath('settings.json'), 'utf-8'));
  } catch {
    return null;
  }
}

function saveSettings(settings) {
  const p = getDataPath('settings.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2));
}

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_e, settings) => {
  saveSettings(settings);
  return settings;
});

// ─── IPC: SSH Connection ────────────────────────────────────────────
const sshSessions = new Map();

function translateSSHError(msg) {
  if (!msg) return '未知错误';
  if (msg.includes('All configured authentication methods failed'))
    return '认证失败：用户名或密码错误';
  if (msg.includes('Authentication failed'))
    return '认证失败：用户名或密码错误';
  if (msg.includes('Connection lost before handshake'))
    return '连接中断：SSH 握手前连接丢失，请检查服务器地址和端口';
  if (msg.includes('EHOSTUNREACH'))
    return '主机不可达：无法访问该 IP 地址，请检查网络';
  if (msg.includes('ECONNREFUSED'))
    return '连接被拒绝：目标端口未开放或 SSH 服务未运行';
  if (msg.includes('ETIMEDOUT'))
    return '连接超时：服务器无响应，请检查 IP 和端口是否正确';
  if (msg.includes('ECONNRESET'))
    return '连接被重置：服务器断开了连接';
  if (msg.includes('ENOTFOUND'))
    return '域名解析失败：无法解析主机名';
  if (msg.includes('handshake'))
    return 'SSH 握手失败：可能是算法不兼容';
  if (msg.includes('Timed out'))
    return '连接超时：30 秒内未能建立连接';
  if (msg.includes('Invalid key') || msg.includes('key format'))
    return '密钥格式错误：请检查私钥内容';
  if (msg.includes('Encrypted private key'))
    return '私钥需要密码解密，暂不支持加密私钥';
  return msg;
}

ipcMain.handle('ssh-connect', (_e, { id, host, port, username, authType, password, privateKey }) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const connectConfig = {
      host,
      port: port || 22,
      username,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
    };

    if (authType === 'key' && privateKey) {
      connectConfig.privateKey = privateKey;
    } else {
      connectConfig.password = password;
      connectConfig.tryKeyboard = true;
    }

    conn.on('keyboard-interactive', (_name, _instructions, _instructionsLang, prompts, finish) => {
      finish(prompts.map(() => password));
    });

    conn.on('ready', () => {
      conn.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, stream) => {
        if (err) { conn.end(); return reject(translateSSHError(err.message)); }

        sshSessions.set(id, { conn, stream });

        stream.on('data', (data) => {
          mainWindow?.webContents.send('ssh-data', { id, data: data.toString('utf-8') });
        });
        stream.stderr?.on('data', (data) => {
          mainWindow?.webContents.send('ssh-data', { id, data: data.toString('utf-8') });
        });
        stream.on('close', () => {
          sshSessions.delete(id);
          mainWindow?.webContents.send('ssh-closed', { id });
        });

        resolve(true);
      });
    });

    conn.on('error', (err) => reject(translateSSHError(err.message)));
    conn.connect(connectConfig);
  });
});

ipcMain.on('ssh-input', (_e, { id, data }) => {
  const session = sshSessions.get(id);
  if (session?.stream) session.stream.write(data);
});

ipcMain.on('ssh-resize', (_e, { id, cols, rows }) => {
  const session = sshSessions.get(id);
  if (session?.stream) session.stream.setWindow(rows, cols, 0, 0);
});

ipcMain.on('ssh-disconnect', (_e, { id }) => {
  const session = sshSessions.get(id);
  if (session) {
    session.stream?.close();
    session.conn?.end();
    sshSessions.delete(id);
  }
});
