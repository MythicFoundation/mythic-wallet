import React from 'react';
import TransactionItem from '../components/TransactionItem';
import { MOCK_TRANSACTIONS } from '../../lib/wallet';

interface TransactionHistoryProps {
  onBack: () => void;
}

export default function TransactionHistory({ onBack }: TransactionHistoryProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
        <button onClick={onBack} className="p-1 hover:bg-surface-hover">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-base font-bold">Transaction History</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {MOCK_TRANSACTIONS.map((tx) => (
          <TransactionItem key={tx.signature} tx={tx} />
        ))}
      </div>
    </div>
  );
}
