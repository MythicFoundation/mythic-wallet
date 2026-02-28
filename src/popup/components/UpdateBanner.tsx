import React, { useState, useEffect } from 'react';

interface UpdateInfo {
  version: string;
  changelog: string;
  url: string;
  checkedAt: number;
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [justUpdated, setJustUpdated] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    // Check for "just updated" notification
    chrome.storage.local.get('mythic_just_updated', (result) => {
      const info = result.mythic_just_updated;
      if (info && Date.now() - info.at < 5 * 60 * 1000) {
        setJustUpdated({ from: info.from, to: info.to });
        // Clear after showing
        setTimeout(() => {
          chrome.storage.local.remove('mythic_just_updated');
          setJustUpdated(null);
        }, 10000);
      } else if (info) {
        chrome.storage.local.remove('mythic_just_updated');
      }
    });

    // Check for pending update
    chrome.storage.local.get('mythic_update', (result) => {
      if (result.mythic_update) {
        setUpdate(result.mythic_update);
      }
    });
  }, []);

  if (justUpdated) {
    return (
      <div className="px-4 py-2 bg-success/10 border-b border-success/20 flex items-center gap-2">
        <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-[11px] text-success">
          Updated to v{justUpdated.to}
        </p>
      </div>
    );
  }

  if (!update || dismissed) return null;

  const handleUpdate = () => {
    // Chrome auto-updates handle .crx — but for manual installs, open the download page
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: update.url });
    } else {
      window.open(update.url, '_blank');
    }
    // Dismiss badge
    chrome.runtime?.sendMessage?.({ type: 'MYTHIC_DISMISS_UPDATE' });
  };

  const handleDismiss = () => {
    setDismissed(true);
    chrome.runtime?.sendMessage?.({ type: 'MYTHIC_DISMISS_UPDATE' });
  };

  return (
    <div className="px-4 py-2.5 bg-rose/5 border-b border-rose/20 flex items-center gap-2">
      <svg className="w-4 h-4 text-rose flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-text-heading font-display font-semibold">
          v{update.version} available
        </p>
        {update.changelog && (
          <p className="text-[10px] text-text-muted truncate">{update.changelog}</p>
        )}
      </div>
      <button
        onClick={handleUpdate}
        className="text-[10px] font-display font-semibold text-rose hover:text-rose-light px-2 py-1 border border-rose/30 hover:border-rose/50 transition-colors flex-shrink-0"
      >
        Update
      </button>
      <button onClick={handleDismiss} className="p-0.5 text-text-muted hover:text-text-body flex-shrink-0">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
