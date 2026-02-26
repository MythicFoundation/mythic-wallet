// Mythic Wallet — Background Service Worker (Manifest V3)

import { Keypair, Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import nacl from "tweetnacl";

// Auto-lock wallet after 5 minutes of inactivity
const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000;
let lockTimer: ReturnType<typeof setTimeout> | null = null;

function resetLockTimer() {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(async () => {
    const result = await chrome.storage.local.get("mythic_state");
    const state = result.mythic_state;
    if (state && state.hasWallet && !state.isLocked) {
      await chrome.storage.local.set({
        mythic_state: { ...state, isLocked: true },
      });
      await chrome.storage.session?.remove("mythic_session_key").catch(() => {});
    }
  }, AUTO_LOCK_TIMEOUT);
}

async function getSessionKeypair(): Promise<Keypair | null> {
  try {
    const result = await chrome.storage.session.get("mythic_session_key");
    if (result.mythic_session_key) {
      const secretKeyArray = new Uint8Array(
        Object.values(result.mythic_session_key)
      );
      return Keypair.fromSecretKey(secretKeyArray);
    }
  } catch {
    // session storage not available
  }
  return null;
}

async function getNetworkRpcUrl(): Promise<string> {
  try {
    const result = await chrome.storage.local.get("mythic_state");
    const state = result.mythic_state;
    const network = state?.activeNetwork || "mythic-mainnet";
    if (network === "mythic-testnet") return "https://testnet.mythic.sh";
    return "https://rpc.mythic.sh";
  } catch {
    return "https://rpc.mythic.sh";
  }
}

async function signTransactionWithKeypair(
  transactionData: string
): Promise<{ signedTransaction?: string; error?: string }> {
  const keypair = await getSessionKeypair();
  if (!keypair) {
    return { error: "Wallet is locked. Please unlock to sign transactions." };
  }

  try {
    const txBuffer = Buffer.from(transactionData, "base64");

    // Try as versioned transaction first
    try {
      const versionedTx = VersionedTransaction.deserialize(txBuffer);
      versionedTx.sign([keypair]);
      return {
        signedTransaction: Buffer.from(versionedTx.serialize()).toString(
          "base64"
        ),
      };
    } catch {
      // Not a versioned transaction, try legacy
    }

    // Try as legacy transaction
    try {
      const tx = Transaction.from(txBuffer);
      tx.partialSign(keypair);
      return {
        signedTransaction: Buffer.from(tx.serialize()).toString("base64"),
      };
    } catch {
      // Not a serialized transaction
    }

    return {
      error:
        "Unsupported transaction format. Please provide a base64-serialized transaction.",
    };
  } catch (err: any) {
    return { error: err?.message || "Failed to sign transaction" };
  }
}

async function signMessageWithKeypair(
  messageData: string | number[]
): Promise<{ signature?: number[]; error?: string }> {
  const keypair = await getSessionKeypair();
  if (!keypair) {
    return { error: "Wallet is locked. Please unlock to sign messages." };
  }

  try {
    let messageBytes: Uint8Array;
    if (typeof messageData === "string") {
      messageBytes = new TextEncoder().encode(messageData);
    } else {
      messageBytes = new Uint8Array(messageData);
    }

    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    return { signature: Array.from(signature) };
  } catch (err: any) {
    return { error: err?.message || "Failed to sign message" };
  }
}

async function sendSignedTransaction(
  signedTxBase64: string
): Promise<{ signature?: string; error?: string }> {
  try {
    const rpcUrl = await getNetworkRpcUrl();
    const connection = new Connection(rpcUrl, "confirmed");
    const txBuffer = Buffer.from(signedTxBase64, "base64");
    const signature = await connection.sendRawTransaction(txBuffer);
    return { signature };
  } catch (err: any) {
    return { error: err?.message || "Failed to send transaction" };
  }
}

// Wait for popup to approve/reject a pending connect request
function waitForConnectDecision(origin: string): Promise<{ publicKey?: string; error?: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const pollInterval = setInterval(async () => {
      try {
        const pending = await chrome.storage.session.get("mythic_pending_connect");
        if (!pending.mythic_pending_connect) {
          // Request was handled (approved or rejected)
          clearInterval(pollInterval);
          const updatedState = await chrome.storage.local.get("mythic_state");
          const currentState = updatedState.mythic_state;
          if (currentState?.connectedSites?.includes(origin)) {
            const wallet = await chrome.storage.local.get("mythic_wallet");
            resolve({ publicKey: wallet.mythic_wallet?.publicKey });
          } else {
            resolve({ error: "Connection rejected by user" });
          }
          return;
        }
        if (Date.now() - startTime > 30000) {
          clearInterval(pollInterval);
          await chrome.storage.session.remove("mythic_pending_connect").catch(() => {});
          resolve({ error: "Connection request timed out" });
        }
      } catch {
        clearInterval(pollInterval);
        resolve({ error: "Connection error" });
      }
    }, 500);
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  resetLockTimer();

  if (message.type === "MYTHIC_GET_STATE") {
    chrome.storage.local.get("mythic_state", (result) => {
      sendResponse(
        result.mythic_state || { hasWallet: false, isLocked: true }
      );
    });
    return true;
  }

  if (message.type === "MYTHIC_GET_PENDING_CONNECT") {
    chrome.storage.session.get("mythic_pending_connect", (result) => {
      sendResponse(result.mythic_pending_connect || null);
    });
    return true;
  }

  if (message.type === "MYTHIC_APPROVE_CONNECT") {
    (async () => {
      try {
        const result = await chrome.storage.local.get("mythic_state");
        const state = result.mythic_state;
        if (!state) { sendResponse({ error: "No state" }); return; }
        const origin = message.origin;
        if (origin && !state.connectedSites?.includes(origin)) {
          const updated = {
            ...state,
            connectedSites: [...(state.connectedSites || []), origin],
          };
          await chrome.storage.local.set({ mythic_state: updated });
        }
        // Clear the pending request — this unblocks the polling in MYTHIC_CONNECT
        await chrome.storage.session?.remove("mythic_pending_connect").catch(() => {});
        const wallet = await chrome.storage.local.get("mythic_wallet");
        sendResponse({ publicKey: wallet.mythic_wallet?.publicKey });
      } catch {
        sendResponse({ error: "Failed to approve connection" });
      }
    })();
    return true;
  }

  if (message.type === "MYTHIC_REJECT_CONNECT") {
    (async () => {
      // Clear without adding to connectedSites — polling will see rejection
      await chrome.storage.session?.remove("mythic_pending_connect").catch(() => {});
      sendResponse({ rejected: true });
    })();
    return true;
  }

  if (message.type === "MYTHIC_CONNECT") {
    (async () => {
      try {
        const result = await chrome.storage.local.get("mythic_state");
        const state = result.mythic_state;
        if (!state || !state.hasWallet || state.isLocked) {
          sendResponse({ error: "Wallet is locked or not set up" });
          return;
        }
        const origin = message.origin || sender.origin;

        // If site is already connected, auto-approve
        if (origin && state.connectedSites?.includes(origin)) {
          const wallet = await chrome.storage.local.get("mythic_wallet");
          sendResponse({ publicKey: wallet.mythic_wallet?.publicKey });
          return;
        }

        // Store pending connect request and open popup for approval
        await chrome.storage.session.set({
          mythic_pending_connect: { origin, timestamp: Date.now() },
        });

        // Try to open the popup to prompt user for approval
        try {
          await chrome.action.openPopup();
        } catch {
          // openPopup may not be supported in all contexts
        }

        // Wait for the user to approve or reject via the popup
        const decision = await waitForConnectDecision(origin);
        sendResponse(decision);
      } catch {
        sendResponse({ error: "Connection error" });
      }
    })();
    return true;
  }

  if (message.type === "MYTHIC_DISCONNECT") {
    chrome.storage.local.get("mythic_state", async (result) => {
      const state = result.mythic_state;
      if (state) {
        const origin = message.origin || sender.origin;
        const updated = {
          ...state,
          connectedSites: (state.connectedSites || []).filter(
            (s: string) => s !== origin
          ),
        };
        await chrome.storage.local.set({ mythic_state: updated });
      }
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "MYTHIC_SIGN_TRANSACTION") {
    chrome.storage.local.get("mythic_state", async (result) => {
      const state = result.mythic_state;
      if (!state || !state.hasWallet || state.isLocked) {
        sendResponse({ error: "Wallet is locked. Please unlock first." });
        return;
      }
      const origin = message.origin;
      if (origin && !state.connectedSites?.includes(origin)) {
        sendResponse({ error: "Site not connected. Call connect() first." });
        return;
      }
      const result2 = await signTransactionWithKeypair(message.transaction);
      sendResponse(result2);
    });
    return true;
  }

  if (message.type === "MYTHIC_SIGN_MESSAGE") {
    chrome.storage.local.get("mythic_state", async (result) => {
      const state = result.mythic_state;
      if (!state || !state.hasWallet || state.isLocked) {
        sendResponse({ error: "Wallet is locked. Please unlock first." });
        return;
      }
      const origin = message.origin;
      if (origin && !state.connectedSites?.includes(origin)) {
        sendResponse({ error: "Site not connected. Call connect() first." });
        return;
      }
      const result2 = await signMessageWithKeypair(message.message);
      sendResponse(result2);
    });
    return true;
  }

  if (message.type === "MYTHIC_SEND_TRANSACTION") {
    (async () => {
      const result = await sendSignedTransaction(message.signedTransaction);
      sendResponse(result);
    })();
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  resetLockTimer();
});

chrome.runtime.onStartup.addListener(() => {
  resetLockTimer();
});
