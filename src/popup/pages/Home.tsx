import React, { useState, useEffect, useCallback } from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import TokenList from '../components/TokenList';
import TransactionItem from '../components/TransactionItem';
import Button from '../components/Button';
import {
  getConnection,
  getBalance,
  truncateAddress,
  NATIVE_TOKEN_SYMBOL,
  NATIVE_TOKEN_NAME,
  NATIVE_TOKEN_MINT,
  MOCK_TOKENS,
  MOCK_TRANSACTIONS,
  type NetworkId,
  type TokenBalance,
  type TransactionRecord,
} from '../../lib/wallet';

// Demo mode: skip chrome.storage for development
const DEMO_MODE = typeof chrome === 'undefined' || !chrome.storage;

interface HomeProps {
  address: string;
  network: NetworkId;
  onSend: () => void;
  onReceive: () => void;
}

type Tab = 'tokens' | 'activity';

export default function Home({ address, network, onSend, onReceive }: HomeProps) {
  const [activeTab, setActiveTab] = useState<Tab>('tokens');
  const [tokens, setTokens] = useState<TokenBalance[]>(DEMO_MODE ? MOCK_TOKENS : []);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(DEMO_MODE ? MOCK_TRANSACTIONS : []);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [lastRefresh, setLastRefresh] = useState(0);

  const fetchBalances = useCallback(async () => {
    if (DEMO_MODE) return;
    try {
      const connection = getConnection(network);
      const nativeBalance = await getBalance(connection, address);

      const nativeToken: TokenBalance = {
        symbol: NATIVE_TOKEN_SYMBOL,
        name: NATIVE_TOKEN_NAME,
        mint: NATIVE_TOKEN_MINT,
        balance: nativeBalance,
        usdValue: 0,
        icon: NATIVE_TOKEN_SYMBOL,
        change24h: 0,
      };

      const tokenList: TokenBalance[] = [nativeToken];

      // Try to fetch SPL token accounts
      try {
        const pubkey = new PublicKey(address);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        });

        for (const { account } of tokenAccounts.value) {
          const parsed = account.data.parsed?.info;
          if (!parsed) continue;
          const mint = parsed.mint as string;
          const balance = parsed.tokenAmount?.uiAmount ?? 0;
          if (balance === 0) continue;

          // Map known mints to names
          let symbol = truncateAddress(mint, 4);
          let name = 'Unknown Token';
          if (mint === 'MythToken1111111111111111111111111111111111' || mint === '7Hmyi9v4itEt49xo1fpTgHk1ytb8MZft7RBATBgb1pnf') {
            symbol = 'MYTH';
            name = 'Mythic Token';
          } else if (mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
            symbol = 'USDC';
            name = 'USD Coin';
          }

          tokenList.push({
            symbol,
            name,
            mint,
            balance,
            usdValue: 0,
            icon: symbol,
            change24h: 0,
          });
        }
      } catch {
        // SPL token fetch failed, just show native
      }

      setTokens(tokenList);
    } catch {
      // RPC error — show empty state
      setTokens([{
        symbol: NATIVE_TOKEN_SYMBOL,
        name: NATIVE_TOKEN_NAME,
        mint: NATIVE_TOKEN_MINT,
        balance: 0,
        usdValue: 0,
        icon: NATIVE_TOKEN_SYMBOL,
        change24h: 0,
      }]);
    }
  }, [address, network]);

  const fetchTransactions = useCallback(async () => {
    if (DEMO_MODE) return;
    try {
      const connection = getConnection(network);
      const pubkey = new PublicKey(address);
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 10 });

      if (signatures.length === 0) {
        setTransactions([]);
        return;
      }

      const txRecords: TransactionRecord[] = signatures.map((sig) => {
        return {
          signature: `${sig.signature.slice(0, 6)}...${sig.signature.slice(-4)}`,
          type: 'unknown' as const,
          amount: 0,
          symbol: NATIVE_TOKEN_SYMBOL,
          timestamp: (sig.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
          status: sig.err ? 'failed' as const : 'confirmed' as const,
        };
      });

      // Try to fetch parsed details for each transaction
      const fullSignatures = signatures.map((s) => s.signature);
      try {
        const parsedTxs = await connection.getParsedTransactions(fullSignatures, {
          maxSupportedTransactionVersion: 0,
        });

        for (let i = 0; i < parsedTxs.length; i++) {
          const parsed = parsedTxs[i];
          if (!parsed) continue;

          const instructions = parsed.transaction.message.instructions;
          for (const ix of instructions) {
            if ('parsed' in ix && ix.program === 'system' && ix.parsed?.type === 'transfer') {
              const info = ix.parsed.info;
              const lamports = info.lamports ?? 0;
              const amount = lamports / LAMPORTS_PER_SOL;
              const source = info.source as string;
              const dest = info.destination as string;

              if (source === address) {
                txRecords[i] = {
                  ...txRecords[i],
                  type: 'send',
                  amount,
                  to: truncateAddress(dest, 4),
                };
              } else if (dest === address) {
                txRecords[i] = {
                  ...txRecords[i],
                  type: 'receive',
                  amount,
                  from: truncateAddress(source, 4),
                };
              }
              break;
            }
          }
        }
      } catch {
        // Parsed fetch failed, keep basic records
      }

      setTransactions(txRecords);
    } catch {
      setTransactions([]);
    }
  }, [address, network]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchBalances(), fetchTransactions()]);
    setLoading(false);
    setLastRefresh(Date.now());
  }, [fetchBalances, fetchTransactions]);

  // Initial fetch + periodic refresh
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const nativeToken = tokens.find((t) => t.mint === NATIVE_TOKEN_MINT);
  const nativeBalance = nativeToken?.balance ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Balance Section */}
      <div className="px-4 pt-5 pb-4 bg-surface-card border-b border-subtle">
        <div className="text-center">
          <p className="text-xs text-text-muted font-sans mb-1">{NATIVE_TOKEN_SYMBOL} Balance</p>
          {loading ? (
            <div className="flex items-center justify-center h-10">
              <svg className="w-5 h-5 animate-spin text-text-muted" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold text-text-heading">
                {nativeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {NATIVE_TOKEN_SYMBOL}
              </h1>
              {tokens.length > 1 && (
                <p className="text-xs text-text-muted mt-1 font-mono">
                  + {tokens.length - 1} other token{tokens.length - 1 > 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-subtle">
        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 py-2.5 text-sm font-display font-semibold transition-colors ${
            activeTab === 'tokens'
              ? 'text-rose border-b-2 border-rose'
              : 'text-text-muted hover:text-text-body'
          }`}
        >
          Tokens
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2.5 text-sm font-display font-semibold transition-colors ${
            activeTab === 'activity'
              ? 'text-rose border-b-2 border-rose'
              : 'text-text-muted hover:text-text-body'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-6 h-6 animate-spin text-text-muted" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : activeTab === 'tokens' ? (
          tokens.length > 0 ? (
            <TokenList tokens={tokens} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-sm text-text-muted">No tokens found</p>
            </div>
          )
        ) : (
          <div className="flex flex-col">
            {transactions.length > 0 ? (
              transactions.map((tx, i) => (
                <TransactionItem key={`${tx.signature}-${i}`} tx={tx} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <p className="text-sm text-text-muted">No transactions yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
