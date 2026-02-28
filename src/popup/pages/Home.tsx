import React, { useState } from 'react';
import TokenList from '../components/TokenList';
import TransactionItem from '../components/TransactionItem';
import Button from '../components/Button';
import type { TokenBalance, TransactionRecord, NetworkId } from '../../lib/wallet';

interface HomeProps {
  tokens: TokenBalance[];
  transactions: TransactionRecord[];
  loading: boolean;
  solPrice: number;
  mythPrice: number;
  network: NetworkId;
  onSend: () => void;
  onReceive: () => void;
  onBridge: () => void;
  onRefresh: () => void;
}

type Tab = 'tokens' | 'activity';

export default function Home({ tokens, transactions, loading, solPrice, mythPrice, network, onSend, onReceive, onBridge, onRefresh }: HomeProps) {
  const [activeTab, setActiveTab] = useState<Tab>('tokens');
  const isL2 = network.startsWith('mythic');
  const nativeSymbol = isL2 ? 'MYTH' : 'SOL';
  const nativePrice = isL2 ? mythPrice : solPrice;

  const totalUsd = tokens.reduce((sum, t) => sum + t.usdValue, 0);
  const nativeToken = tokens.find((t) => t.mint === 'native');

  return (
    <div className="flex flex-col h-full">
      {/* Balance Section */}
      <div className="px-4 pt-5 pb-4 bg-surface-card border-b border-subtle">
        <div className="text-center">
          <p className="text-xs text-text-muted font-sans mb-1">Total Balance</p>
          {totalUsd > 0 ? (
            <h1 className="font-display text-3xl font-bold text-text-heading">
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
          ) : (
            <h1 className="font-display text-3xl font-bold text-text-heading">
              {nativeToken ? `${nativeToken.balance.toFixed(4)} ${nativeSymbol}` : '—'}
            </h1>
          )}
          {nativePrice > 0 && (
            <p className="text-[10px] text-text-muted mt-1 font-mono">
              {nativeSymbol} ${nativePrice.toFixed(nativePrice < 1 ? 6 : 2)}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button variant="primary" fullWidth onClick={onSend}>
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Send
            </span>
          </Button>
          <Button variant="secondary" fullWidth onClick={onReceive}>
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Receive
            </span>
          </Button>
          <Button variant="secondary" fullWidth onClick={onBridge}>
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              Bridge
            </span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-subtle">
        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 py-2.5 text-sm font-display font-semibold transition-colors ${
            activeTab === 'tokens' ? 'text-rose border-b-2 border-rose' : 'text-text-muted hover:text-text-body'
          }`}
        >
          Tokens
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2.5 text-sm font-display font-semibold transition-colors ${
            activeTab === 'activity' ? 'text-rose border-b-2 border-rose' : 'text-text-muted hover:text-text-body'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-rose border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-text-muted">Loading...</p>
          </div>
        ) : activeTab === 'tokens' ? (
          tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <p className="text-sm text-text-muted mb-1">No tokens found</p>
              <p className="text-xs text-text-disabled text-center">
                Deposit {nativeSymbol} or tokens to this address to get started
              </p>
            </div>
          ) : (
            <TokenList tokens={tokens} />
          )
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <p className="text-sm text-text-muted mb-1">No transactions yet</p>
            <p className="text-xs text-text-disabled text-center">
              Your transaction history will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {transactions.map((tx) => (
              <TransactionItem key={tx.signature} tx={tx} network={network} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
