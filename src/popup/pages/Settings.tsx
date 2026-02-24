import React, { useState } from 'react';
import Button from '../components/Button';
import { NETWORKS, type NetworkId } from '../../lib/wallet';

const DEMO_MODE = typeof chrome === 'undefined' || !chrome.storage;

interface SettingsProps {
  network: NetworkId;
  connectedSites: string[];
  onBack: () => void;
  onNetworkChange: (network: NetworkId) => void;
  onLock: () => void;
  onDisconnectSite: (site: string) => void;
}

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
  const [exportError, setExportError] = useState('');
  const [exportedKey, setExportedKey] = useState('');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!exportPassword) {
      setExportError('Enter your password');
      return;
    }
    setExporting(true);
    setExportError('');

    if (DEMO_MODE) {
      setExportError('Export not available in demo mode');
      setExporting(false);
      return;
    }

    try {
      const { verifyPassword, getWallet, decryptData } = await import('../../lib/storage');
      const { keypairFromMnemonic } = await import('../../lib/wallet');
      const bs58 = await import('bs58');

      const valid = await verifyPassword(exportPassword);
      if (!valid) {
        setExportError('Incorrect password');
        setExporting(false);
        return;
      }

      const wallet = await getWallet();
      if (!wallet) {
        setExportError('Wallet not found');
        setExporting(false);
        return;
      }

      const mnemonic = await decryptData(wallet.encryptedMnemonic, exportPassword);
      const account = await keypairFromMnemonic(mnemonic);
      setExportedKey(bs58.default.encode(account.secretKey));
    } catch {
      setExportError('Failed to export key');
    }
    setExporting(false);
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
        {/* Network */}
        <div className="px-4 py-4 border-b border-subtle">
          <h3 className="text-xs text-text-muted mb-3 font-sans uppercase tracking-wider">Network</h3>
          <div className="space-y-2">
            {(Object.entries(NETWORKS) as [NetworkId, typeof NETWORKS[NetworkId]][]).map(([id, net]) => (
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
                  <div className={`w-2 h-2 rounded-full ${network === id ? 'bg-rose' : 'bg-text-disabled'}`} />
                  <span className="text-sm font-display text-text-heading">{net.name}</span>
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
                  <button
                    onClick={() => onDisconnectSite(site)}
                    className="text-[10px] text-error hover:underline font-display"
                  >
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
            onClick={() => { setShowExport(!showExport); setExportedKey(''); setExportError(''); setExportPassword(''); }}
            className="w-full flex items-center justify-between px-3 py-2.5 border border-subtle hover:border-medium transition-colors mb-2"
          >
            <span className="text-sm text-text-heading font-display">Export Private Key</span>
            <svg className={`w-4 h-4 text-text-muted transition-transform ${showExport ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showExport && (
            <div className="px-3 py-3 bg-surface-elevated border border-subtle">
              <p className="text-[10px] text-error mb-2">
                Warning: Never share your private key. Anyone with it can steal your funds.
              </p>
              {exportedKey ? (
                <div className="mb-2">
                  <div className="bg-surface-card border border-subtle px-3 py-2 break-all">
                    <p className="font-mono text-[10px] text-text-heading select-all">{exportedKey}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(exportedKey); }}
                    className="mt-2 text-[10px] text-rose hover:underline font-display"
                  >
                    Copy to clipboard
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="password"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Enter password to reveal"
                    className="w-full bg-surface-card border border-subtle px-3 py-2 text-xs font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose mb-2"
                  />
                  {exportError && <p className="text-[10px] text-error mb-2">{exportError}</p>}
                  <Button variant="secondary" size="sm" fullWidth onClick={handleExport} disabled={exporting}>
                    {exporting ? 'Decrypting...' : 'Reveal Private Key'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Lock */}
        <div className="px-4 py-4">
          <Button variant="secondary" fullWidth onClick={onLock}>
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Lock Wallet
            </span>
          </Button>
        </div>

        {/* Version */}
        <div className="px-4 pb-4 text-center">
          <p className="text-[10px] text-text-disabled">Mythic Wallet v1.1.0</p>
        </div>
      </div>
    </div>
  );
}
