import React from 'react';
import type { TokenBalance } from '../../lib/wallet';

interface TokenListProps {
  tokens: TokenBalance[];
  onTokenClick?: (token: TokenBalance) => void;
}

function TokenIcon({ symbol }: { symbol: string }) {
  const colors: Record<string, string> = {
    MYTH: '#FF2D78',
    SOL: '#9945FF',
    USDC: '#2775CA',
    BONK: '#F5A623',
  };
  const bg = colors[symbol] || '#686878';

  if (symbol === 'MYTH') {
    return (
      <div className="w-9 h-9 flex items-center justify-center" style={{ background: '#0F0F15' }}>
        <svg viewBox="0 0 100 100" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,8 20,44 50,56" fill="#FF2D78" opacity="0.92"/>
          <polygon points="50,8 80,44 50,56" fill="#FF5C96" opacity="0.78"/>
          <polygon points="20,44 50,56 80,44 50,92" fill="#CC2460" opacity="0.88"/>
        </svg>
      </div>
    );
  }

  return (
    <div
      className="w-9 h-9 flex items-center justify-center text-white font-display font-bold text-xs"
      style={{ background: bg, borderRadius: '50%' }}
    >
      {symbol.slice(0, 1)}
    </div>
  );
}

function formatBalance(balance: number): string {
  if (balance >= 1000000) return `${(balance / 1000000).toFixed(1)}M`;
  if (balance >= 1000) return balance.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return balance.toFixed(balance < 1 ? 6 : 2);
}

function formatUsd(value: number): string {
  if (value === 0) return '--';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TokenList({ tokens, onTokenClick }: TokenListProps) {
  return (
    <div className="flex flex-col">
      {tokens.map((token) => (
        <button
          key={token.mint}
          onClick={() => onTokenClick?.(token)}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors w-full text-left border-b border-subtle last:border-b-0"
        >
          <TokenIcon symbol={token.symbol} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-text-heading">{token.symbol}</span>
              <span className="font-mono text-sm text-text-heading">{formatBalance(token.balance)}</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-text-muted">{token.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-body">{formatUsd(token.usdValue)}</span>
                {token.change24h !== 0 && (
                  <span className={`text-[10px] ${token.change24h > 0 ? 'text-success' : 'text-error'}`}>
                    {token.change24h > 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
