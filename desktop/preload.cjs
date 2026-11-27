const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avlDesktop', {
  isDesktop: true,
  platform: process.platform,
  ispfy: {
    show: (bounds) => ipcRenderer.invoke('ispfy:show', bounds),
    setBounds: (bounds) => ipcRenderer.invoke('ispfy:setBounds', bounds),
    hide: () => ipcRenderer.invoke('ispfy:hide'),
    reload: () => ipcRenderer.invoke('ispfy:reload'),
    goBack: () => ipcRenderer.invoke('ispfy:goBack'),
    goForward: () => ipcRenderer.invoke('ispfy:goForward'),
    goHome: () => ipcRenderer.invoke('ispfy:goHome'),
    destroy: () => ipcRenderer.invoke('ispfy:destroy'),
    getState: () => ipcRenderer.invoke('ispfy:getState'),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('ispfy:state', listener);
      return () => ipcRenderer.removeListener('ispfy:state', listener);
    },
    onError: (callback) => {
      const listener = (_event, err) => callback(err);
      ipcRenderer.on('ispfy:error', listener);
      return () => ipcRenderer.removeListener('ispfy:error', listener);
    },
    onRequestSync: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('ispfy:requestSync', listener);
      return () => ipcRenderer.removeListener('ispfy:requestSync', listener);
    },
  },
});
