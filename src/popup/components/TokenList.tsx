import React, { useState } from 'react';
import type { TokenBalance } from '../../lib/wallet';

interface TokenListProps {
  tokens: TokenBalance[];
  onTokenClick?: (token: TokenBalance) => void;
}

// Color palette for fallback icons (deterministic from symbol)
const FALLBACK_COLORS = [
  '#FF2D78', '#9945FF', '#2775CA', '#F5A623', '#00C48C',
  '#FF6B35', '#7B61FF', '#00B4D8', '#E63946', '#06D6A0',
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function TokenIcon({ token }: { token: TokenBalance }) {
  const [imgError, setImgError] = useState(false);

  // MYTH special icon
  if (token.symbol === 'MYTH') {
    return (
      <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: '#0F0F15' }}>
        <svg viewBox="0 0 100 100" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,8 20,44 50,56" fill="#FF2D78" opacity="0.92"/>
          <polygon points="50,8 80,44 50,56" fill="#FF5C96" opacity="0.78"/>
          <polygon points="20,44 50,56 80,44 50,92" fill="#CC2460" opacity="0.88"/>
        </svg>
      </div>
    );
  }

  // Real image from metadata
  if (token.icon && token.icon.startsWith('http') && !imgError) {
    return (
      <img
        src={token.icon}
        alt={token.symbol}
        className="w-9 h-9 flex-shrink-0 object-cover"
        style={{ borderRadius: '50%' }}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  // Fallback: colored circle with first letter
  const bg = FALLBACK_COLORS[hashCode(token.symbol) % FALLBACK_COLORS.length];
  return (
    <div
      className="w-9 h-9 flex items-center justify-center text-white font-display font-bold text-xs flex-shrink-0"
      style={{ background: bg, borderRadius: '50%' }}
    >
      {token.symbol.slice(0, 2)}
    </div>
  );
}

function formatBalance(balance: number): string {
  if (balance >= 1000000) return `${(balance / 1000000).toFixed(1)}M`;
  if (balance >= 1000) return balance.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return balance.toFixed(balance < 1 ? 6 : 4);
}

function formatUsd(value: number): string {
  if (value < 0.01 && value > 0) return '<$0.01';
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
          <TokenIcon token={token} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-text-heading truncate">{token.symbol}</span>
              <span className="font-mono text-sm text-text-heading">{formatBalance(token.balance)}</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-text-muted truncate max-w-[120px]">{token.name}</span>
              {token.usdValue > 0 && (
                <span className="text-xs text-text-body">{formatUsd(token.usdValue)}</span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
