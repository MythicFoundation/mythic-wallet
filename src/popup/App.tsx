import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import Home from "./pages/Home";
import Send from "./pages/Send";
import Receive from "./pages/Receive";
import Settings from "./pages/Settings";
import Bridge from "./pages/Bridge";
import Onboarding from "./pages/Onboarding";
import Lock from "./pages/Lock";
import type { NetworkId } from "../lib/wallet";
import { keypairFromMnemonic } from "../lib/wallet";

type Page = "home" | "send" | "receive" | "settings" | "bridge";

// Demo mode: skip chrome.storage for development
const DEMO_MODE = typeof chrome === "undefined" || !chrome.storage;
const DEMO_ADDRESS = "DLB2NZ5PSNAoChQAaUCBwoHCf6vzeStDa6kCYbB8HjSg";

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [address, setAddress] = useState(DEMO_ADDRESS);
  const [network, setNetwork] = useState<NetworkId>("mythic-testnet");
  const [connectedSites, setConnectedSites] = useState<string[]>([]);

  useEffect(() => {
    if (DEMO_MODE) {
      setHasWallet(true);
      setIsLocked(false);
      return;
    }
    // Check stored state
    chrome.storage.local.get("mythic_state", (result) => {
      const state = result.mythic_state;
      if (state && state.hasWallet) {
        setHasWallet(true);
        setIsLocked(state.isLocked);
        setNetwork(state.activeNetwork || "mythic-testnet");
        setConnectedSites(state.connectedSites || []);
      } else {
        setHasWallet(false);
      }
    });
    chrome.storage.local.get("mythic_wallet", (result) => {
      const wallet = result.mythic_wallet;
      if (wallet) {
        setAddress(wallet.publicKey);
      }
    });
  }, []);

  // Loading state
  if (hasWallet === null) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-base">
        <svg
          viewBox="0 0 100 100"
          className="w-12 h-12 animate-pulse"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="50,8 20,44 50,56"
            fill="#FF2D78"
            opacity="0.92"
          />
          <polygon
            points="50,8 80,44 50,56"
            fill="#FF5C96"
            opacity="0.78"
          />
          <polygon
            points="20,44 50,56 80,44 50,92"
            fill="#CC2460"
            opacity="0.88"
          />
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

  // Lock screen
  if (isLocked) {
    return (
      <div className="h-full bg-surface-base">
        <Lock
          onUnlock={async (password) => {
            if (DEMO_MODE) {
              setIsLocked(false);
              return true;
            }
            try {
              const { unlockWallet } = await import("../lib/storage");
              const mnemonic = await unlockWallet(password);
              if (mnemonic) {
                try {
                  const account = await keypairFromMnemonic(mnemonic);
                  await chrome.storage.session.set({
                    mythic_session_key: Array.from(account.secretKey),
                  });
                } catch {}
                setIsLocked(false);
                return true;
              }
              return false;
            } catch {
              return false;
            }
          }}
        />
      </div>
    );
  }

  const handleLock = () => {
    setIsLocked(true);
    setPage("home");
    if (!DEMO_MODE) {
      chrome.storage.session?.remove("mythic_session_key").catch(() => {});
      chrome.storage.local.get("mythic_state", (result) => {
        const state = result.mythic_state || {};
        chrome.storage.local.set({
          mythic_state: { ...state, isLocked: true },
        });
      });
    }
  };

  const handleNetworkChange = (newNetwork: NetworkId) => {
    setNetwork(newNetwork);
    if (!DEMO_MODE) {
      chrome.storage.local.get("mythic_state", (result) => {
        const state = result.mythic_state || {};
        chrome.storage.local.set({
          mythic_state: { ...state, activeNetwork: newNetwork },
        });
      });
    }
  };

  const handleDisconnectSite = (site: string) => {
    const updated = connectedSites.filter((s) => s !== site);
    setConnectedSites(updated);
    if (!DEMO_MODE) {
      chrome.storage.local.get("mythic_state", (result) => {
        const state = result.mythic_state || {};
        chrome.storage.local.set({
          mythic_state: { ...state, connectedSites: updated },
        });
      });
    }
  };

  const renderPage = () => {
    switch (page) {
      case "send":
        return (
          <Send
            address={address}
            network={network}
            onBack={() => setPage("home")}
          />
        );
      case "receive":
        return (
          <Receive address={address} onBack={() => setPage("home")} />
        );
      case "bridge":
        return (
          <Bridge
            address={address}
            network={network}
            onBack={() => setPage("home")}
          />
        );
      case "settings":
        return (
          <Settings
            network={network}
            connectedSites={connectedSites}
            onBack={() => setPage("home")}
            onNetworkChange={handleNetworkChange}
            onLock={handleLock}
            onDisconnectSite={handleDisconnectSite}
          />
        );
      default:
        return (
          <Home
            address={address}
            network={network}
            onSend={() => setPage("send")}
            onReceive={() => setPage("receive")}
            onBridge={() => setPage("bridge")}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {page === "home" && (
        <Header
          address={address}
          network={network}
          onSettingsClick={() => setPage("settings")}
          onCopyAddress={() => {}}
        />
      )}
      <div className="flex-1 overflow-hidden">{renderPage()}</div>
    </div>
  );
}
