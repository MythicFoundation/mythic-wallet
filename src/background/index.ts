// Mythic Wallet — Background Service Worker (Manifest V3)

// ─── Auto-Update System ───

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

async function checkForUpdate() {
  try {
    const res = await fetch('https://wallet.mythic.sh/api/extension/version');
    const data = await res.json();
    const currentVersion = chrome.runtime.getManifest().version;
    if (data.version && data.version !== currentVersion && isNewerVersion(data.version, currentVersion)) {
      // Store update info for the popup to display
      await chrome.storage.local.set({
        mythic_update: {
          version: data.version,
          changelog: data.changelog || '',
          url: data.downloadUrl || 'https://wallet.mythic.sh',
          checkedAt: Date.now(),
        },
      });
      // Set badge to indicate update available
      chrome.action.setBadgeText({ text: '1' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF2D78' });
    }
  } catch {
    // Silent fail — will retry next interval
  }
}

function isNewerVersion(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

// Handle extension update (Chrome applied a new version)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    // Clear update badge since we just updated
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.remove('mythic_update');
    // Notify any open popup that we updated
    chrome.storage.local.set({
      mythic_just_updated: {
        from: details.previousVersion,
        to: chrome.runtime.getManifest().version,
        at: Date.now(),
      },
    });
  }
  resetLockTimer();
});

// ─── Auto-Lock (15 min inactivity) ───

const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000;
let lockTimer: ReturnType<typeof setTimeout> | null = null;

function resetLockTimer() {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(async () => {
    const result = await chrome.storage.local.get('mythic_state');
    const state = result.mythic_state;
    if (state && state.hasWallet && !state.isLocked) {
      await chrome.storage.local.set({
        mythic_state: { ...state, isLocked: true },
      });
    }
  }, AUTO_LOCK_TIMEOUT);
}

// ─── Message Handler ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  resetLockTimer();

  if (message.type === 'MYTHIC_GET_STATE') {
    chrome.storage.local.get('mythic_state', (result) => {
      sendResponse(result.mythic_state || { hasWallet: false, isLocked: true });
    });
    return true;
  }

  if (message.type === 'MYTHIC_CONNECT') {
    chrome.storage.local.get('mythic_state', async (result) => {
      const state = result.mythic_state;
      if (!state || !state.hasWallet || state.isLocked) {
        sendResponse({ error: 'Wallet is locked or not set up' });
        return;
      }
      const origin = message.origin || sender.origin;
      if (origin && !state.connectedSites?.includes(origin)) {
        const updated = { ...state, connectedSites: [...(state.connectedSites || []), origin] };
        await chrome.storage.local.set({ mythic_state: updated });
      }
      const wallet = await chrome.storage.local.get('mythic_wallet');
      sendResponse({
        publicKey: wallet.mythic_wallet?.publicKey,
      });
    });
    return true;
  }

  if (message.type === 'MYTHIC_DISCONNECT') {
    chrome.storage.local.get('mythic_state', async (result) => {
      const state = result.mythic_state;
      if (state) {
        const origin = message.origin || sender.origin;
        const updated = {
          ...state,
          connectedSites: (state.connectedSites || []).filter((s: string) => s !== origin),
        };
        await chrome.storage.local.set({ mythic_state: updated });
      }
      sendResponse({ success: true });
    });
    return true;
  }

  // Check for updates on demand from popup
  if (message.type === 'MYTHIC_CHECK_UPDATE') {
    checkForUpdate().then(() => {
      chrome.storage.local.get('mythic_update', (result) => {
        sendResponse(result.mythic_update || null);
      });
    });
    return true;
  }

  // Dismiss update badge
  if (message.type === 'MYTHIC_DISMISS_UPDATE') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

// ─── Startup ───

chrome.runtime.onStartup.addListener(() => {
  resetLockTimer();
  // Check for updates on browser startup
  checkForUpdate();
});

// Periodic update check via alarm
chrome.alarms?.create('mythic-update-check', { periodInMinutes: 60 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === 'mythic-update-check') {
    checkForUpdate();
  }
});
