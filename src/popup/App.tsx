import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import Home from "./pages/Home";
import Send from "./pages/Send";
import Receive from "./pages/Receive";
import Settings from "./pages/Settings";
import Bridge from "./pages/Bridge";
import Onboarding from "./pages/Onboarding";
import Lock from "./pages/Lock";
import ConnectApproval from "./pages/ConnectApproval";
import type { NetworkId } from "../lib/wallet";
import { keypairFromMnemonic } from "../lib/wallet";

type Page = "home" | "send" | "receive" | "settings" | "bridge";

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<NetworkId>("mythic-mainnet");
  const [connectedSites, setConnectedSites] = useState<string[]>([]);
  const [pendingConnect, setPendingConnect] = useState<{ origin: string; timestamp: number } | null>(null);

  useEffect(() => {
    // Check stored state from chrome.storage
    chrome.storage.local.get("mythic_state", (result) => {
      const state = result.mythic_state;
      if (state && state.hasWallet) {
        setHasWallet(true);
        setIsLocked(state.isLocked);
        setNetwork(state.activeNetwork || "mythic-mainnet");
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

    // Check for pending dApp connect requests
    chrome.runtime.sendMessage(
      { type: "MYTHIC_GET_PENDING_CONNECT" },
      (response) => {
        if (response && response.origin) {
          setPendingConnect(response);
        }
      }
    );
  }, []);

  // Handle dApp approval
  const handleApproveConnect = () => {
    if (!pendingConnect) return;
    chrome.runtime.sendMessage(
      { type: "MYTHIC_APPROVE_CONNECT", origin: pendingConnect.origin },
      () => {
        setConnectedSites((prev) =>
          prev.includes(pendingConnect.origin)
            ? prev
            : [...prev, pendingConnect.origin]
        );
        setPendingConnect(null);
      }
    );
  };

  const handleRejectConnect = () => {
    chrome.runtime.sendMessage({ type: "MYTHIC_REJECT_CONNECT" }, () => {
      setPendingConnect(null);
    });
  };

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

  // dApp connection approval prompt — shown before wallet UI
  if (pendingConnect) {
    return (
      <div className="h-full bg-surface-base">
        <ConnectApproval
          origin={pendingConnect.origin}
          onApprove={handleApproveConnect}
          onReject={handleRejectConnect}
        />
      </div>
    );
  }

  // Waiting for address to load from storage
  if (!address) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-base">
        <svg
          viewBox="0 0 100 100"
          className="w-12 h-12 animate-pulse"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="50,8 20,44 50,56" fill="#FF2D78" opacity="0.92" />
          <polygon points="50,8 80,44 50,56" fill="#FF5C96" opacity="0.78" />
          <polygon points="20,44 50,56 80,44 50,92" fill="#CC2460" opacity="0.88" />
        </svg>
      </div>
    );
  }

  const handleLock = () => {
    setIsLocked(true);
    setPage("home");
    chrome.storage.session?.remove("mythic_session_key").catch(() => {});
    chrome.storage.local.get("mythic_state", (result) => {
      const state = result.mythic_state || {};
      chrome.storage.local.set({
        mythic_state: { ...state, isLocked: true },
      });
    });
  };

  const handleNetworkChange = (newNetwork: NetworkId) => {
    setNetwork(newNetwork);
    chrome.storage.local.get("mythic_state", (result) => {
      const state = result.mythic_state || {};
      chrome.storage.local.set({
        mythic_state: { ...state, activeNetwork: newNetwork },
      });
    });
  };

  const handleDisconnectSite = (site: string) => {
    const updated = connectedSites.filter((s) => s !== site);
    setConnectedSites(updated);
    chrome.storage.local.get("mythic_state", (result) => {
      const state = result.mythic_state || {};
      chrome.storage.local.set({
        mythic_state: { ...state, connectedSites: updated },
      });
    });
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
