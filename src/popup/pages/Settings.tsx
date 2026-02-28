import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { NETWORKS, type NetworkId } from '../../lib/wallet';

interface SettingsProps {
  network: NetworkId;
  connectedSites: string[];
  onBack: () => void;
  onNetworkChange: (network: NetworkId) => void;
  onLock: () => void;
  onDisconnectSite: (site: string) => void;
}

const NETWORK_GROUPS = [
  {
    label: 'Mythic L2',
    networks: ['mythic-mainnet', 'mythic-testnet'] as NetworkId[],
    color: '#FF2D78',
  },
  {
    label: 'Solana L1',
    networks: ['solana-mainnet', 'solana-devnet'] as NetworkId[],
    color: '#9945FF',
  },
];

export default function Settings({
  network,
  connectedSites,
  onBack,
  onNetworkChange,
  onLock,
  onDisconnectSite,
}: SettingsProps) {
  const [showExport, setShowExport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exportResult, setExportResult] = useState('');
  const [exportError, setExportError] = useState('');
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; changelog: string } | null>(null);

  const currentVersion = typeof chrome !== 'undefined' && chrome.runtime?.getManifest
    ? chrome.runtime.getManifest().version
    : '1.0.0';

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('mythic_update', (result) => {
        if (result.mythic_update) setUpdateInfo(result.mythic_update);
      });
    }
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'MYTHIC_CHECK_UPDATE' }, (result) => {
          if (result) setUpdateInfo(result);
          setChecking(false);
        });
      } else {
        setChecking(false);
      }
    } catch {
      setChecking(false);
    }
  };

  const handleExport = async () => {
    setExportError('');
    setExportResult('');
    try {
      const { verifyPassword, getWallet, decryptData } = await import('../../lib/storage');
      const valid = await verifyPassword(exportPassword);
      if (!valid) { setExportError('Incorrect password'); return; }
      const wallet = await getWallet();
      if (!wallet) { setExportError('No wallet found'); return; }
      const secret = await decryptData(wallet.encryptedMnemonic, exportPassword);
      setExportResult(secret);
    } catch {
      setExportError('Failed to export');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
        <button onClick={onBack} className="p-1 hover:bg-surface-hover">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-base font-bold">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Networks */}
        <div className="px-4 py-4 border-b border-subtle">
          <h3 className="text-xs text-text-muted mb-3 font-sans uppercase tracking-wider">Network</h3>
          {NETWORK_GROUPS.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="text-[10px] text-text-disabled mb-1.5 font-display uppercase tracking-widest">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.networks.map((id) => (
                  <button
                    key={id}
                    onClick={() => onNetworkChange(id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 border transition-colors ${
                      network === id
                        ? 'border-rose bg-rose/5'
                        : 'border-subtle hover:border-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: network === id ? group.color : '#404050' }}
                      />
                      <span className="text-sm font-display text-text-heading">{NETWORKS[id].name}</span>
                    </div>
                    {network === id && (
                      <svg className="w-4 h-4 text-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Connected Sites */}
        <div className="px-4 py-4 border-b border-subtle">
          <h3 className="text-xs text-text-muted mb-3 font-sans uppercase tracking-wider">Connected Sites</h3>
          {connectedSites.length === 0 ? (
            <p className="text-xs text-text-disabled">No connected sites</p>
          ) : (
            <div className="space-y-2">
              {connectedSites.map((site) => (
                <div key={site} className="flex items-center justify-between px-3 py-2 bg-surface-elevated border border-subtle">
                  <span className="text-xs text-text-body font-mono">{site}</span>
                  <button onClick={() => onDisconnectSite(site)} className="text-[10px] text-error hover:underline font-display">
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security */}
        <div className="px-4 py-4 border-b border-subtle">
          <h3 className="text-xs text-text-muted mb-3 font-sans uppercase tracking-wider">Security</h3>

          <button
            onClick={() => { setShowExport(!showExport); setExportResult(''); setExportError(''); }}
            className="w-full flex items-center justify-between px-3 py-2.5 border border-subtle hover:border-medium transition-colors mb-2"
          >
            <span className="text-sm text-text-heading font-display">Export Secret</span>
            <svg className={`w-4 h-4 text-text-muted transition-transform ${showExport ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showExport && (
            <div className="px-3 py-3 bg-surface-elevated border border-subtle">
              <p className="text-[10px] text-error mb-2">
                Warning: Never share your secret. Anyone with it can steal your funds.
              </p>
              {!exportResult ? (
                <>
                  <input
                    type="password"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Enter password to reveal"
                    className="w-full bg-surface-card border border-subtle px-3 py-2 text-xs font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose mb-2"
                  />
                  {exportError && <p className="text-[10px] text-error mb-2">{exportError}</p>}
                  <Button variant="secondary" size="sm" fullWidth onClick={handleExport}>
                    Reveal Secret
                  </Button>
                </>
              ) : (
                <div className="bg-surface-card border border-rose/20 px-3 py-2">
                  <p className="font-mono text-[10px] text-text-heading break-all leading-relaxed select-all">
                    {exportResult}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lock */}
        <div className="px-4 py-4 border-b border-subtle">
          <Button variant="secondary" fullWidth onClick={onLock}>
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Lock Wallet
            </span>
          </Button>
        </div>

        {/* About / Updates */}
        <div className="px-4 py-4">
          <h3 className="text-xs text-text-muted mb-3 font-sans uppercase tracking-wider">About</h3>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-text-body">Version</span>
            <span className="text-xs font-mono text-text-heading">v{currentVersion}</span>
          </div>
          {updateInfo ? (
            <div className="bg-rose/5 border border-rose/20 px-3 py-2.5 mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-rose font-display font-semibold">v{updateInfo.version} available</span>
                <button
                  onClick={() => {
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                      chrome.tabs.create({ url: 'https://wallet.mythic.sh' });
                    }
                  }}
                  className="text-[10px] font-display font-semibold text-rose hover:text-rose-light px-2 py-0.5 border border-rose/30"
                >
                  Update
                </button>
              </div>
              {updateInfo.changelog && (
                <p className="text-[10px] text-text-muted">{updateInfo.changelog}</p>
              )}
            </div>
          ) : (
            <button
              onClick={handleCheckUpdate}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-subtle hover:border-medium transition-colors text-xs text-text-body font-display mb-3"
            >
              {checking ? (
                <>
                  <span className="w-3 h-3 border-2 border-rose border-t-transparent rounded-full animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Check for updates
                </>
              )}
            </button>
          )}
          <p className="text-[10px] text-text-disabled text-center">
            Mythic Wallet — wallet.mythic.sh
          </p>
        </div>
      </div>
    </div>
  );
}
