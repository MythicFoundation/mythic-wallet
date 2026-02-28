import React from 'react';
import { truncateAddress, NETWORKS, type TransactionRecord, type NetworkId } from '../../lib/wallet';

interface TransactionItemProps {
  tx: TransactionRecord;
  network: NetworkId;
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function TxIcon({ type }: { type: TransactionRecord['type'] }) {
  const iconClass = 'w-4 h-4';
  if (type === 'receive') {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-success/10">
        <svg className={`${iconClass} text-success`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    );
  }
  if (type === 'send') {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-rose/10">
        <svg className={`${iconClass} text-rose`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </div>
    );
  }
  if (type === 'swap') {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-[#FF2D78]/10">
        <svg className={`${iconClass} text-[#FF2D78]`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 flex items-center justify-center bg-surface-elevated">
      <svg className={`${iconClass} text-text-muted`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </div>
  );
}

export default function TransactionItem({ tx, network }: TransactionItemProps) {
  const labels: Record<string, string> = {
    send: 'Sent',
    receive: 'Received',
    swap: 'Swapped',
    unknown: 'Transaction',
  };

  const net = NETWORKS[network];
  const isL2 = network.startsWith('mythic');
  const nativeSymbol = isL2 ? 'MYTH' : 'SOL';

  // Display the correct symbol for native transfers
  const displaySymbol = tx.symbol === 'SOL' && isL2 ? 'MYTH' : tx.symbol;

  const explorerUrl = net.chain === 'solana'
    ? `${net.explorerUrl}/tx/${tx.signature}`
    : `${net.explorerUrl}/tx/${tx.signature}`;

  const handleClick = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: explorerUrl });
    } else {
      window.open(explorerUrl, '_blank');
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors border-b border-subtle last:border-b-0 w-full text-left"
    >
      <TxIcon type={tx.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text-heading">{labels[tx.type]}</span>
            {tx.status === 'failed' && (
              <span className="text-[9px] bg-error/20 text-error px-1 py-0.5 font-mono">FAILED</span>
            )}
          </div>
          {tx.amount > 0 && (
            <span className={`font-mono text-sm ${tx.type === 'receive' ? 'text-success' : 'text-text-heading'}`}>
              {tx.type === 'receive' ? '+' : '-'}{tx.amount < 0.001 ? tx.amount.toFixed(6) : tx.amount.toFixed(4)} {displaySymbol}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="font-mono text-[10px] text-text-muted">
            {tx.to ? `To ${truncateAddress(tx.to)}` : tx.from ? `From ${truncateAddress(tx.from)}` : truncateAddress(tx.signature, 8)}
          </span>
          <span className="text-[10px] text-text-muted">{formatTime(tx.timestamp)}</span>
        </div>
      </div>
      {/* Explorer link indicator */}
      <svg className="w-3.5 h-3.5 text-text-disabled flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </button>
  );
}
