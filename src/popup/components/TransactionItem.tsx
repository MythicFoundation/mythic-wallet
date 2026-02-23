import React from 'react';
import type { TransactionRecord } from '../../lib/wallet';

interface TransactionItemProps {
  tx: TransactionRecord;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
  return (
    <div className="w-8 h-8 flex items-center justify-center bg-[#FF2D78]/10">
      <svg className={`${iconClass} text-[#FF2D78]`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    </div>
  );
}

export default function TransactionItem({ tx }: TransactionItemProps) {
  const labels: Record<string, string> = {
    send: 'Sent',
    receive: 'Received',
    swap: 'Swapped',
    unknown: 'Transaction',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors border-b border-subtle last:border-b-0">
      <TxIcon type={tx.type} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-heading">{labels[tx.type]}</span>
          <span className={`font-mono text-sm ${tx.type === 'receive' ? 'text-success' : 'text-text-heading'}`}>
            {tx.type === 'receive' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.symbol}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="font-mono text-[10px] text-text-muted">{tx.signature}</span>
          <span className="text-[10px] text-text-muted">{formatTime(tx.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}
