// HelloCal-programmer til Windows — "dumme" vinduer, der kun viser en web-adresse.
// Samme kode bygges til to programmer (se build.ps1); hvilket der kører, afgøres af
// exe-filens navn: "HelloCal Admin.exe" viser admin-panelet, "HelloCal.exe" selve appen.
// Hvert program har sin egen profil (%APPDATA%\<titel>), og login-cookien gemmes dér,
// så der kun skal logges ind igen, når sessionen udløber (admin: 24 timer).

import { app, BrowserWindow, Menu, dialog, screen, session, shell } from "electron";
import fs from "node:fs";
import path from "node:path";

const COMMON_PERMISSIONS = ["clipboard-sanitized-write", "clipboard-read", "fullscreen", "notifications"];
const VARIANTS = {
  admin: {
    title: "HelloCal Admin",
    appId: "dk.packroff.hellocal.admin",
    // Eksplicit /admin: på bare "/" sender brugerappens WebShell klienten videre til kalenderen.
    startUrl: "https://admin.hellocal.io/admin",
    permissions: COMMON_PERMISSIONS,
  },
  app: {
    title: "HelloCal",
    appId: "dk.packroff.hellocal.app",
    startUrl: "https://hellocal.io/",
    // Kamera og mikrofon bruges til stregkode-scanning, tallerken-foto og tale.
    permissions: [...COMMON_PERMISSIONS, "media"],
  },
};
const variantKey = process.env.HELLOCAL_VARIANT ?? (path.basename(process.execPath, ".exe") === "HelloCal" ? "app" : "admin");
const { title: APP_TITLE, appId: APP_ID, startUrl: START_URL } = VARIANTS[variantKey];
const ALLOWED_PERMISSIONS = new Set(VARIANTS[variantKey].permissions);
// Kun disse værter vises i selve programmet; alle andre links åbnes i standardbrowseren.
const INTERNAL_HOSTS = new Set(["admin.hellocal.io", "hellocal.io"]);
const RETRY_MS = 10_000;
const SERVER_RETRY_MS = 5_000;

// Egen profilmappe pr. program (skal sættes, før noget bruger userData).
app.setPath("userData", path.join(app.getPath("appData"), APP_TITLE));
app.setAppUserModelId(APP_ID);
// Serveren skal se en almindelig Chrome, ikke "Electron/…" eller programnavnet.
app.userAgentFallback = app.userAgentFallback.replace(/\s(?:Electron|HelloCal\w*|hellocal-\w+)\/\S+/g, "");

let mainWindow = null;

function isInternalUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && INTERNAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function openExternally(raw) {
  try {
    const { protocol } = new URL(raw);
    if (protocol === "https:" || protocol === "http:" || protocol === "mailto:") shell.openExternal(raw);
  } catch {
    // Ugyldig adresse — ignorér.
  }
}

function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadWindowState() {
  const fallback = { width: 1400, height: 900, maximized: false };
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    if (typeof saved.width !== "number" || typeof saved.height !== "number") return fallback;
    const onScreen =
      typeof saved.x === "number" &&
      typeof saved.y === "number" &&
      screen.getAllDisplays().some(({ workArea: a }) => {
        return saved.x < a.x + a.width - 100 && saved.x + saved.width > a.x + 100 && saved.y >= a.y && saved.y < a.y + a.height - 100;
      });
    return { width: saved.width, height: saved.height, maximized: Boolean(saved.maximized), ...(onScreen ? { x: saved.x, y: saved.y } : {}) };
  } catch {
    return fallback;
  }
}

function saveWindowState(win) {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch {
    // Vinduesplacering er kun en bekvemmelighed.
  }
}

// Vises i stedet for en tom side eller en rå "Bad Gateway", når internettet er væk (serverError = false)
// eller serveren genstarter efter en udrulning (serverError = true). Prøver selv igen.
function offlineHtml(url, reason, serverError) {
  const target = JSON.stringify(url).replace(/</g, "\\u003c");
  const detail = String(reason).replace(/[^\w ]/g, "");
  const heading = serverError ? "Serveren genstarter" : `Kan ikke nå ${APP_TITLE}`;
  const message = serverError
    ? "Siden opdateres lige nu. Programmet prøver igen automatisk."
    : "Tjek internetforbindelsen. Programmet prøver igen automatisk.";
  return `<!doctype html><meta charset="utf-8"><title>${APP_TITLE}</title>
<style>
  body { margin: 0; height: 100vh; display: grid; place-items: center; font: 16px system-ui, sans-serif; background: #f6f7f4; color: #243b2f; }
  main { max-width: 28rem; padding: 2rem; text-align: center; }
  button { font: inherit; padding: .6rem 1.4rem; border: 0; border-radius: 999px; background: #2f6b4f; color: #fff; cursor: pointer; }
</style>
<main>
  <h1>${heading}</h1>
  <p>${message}</p>
  <p><small>${detail}</small></p>
  <button onclick="retry()">Prøv igen</button>
</main>
<script>
  const target = ${target};
  function retry() { location.replace(target); }
  setTimeout(retry, ${serverError ? SERVER_RETRY_MS : RETRY_MS});
</script>`;
}

