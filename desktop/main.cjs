const { app, BrowserWindow, WebContentsView, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const ISPFY_URL = 'https://avltelecom.ispfycloud.com.br:8443/';
const ISPFY_HOST = 'avltelecom.ispfycloud.com.br';
const PROD_APP_URL = 'https://app-avl-telecom.vercel.app/';
const DEV_APP_URL = 'http://localhost:8080/';

const isDevFlag = process.argv.includes('--dev') || process.env.AVL_DESKTOP_DEV === '1';
const startUrl = process.env.AVL_DESKTOP_URL || (isDevFlag ? DEV_APP_URL : PROD_APP_URL);

let mainWindow = null;
let ispfyView = null;
let ispfyVisible = false;
let lastBounds = { x: 0, y: 0, width: 0, height: 0 };

// Evita múltiplas instâncias duplicadas
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

// Confia no certificado SSL da porta :8443 EXCLUSIVAMENTE para o host oficial do ISPFY da AVL
app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === ISPFY_HOST) {
      event.preventDefault();
      callback(true);
      return;
    }
  } catch {
    // URL inválida
  }
  callback(false);
});

function sendIspfyState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!ispfyView) {
    mainWindow.webContents.send('ispfy:state', {
      mounted: false,
      visible: false,
      loading: false,
      url: ISPFY_URL,
      canGoBack: false,
      canGoForward: false,
    });
    return;
  }

  const wc = ispfyView.webContents;
  mainWindow.webContents.send('ispfy:state', {
    mounted: true,
    visible: ispfyVisible,
    loading: wc.isLoading(),
    url: wc.getURL() || ISPFY_URL,
    canGoBack: wc.navigationHistory ? wc.navigationHistory.canGoBack() : wc.canGoBack(),
    canGoForward: wc.navigationHistory ? wc.navigationHistory.canGoForward() : wc.canGoForward(),
  });
}

function ensureIspfyView() {
  if (ispfyView || !mainWindow || mainWindow.isDestroyed()) return ispfyView;

  ispfyView = new WebContentsView({
    webPreferences: {
      partition: 'persist:avl_ispfy',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.contentView.addChildView(ispfyView);
  ispfyView.setVisible(false);

  const wc = ispfyView.webContents;

  // Permite popups internos do ISPFY (boletos, PDFs, impressões) com a mesma sessão logada
  wc.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === ISPFY_HOST) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 1120,
            height: 760,
            autoHideMenuBar: true,
            title: 'ISPFY — AVL Telecom',
            webPreferences: {
              partition: 'persist:avl_ispfy',
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      }
    } catch {
      // fallback externo
    }
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  wc.on('did-start-loading', sendIspfyState);
  wc.on('did-stop-loading', sendIspfyState);
  wc.on('did-navigate', sendIspfyState);
  wc.on('did-navigate-in-page', sendIspfyState);
  wc.on('did-fail-load', (_e, code, desc, validatedURL) => {
    if (code === -3) return; // ERR_ABORTED normal em redirecionamentos
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ispfy:error', {
        code,
        description: desc,
        url: validatedURL,
      });
    }
    sendIspfyState();
  });

  wc.loadURL(ISPFY_URL).catch(() => undefined);
  return ispfyView;
}

function sanitizeBounds(bounds) {
  if (!bounds || typeof bounds !== 'object') return lastBounds;
  const zoom =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.webContents.getZoomFactor() || 1
      : 1;
  const [contentW, contentH] =
    mainWindow && !mainWindow.isDestroyed() ? mainWindow.getContentSize() : [1440, 900];

  const rawX = Math.round((Number(bounds.x) || 0) * zoom);
  const rawY = Math.round((Number(bounds.y) || 0) * zoom);
  const rawW = Math.round((Number(bounds.width) || 0) * zoom);
  const rawH = Math.round((Number(bounds.height) || 0) * zoom);

  const x = Math.max(0, Math.min(rawX, contentW));
  const y = Math.max(0, Math.min(rawY, contentH));
  const width = Math.max(0, Math.min(rawW, contentW - x));
  const height = Math.max(0, Math.min(rawH, contentH - y));
  return { x, y, width, height };
}

function notifyRequestBoundsSync() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('ispfy:requestSync');
}

