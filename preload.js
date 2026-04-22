const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sshAPI', {
  // Server CRUD
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServer: (server) => ipcRenderer.invoke('save-server', server),
  deleteServer: (id) => ipcRenderer.invoke('delete-server', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // SSH
  connect: (config) => ipcRenderer.invoke('ssh-connect', config),
  sendInput: (id, data) => ipcRenderer.send('ssh-input', { id, data }),
  resize: (id, cols, rows) => ipcRenderer.send('ssh-resize', { id, cols, rows }),
  disconnect: (id) => ipcRenderer.send('ssh-disconnect', { id }),

  // Listeners
  onData: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('ssh-data', handler);
    return () => ipcRenderer.removeListener('ssh-data', handler);
  },
  onClosed: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('ssh-closed', handler);
    return () => ipcRenderer.removeListener('ssh-closed', handler);
  },
});