function showRetryPage(win, url, reason, serverError) {
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlineHtml(url, reason, serverError))}`);
}

function goHome() {
  if (mainWindow) mainWindow.loadURL(START_URL);
}

function goBack(win) {
  const history = win.webContents.navigationHistory;
  if (history.canGoBack()) history.goBack();
}

function goForward(win) {
  const history = win.webContents.navigationHistory;
  if (history.canGoForward()) history.goForward();
}

async function clearSavedLogin() {
  if (!mainWindow) return;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Ryd gemt login", "Annuller"],
    defaultId: 1,
    cancelId: 1,
    title: APP_TITLE,
    message: "Ryd gemt login?",
    detail: "Du skal logge ind med adgangskode igen næste gang.",
  });
  if (response !== 0) return;
  await session.defaultSession.clearStorageData();
  await session.defaultSession.clearCache();
  goHome();
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Program",
      submenu: [
        { label: "Forside", accelerator: "Alt+Home", click: goHome },
        { label: "Genindlæs", role: "reload" },
        { label: "Genindlæs", accelerator: "F5", visible: false, click: () => mainWindow?.webContents.reload() },
        { label: "Tilbage", accelerator: "Alt+Left", click: () => mainWindow && goBack(mainWindow) },
        { label: "Frem", accelerator: "Alt+Right", click: () => mainWindow && goForward(mainWindow) },
        { type: "separator" },
        { label: "Ryd gemt login…", click: clearSavedLogin },
        { type: "separator" },
        { label: "Afslut", role: "quit" },
      ],
    },
    {
      label: "Rediger",
      submenu: [
        { label: "Fortryd", role: "undo" },
        { label: "Gentag", role: "redo" },
        { type: "separator" },
        { label: "Klip", role: "cut" },
        { label: "Kopiér", role: "copy" },
        { label: "Indsæt", role: "paste" },
        { label: "Markér alt", role: "selectAll" },
      ],
    },
    {
      label: "Vis",
      submenu: [
        { label: "Zoom ind", role: "zoomIn" },
        { label: "Zoom ind", accelerator: "CommandOrControl+=", visible: false, role: "zoomIn" },
        { label: "Zoom ud", role: "zoomOut" },
        { label: "Normal størrelse", role: "resetZoom" },
        { type: "separator" },
        { label: "Fuld skærm", role: "togglefullscreen" },
        { label: "Udviklerværktøjer", role: "toggleDevTools" },
      ],
    },
  ]);
}

function createWindow() {
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: APP_TITLE,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  mainWindow = win;

  if (state.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  win.on("close", () => {
    saveWindowState(win);
    session.defaultSession.cookies.flushStore().catch(() => {});
  });
  win.on("closed", () => {
    mainWindow = null;
  });
  // Musens tommelfinger-knapper (tilbage/frem).
  win.on("app-command", (_event, command) => {
    if (command === "browser-backward") goBack(win);
    if (command === "browser-forward") goForward(win);
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // -3 = navigation afbrudt af en ny navigation
    showRetryPage(win, isInternalUrl(validatedURL) ? validatedURL : START_URL, errorDescription, false);
  });
  // 502/503/504 = serveren genstarter (udrulning); i stedet for en rå fejlside eller blank side
  // vises en venteside, der selv prøver igen.
  win.webContents.on("did-frame-navigate", (_event, url, httpResponseCode, _statusText, isMainFrame) => {
    if (!isMainFrame || ![502, 503, 504].includes(httpResponseCode) || !isInternalUrl(url)) return;
    showRetryPage(win, url, `HTTP ${httpResponseCode}`, true);
  });
  win.webContents.on("render-process-gone", () => win.reload());

  win.loadURL(START_URL);
}

// Genvej i Startmenuen (kræver ikke administrator). Oprettes/rettes ved hver start,
// så den også følger med, hvis programmet flyttes. AppUserModelID'et gør, at
// proceslinjeikonet og genvejen er samme program (så "Fastgør" virker).
function ensureStartMenuShortcut() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  const shortcutPath = path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", `${APP_TITLE}.lnk`);
  const wanted = {
    target: process.execPath,
    cwd: path.dirname(process.execPath),
    description: APP_TITLE,
    icon: process.execPath,
    iconIndex: 0,
    appUserModelId: APP_ID,
  };
  try {
    let current = null;
    try {
      current = shell.readShortcutLink(shortcutPath);
    } catch {
      // Genvejen findes ikke endnu.
    }
    if (current && current.target === wanted.target && current.appUserModelId === APP_ID) return;
    shell.writeShortcutLink(shortcutPath, "create", wanted);
  } catch (error) {
    console.error("Kunne ikke oprette genvej i Startmenuen:", error);
  }
}

app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) {
      return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, title: APP_TITLE } };
    }
    openExternally(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    openExternally(url);
  });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
      callback(ALLOWED_PERMISSIONS.has(permission) && isInternalUrl(details.requestingUrl));
    });
    session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => {
      return ALLOWED_PERMISSIONS.has(permission) && isInternalUrl(origin);
    });
    Menu.setApplicationMenu(buildMenu());
    ensureStartMenuShortcut();
    createWindow();
  });

  app.on("window-all-closed", () => app.quit());
}