function createMainWindow() {
  const iconCandidates = [
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, '..', 'public', 'pwa-512x512.png'),
    path.join(__dirname, '..', 'public', 'pwa-192x192.png'),
  ];
  const iconPath = iconCandidates.find((p) => fs.existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'AVL Control — AVL Telecom',
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:avl_main',
    },
  });

  mainWindow.maximize();

  // Links externos (WhatsApp Web, PDFs, etc.) abrem no navegador padrão; Google OAuth abre em popup limpo
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      const isAuthFlow =
        parsed.hostname.includes('accounts.google.com') ||
        parsed.hostname.includes('firebaseapp.com') ||
        parsed.hostname.includes('app-avl-telecom.vercel.app') ||
        parsed.hostname.includes('avl-telecom.web.app') ||
        parsed.hostname === 'localhost';
      if (isAuthFlow) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 680,
            autoHideMenuBar: true,
            webPreferences: {
              partition: 'persist:avl_main',
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      }
    } catch {
      // ignore
    }
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('resize', notifyRequestBoundsSync);
  mainWindow.on('maximize', notifyRequestBoundsSync);
  mainWindow.on('unmaximize', notifyRequestBoundsSync);
  mainWindow.on('enter-full-screen', notifyRequestBoundsSync);
  mainWindow.on('leave-full-screen', notifyRequestBoundsSync);

  mainWindow.on('closed', () => {
    ispfyView = null;
    mainWindow = null;
  });

  mainWindow.loadURL(startUrl);
}

// IPC da ponte nativa ISPFY WebView
ipcMain.handle('ispfy:show', (_event, bounds) => {
  const view = ensureIspfyView();
  if (!view) return false;
  lastBounds = sanitizeBounds(bounds);
  if (lastBounds.width > 20 && lastBounds.height > 20) {
    view.setBounds(lastBounds);
    view.setVisible(true);
    ispfyVisible = true;
  } else {
    view.setVisible(false);
    ispfyVisible = false;
  }
  sendIspfyState();
  return true;
});

ipcMain.handle('ispfy:setBounds', (_event, bounds) => {
  if (!ispfyView) return false;
  lastBounds = sanitizeBounds(bounds);
  if (ispfyVisible && lastBounds.width > 20 && lastBounds.height > 20) {
    ispfyView.setBounds(lastBounds);
  }
  return true;
});

ipcMain.handle('ispfy:hide', () => {
  if (ispfyView) {
    ispfyView.setVisible(false);
  }
  ispfyVisible = false;
  sendIspfyState();
  return true;
});

ipcMain.handle('ispfy:reload', () => {
  if (ispfyView) {
    ispfyView.webContents.reload();
  }
  return true;
});

ipcMain.handle('ispfy:goBack', () => {
  if (!ispfyView) return false;
  const wc = ispfyView.webContents;
  if (wc.navigationHistory ? wc.navigationHistory.canGoBack() : wc.canGoBack()) {
    if (wc.navigationHistory) wc.navigationHistory.goBack();
    else wc.goBack();
    return true;
  }
  return false;
});

ipcMain.handle('ispfy:goForward', () => {
  if (!ispfyView) return false;
  const wc = ispfyView.webContents;
  if (wc.navigationHistory ? wc.navigationHistory.canGoForward() : wc.canGoForward()) {
    if (wc.navigationHistory) wc.navigationHistory.goForward();
    else wc.goForward();
    return true;
  }
  return false;
});

ipcMain.handle('ispfy:goHome', () => {
  const view = ensureIspfyView();
  if (view) {
    view.webContents.loadURL(ISPFY_URL).catch(() => undefined);
  }
  return true;
});

ipcMain.handle('ispfy:destroy', () => {
  if (ispfyView && mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.contentView.removeChildView(ispfyView);
      ispfyView.webContents.close();
    } catch {
      // ignore
    }
  }
  ispfyView = null;
  ispfyVisible = false;
  sendIspfyState();
  return true;
});

ipcMain.handle('ispfy:getState', () => {
  sendIspfyState();
  return {
    mounted: Boolean(ispfyView),
    visible: ispfyVisible,
    url: ispfyView ? ispfyView.webContents.getURL() || ISPFY_URL : ISPFY_URL,
  };
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
