import React, { useState, useEffect, useCallback } from "react";
import { Keypair } from "@solana/web3.js";
import Button from "../components/Button";
import {
  truncateAddress,
  getConnection,
  getBalance,
  sendSol,
  NATIVE_TOKEN_SYMBOL,
  NATIVE_TOKEN_NAME,
  NATIVE_TOKEN_MINT,
  type NetworkId,
  type TokenBalance,
} from "../../lib/wallet";

interface SendProps {
  address: string;
  network: NetworkId;
  onBack: () => void;
}

export default function Send({ address, network, onBack }: SendProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenBalance>({
    symbol: NATIVE_TOKEN_SYMBOL,
    name: NATIVE_TOKEN_NAME,
    mint: NATIVE_TOKEN_MINT,
    balance: 0,
    usdValue: 0,
    icon: NATIVE_TOKEN_SYMBOL,
    change24h: 0,
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [txSignature, setTxSignature] = useState("");
  const [error, setError] = useState("");
  const [loadingBalance, setLoadingBalance] = useState(true);

  const estimatedFee = 0.000005;
  const isValid =
    recipient.length >= 32 &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= selectedToken.balance;

  // Fetch real balance on mount
  useEffect(() => {
    (async () => {
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
        setTokens([nativeToken]);
        setSelectedToken(nativeToken);
      } catch {
        // keep defaults
      } finally {
        setLoadingBalance(false);
      }
    })();
  }, [address, network]);

  const handleMax = () => {
    if (selectedToken.mint === NATIVE_TOKEN_MINT) {
      setAmount(Math.max(0, selectedToken.balance - 0.01).toFixed(6));
    } else {
      setAmount(selectedToken.balance.toString());
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError("");

    try {
      // Get session keypair from chrome.storage.session
      const sessionResult = await chrome.storage.session.get(
        "mythic_session_key"
      );
      let keypair: Keypair;

      if (sessionResult.mythic_session_key) {
        // Secret key stored in session during unlock
        const secretKeyArray = new Uint8Array(
          Object.values(sessionResult.mythic_session_key)
        );
        keypair = Keypair.fromSecretKey(secretKeyArray);
      } else {
        // Session expired
        throw new Error(
          "Session expired. Please lock and unlock your wallet to re-authenticate."
        );
      }

      const connection = getConnection(network);
      const signature = await sendSol(
        connection,
        keypair,
        recipient,
        parseFloat(amount)
      );
      setTxSignature(`${signature.slice(0, 6)}...${signature.slice(-4)}`);
      setSending(false);
      setSent(true);
      setTimeout(onBack, 3000);
    } catch (err: any) {
      setSending(false);
      setError(err?.message || "Transaction failed");
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="w-16 h-16 flex items-center justify-center bg-success/10 mb-4">
          <svg
            className="w-8 h-8 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-text-heading mb-2">
          Transaction Sent
        </h2>
        <p className="text-sm text-text-muted text-center">
          {amount} {selectedToken.symbol} sent to{" "}
          {truncateAddress(recipient, 6)}
        </p>
        {txSignature && (
          <p className="text-[10px] text-text-muted font-mono mt-2">
            {txSignature}
          </p>
        )}
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
          <button
            onClick={() => setShowConfirm(false)}
            className="p-1 hover:bg-surface-hover"
          >
            <svg
              className="w-5 h-5 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h2 className="font-display text-base font-bold">
            Confirm Transaction
          </h2>
        </div>

        <div className="flex-1 px-4 pt-6">
          <div className="bg-surface-elevated border border-subtle p-4 mb-4">
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">From</span>
              <span className="font-mono text-xs text-text-body">
                {truncateAddress(address, 6)}
              </span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">To</span>
              <span className="font-mono text-xs text-text-body">
                {truncateAddress(recipient, 6)}
              </span>
            </div>
            <div className="border-t border-subtle my-3" />
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">Amount</span>
              <span className="font-mono text-sm font-semibold text-text-heading">
                {amount} {selectedToken.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-text-muted">Network Fee</span>
              <span className="font-mono text-xs text-text-body">
                ~{estimatedFee} {NATIVE_TOKEN_SYMBOL}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-error/10 border border-error/20 px-3 py-2 mb-4">
              <p className="text-xs text-error">{error}</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Sending...
              </span>
            ) : (
              "Confirm & Send"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
        <button onClick={onBack} className="p-1 hover:bg-surface-hover">
          <svg
            className="w-5 h-5 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h2 className="font-display text-base font-bold">Send</h2>
      </div>

      <div className="flex-1 px-4 pt-4 space-y-4">
        {/* Token Selector */}
        <div>
          <label className="block text-xs text-text-muted mb-1.5 font-sans">
            Token
          </label>
          {loadingBalance ? (
            <div className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-muted">
              Loading balances...
            </div>
          ) : (
            <select
              value={selectedToken.symbol}
              onChange={(e) => {
                const t = tokens.find((t) => t.symbol === e.target.value);
                if (t) setSelectedToken(t);
              }}
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading font-display focus:outline-none focus:border-rose appearance-none"
            >
              {tokens.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} —{" "}
                  {t.balance.toLocaleString("en-US", {
                    maximumFractionDigits: 6,
                  })}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-xs text-text-muted mb-1.5 font-sans">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter Mythic address..."
            className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
          />
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-text-muted font-sans">Amount</label>
            <button
              onClick={handleMax}
              className="text-[10px] text-rose font-display font-semibold hover:text-rose-light"
            >
              MAX
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-display">
              {selectedToken.symbol}
            </span>
          </div>
        </div>

        {/* Fee */}
        <div className="bg-surface-elevated border border-subtle px-3 py-2 flex justify-between">
          <span className="text-xs text-text-muted">Estimated Fee</span>
          <span className="text-xs font-mono text-text-body">
            ~{estimatedFee} {NATIVE_TOKEN_SYMBOL}
          </span>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 px-3 py-2">
            <p className="text-xs text-error">{error}</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <Button
          variant="primary"
          fullWidth
          size="lg"
          disabled={!isValid}
          onClick={() => {
            setError("");
            setShowConfirm(true);
          }}
        >
          Review Transaction
        </Button>
      </div>
    </div>
  );
}
