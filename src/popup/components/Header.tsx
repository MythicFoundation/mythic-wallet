import React from 'react';
import { truncateAddress, type NetworkId, NETWORKS } from '../../lib/wallet';

interface HeaderProps {
  address: string;
  network: NetworkId;
  onSettingsClick: () => void;
  onCopyAddress: () => void;
}

export default function Header({ address, network, onSettingsClick, onCopyAddress }: HeaderProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    onCopyAddress();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-subtle bg-surface-card">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 100 100" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,8 20,44 50,56" fill="#FF2D78" opacity="0.92"/>
          <polygon points="50,8 80,44 50,56" fill="#FF5C96" opacity="0.78"/>
          <polygon points="20,44 50,56 80,44 50,92" fill="#CC2460" opacity="0.88"/>
        </svg>
        <div>
          <div className="font-display text-sm font-bold text-text-heading">Mythic</div>
          <div className="text-[10px] text-text-muted">{NETWORKS[network].name}</div>
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-subtle hover:border-medium transition-colors"
      >
        <span className="font-mono text-xs text-text-body">{truncateAddress(address)}</span>
        <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {copied ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          )}
        </svg>
      </button>

      <button
        onClick={onSettingsClick}
        className="p-1.5 hover:bg-surface-hover transition-colors"
      >
        <svg className="w-5 h-5 text-text-muted hover:text-text-body" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  );
}
