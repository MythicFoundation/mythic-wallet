import '../polyfills';
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Home from './pages/Home';
import Send from './pages/Send';
import Receive from './pages/Receive';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import Lock from './pages/Lock';
import UpdateBanner from './components/UpdateBanner';
import type { NetworkId, TokenBalance, TransactionRecord } from '../lib/wallet';
import { getConnection, getTokenBalances, getTransactionHistory, getSolPrice, getMythPrice } from '../lib/wallet';

type Page = 'home' | 'send' | 'receive' | 'bridge' | 'settings';

const DEMO_MODE = typeof chrome === 'undefined' || !chrome.storage;

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<NetworkId>('mythic-mainnet');
  const [connectedSites, setConnectedSites] = useState<string[]>([]);

  // Real data state
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [solPrice, setSolPrice] = useState(0);
  const [mythPrice, setMythPrice] = useState(0);

  useEffect(() => {
    if (DEMO_MODE) {
      setHasWallet(false);
      return;
    }
    chrome.storage.local.get('mythic_state', (result) => {
      const state = result.mythic_state;
      if (state && state.hasWallet) {
        setHasWallet(true);
        setIsLocked(state.isLocked);
        setNetwork(state.activeNetwork || 'mythic-mainnet');
        setConnectedSites(state.connectedSites || []);
      } else {
        setHasWallet(false);
      }
    });
    chrome.storage.local.get('mythic_wallet', (result) => {
      const wallet = result.mythic_wallet;
      if (wallet) setAddress(wallet.publicKey);
    });
  }, []);

  // Fetch real balances & transactions when address or network changes
  const isL2 = network.startsWith('mythic');

  const fetchData = useCallback(async () => {
    if (!address || isLocked) return;
    setLoading(true);
    try {
      const conn = getConnection(network);
      const [tokenList, txList, solUsd, mythUsd] = await Promise.all([
        getTokenBalances(conn, address, network),
        getTransactionHistory(conn, address, 20),
        getSolPrice(),
        isL2 ? getMythPrice() : Promise.resolve({ priceUsd: 0, priceSOL: 0 }),
      ]);
      setSolPrice(solUsd);
      setMythPrice(mythUsd.priceUsd);

      // Enrich tokens with USD values
      const enriched = tokenList.map((t) => {
        if (t.usdValue > 0) return t; // Already priced (e.g. Helius DAS)
        // MYTH native on L2 or MYTH SPL token
        if (t.symbol === 'MYTH') {
          return { ...t, usdValue: t.balance * mythUsd.priceUsd };
        }
        if (t.symbol === 'SOL' || t.symbol === 'wSOL' || t.symbol === 'mSOL') {
          return { ...t, usdValue: t.balance * solUsd };
        }
        if (t.symbol === 'USDC' || t.symbol === 'USDT') {
          return { ...t, usdValue: t.balance };
        }
        // L2 wBTC/wETH — no price feed yet, skip
        return t;
      });

      setTokens(enriched);
      setTransactions(txList);
    } catch (e) {
      console.error('Fetch failed:', e);
    }
    setLoading(false);
  }, [address, network, isLocked, isL2]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30s
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Loading
  if (hasWallet === null) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-base">
        <svg viewBox="0 0 100 100" className="w-12 h-12 animate-pulse" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,8 20,44 50,56" fill="#FF2D78" opacity="0.92"/>
          <polygon points="50,8 80,44 50,56" fill="#FF5C96" opacity="0.78"/>
          <polygon points="20,44 50,56 80,44 50,92" fill="#CC2460" opacity="0.88"/>
        </svg>
      </div>
    );
  }

  // Onboarding
  if (!hasWallet) {
    return (
      <div className="h-full bg-surface-base">
        <Onboarding
          onComplete={(pubkey) => {
            setAddress(pubkey);
            setHasWallet(true);
            setIsLocked(false);
          }}
        />
      </div>
    );
  }

  // Lock
  if (isLocked) {
    return (
      <div className="h-full bg-surface-base">
        <Lock
          onUnlock={async (password) => {
            if (DEMO_MODE) { setIsLocked(false); return true; }
            try {
              const { unlockWallet } = await import('../lib/storage');
              const secret = await unlockWallet(password);
              if (secret) { setIsLocked(false); return true; }
              return false;
            } catch { return false; }
          }}
        />
      </div>
    );
  }

  const handleLock = () => {
    setIsLocked(true);
    setPage('home');
    if (!DEMO_MODE) {
      chrome.storage.local.get('mythic_state', (result) => {
        const state = result.mythic_state || {};
        chrome.storage.local.set({ mythic_state: { ...state, isLocked: true } });
      });
    }
  };

  const handleNetworkChange = (newNetwork: NetworkId) => {
    setNetwork(newNetwork);
    setTokens([]);
    setTransactions([]);
    if (!DEMO_MODE) {
      chrome.storage.local.get('mythic_state', (result) => {
        const state = result.mythic_state || {};
        chrome.storage.local.set({ mythic_state: { ...state, activeNetwork: newNetwork } });
      });
    }
  };

  const handleDisconnectSite = (site: string) => {
    setConnectedSites((prev) => prev.filter((s) => s !== site));
  };

  const renderPage = () => {
    switch (page) {
      case 'send':
        return (
          <Send
            address={address}
            network={network}
            tokens={tokens}
            solPrice={solPrice}
            mythPrice={mythPrice}
            onBack={() => setPage('home')}
            onSent={() => { setPage('home'); fetchData(); }}
          />
        );
      case 'receive':
        return <Receive address={address} network={network} onBack={() => setPage('home')} />;
      case 'bridge':
        return (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
              <button onClick={() => setPage('home')} className="p-1 hover:bg-surface-hover">
                <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="font-display text-base font-bold">Bridge</h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <svg className="w-16 h-16 text-rose mb-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              <h2 className="font-display text-xl font-bold text-text-heading mb-2">Coming Soon</h2>
              <p className="text-sm text-text-muted text-center">
                Bridge between Solana L1 and Mythic L2 directly from your wallet.
              </p>
              <p className="text-xs text-text-disabled text-center mt-2">
                Use <span className="text-rose">mythic.sh/bridge</span> in the meantime.
              </p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <Settings
            network={network}
            connectedSites={connectedSites}
            onBack={() => setPage('home')}
            onNetworkChange={handleNetworkChange}
            onLock={handleLock}
            onDisconnectSite={handleDisconnectSite}
          />
        );
      default:
        return (
          <Home
            tokens={tokens}
            transactions={transactions}
            loading={loading}
            solPrice={solPrice}
            mythPrice={mythPrice}
            network={network}
            onSend={() => setPage('send')}
            onReceive={() => setPage('receive')}
            onBridge={() => setPage('bridge')}
            onRefresh={fetchData}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {page === 'home' && (
        <>
          <Header
            address={address}
            network={network}
            onSettingsClick={() => setPage('settings')}
            onCopyAddress={() => {}}
          />
          <UpdateBanner />
        </>
      )}
      <div className="flex-1 overflow-hidden">
        {renderPage()}
      </div>
    </div>
  );
}
