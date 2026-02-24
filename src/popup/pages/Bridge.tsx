import React, { useState, useEffect, useCallback } from "react";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import Button from "../components/Button";
import {
  getConnection,
  getBalance,
  truncateAddress,
  NATIVE_TOKEN_SYMBOL,
  type NetworkId,
} from "../../lib/wallet";

const DEMO_MODE = typeof chrome === "undefined" || !chrome.storage;

// Bridge program on L1 (Solana mainnet / devnet)
const L1_BRIDGE_PROGRAM_ID = new PublicKey(
  "oEQfREm4FQkaVeRoxJHkJLB1feHprrntY6eJuW2zbqQ"
);

// L2 Bridge program
const L2_BRIDGE_PROGRAM_ID = new PublicKey(
  "MythBrdgL2111111111111111111111111111111111"
);

// PDA seeds
const BRIDGE_CONFIG_SEED = Buffer.from("bridge_config");
const SOL_VAULT_SEED = Buffer.from("sol_vault");

// Instruction discriminators
const IX_DEPOSIT_SOL = 2;

// Solana L1 RPC (devnet for testing, mainnet for production)
const L1_RPC_URL = "https://api.mainnet-beta.solana.com";

type BridgeDirection = "deposit" | "withdraw";

interface BridgeProps {
  address: string;
  network: NetworkId;
  onBack: () => void;
}

export default function Bridge({ address, network, onBack }: BridgeProps) {
  const [direction, setDirection] = useState<BridgeDirection>("deposit");
  const [amount, setAmount] = useState("");
  const [l2Balance, setL2Balance] = useState(0);
  const [l1Balance, setL1Balance] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(!DEMO_MODE);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [txSignature, setTxSignature] = useState("");
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const estimatedFee = 0.000005;
  const minDeposit = 0.01;

  // Fetch balances on both networks
  const fetchBalances = useCallback(async () => {
    if (DEMO_MODE) {
      setL2Balance(142.58);
      setL1Balance(5.25);
      return;
    }
    try {
      // L2 balance
      const l2Connection = getConnection(network);
      const l2Bal = await getBalance(l2Connection, address);
      setL2Balance(l2Bal);
    } catch {
      setL2Balance(0);
    }
    try {
      // L1 balance
      const l1Connection = new Connection(L1_RPC_URL, "confirmed");
      const l1Bal = await l1Connection.getBalance(new PublicKey(address));
      setL1Balance(l1Bal / LAMPORTS_PER_SOL);
    } catch {
      setL1Balance(0);
    }
    setLoadingBalances(false);
  }, [address, network]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const sourceBalance = direction === "deposit" ? l1Balance : l2Balance;
  const sourceNetwork = direction === "deposit" ? "Solana L1" : "Mythic L2";
  const destNetwork = direction === "deposit" ? "Mythic L2" : "Solana L1";
  const amountNum = parseFloat(amount) || 0;
  const isValid =
    amountNum >= minDeposit &&
    amountNum <= sourceBalance &&
    sourceBalance > 0;

  const handleMax = () => {
    const max = Math.max(0, sourceBalance - 0.01);
    setAmount(max.toFixed(6));
  };

  const buildDepositSOLTransaction = async (): Promise<Transaction> => {
    const l1Connection = new Connection(L1_RPC_URL, "confirmed");
    const depositorPubkey = new PublicKey(address);

    // Derive PDAs
    const [configPda] = PublicKey.findProgramAddressSync(
      [BRIDGE_CONFIG_SEED],
      L1_BRIDGE_PROGRAM_ID
    );
    const [solVaultPda] = PublicKey.findProgramAddressSync(
      [SOL_VAULT_SEED],
      L1_BRIDGE_PROGRAM_ID
    );

    // Build instruction data: [discriminator(1)] [amount(8)] [l2_recipient(32)]
    const lamports = BigInt(Math.round(amountNum * LAMPORTS_PER_SOL));
    const data = Buffer.alloc(1 + 8 + 32);
    data.writeUInt8(IX_DEPOSIT_SOL, 0);
    data.writeBigUInt64LE(lamports, 1);
    // l2_recipient = depositor pubkey bytes (same address on both chains)
    depositorPubkey.toBuffer().copy(data, 9);

    const instruction = new TransactionInstruction({
      programId: L1_BRIDGE_PROGRAM_ID,
      keys: [
        { pubkey: depositorPubkey, isSigner: true, isWritable: true },
        { pubkey: solVaultPda, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const { blockhash } = await l1Connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.add(instruction);
    tx.recentBlockhash = blockhash;
    tx.feePayer = depositorPubkey;

    return tx;
  };

  const handleBridge = async () => {
    setSending(true);
    setError("");

    if (DEMO_MODE) {
      await new Promise((r) => setTimeout(r, 2500));
      setTxSignature("demo...bridge...sig");
      setSending(false);
      setSent(true);
      return;
    }

    try {
      if (direction === "deposit") {
        // Build deposit transaction targeting L1 bridge
        const tx = await buildDepositSOLTransaction();

        // Get the session keypair to sign
        const sessionResult = await chrome.storage.session.get(
          "mythic_session_key"
        );
        let keypair: Keypair;
        if (sessionResult.mythic_session_key) {
          const secretKeyArray = new Uint8Array(
            Object.values(sessionResult.mythic_session_key)
          );
          keypair = Keypair.fromSecretKey(secretKeyArray);
        } else {
          throw new Error(
            "Session expired. Please lock and unlock your wallet."
          );
        }

        tx.sign(keypair);

        const l1Connection = new Connection(L1_RPC_URL, "confirmed");
        const signature = await l1Connection.sendRawTransaction(
          tx.serialize()
        );
        await l1Connection.confirmTransaction(signature);

        setTxSignature(
          `${signature.slice(0, 8)}...${signature.slice(-6)}`
        );
      } else {
        // Withdraw: send SOL to the L2 bridge program reserve
        // The relayer picks up BurnSOL events and initiates L1 withdrawals
        const l2Connection = getConnection(network);
        const depositorPubkey = new PublicKey(address);

        // Simple system transfer to the L2 bridge reserve PDA
        // The bridge-l2 program processes this as a burn/withdraw request
        const lamports = Math.round(amountNum * LAMPORTS_PER_SOL);

        // For now, send to the bridge reserve PDA
        const [reservePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("bridge_reserve")],
          L2_BRIDGE_PROGRAM_ID
        );

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: depositorPubkey,
            toPubkey: reservePda,
            lamports,
          })
        );

        const { blockhash } = await l2Connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = depositorPubkey;

        const sessionResult = await chrome.storage.session.get(
          "mythic_session_key"
        );
        let keypair: Keypair;
        if (sessionResult.mythic_session_key) {
          const secretKeyArray = new Uint8Array(
            Object.values(sessionResult.mythic_session_key)
          );
          keypair = Keypair.fromSecretKey(secretKeyArray);
        } else {
          throw new Error(
            "Session expired. Please lock and unlock your wallet."
          );
        }

        tx.sign(keypair);
        const signature = await l2Connection.sendRawTransaction(
          tx.serialize()
        );
        await l2Connection.confirmTransaction(signature);

        setTxSignature(
          `${signature.slice(0, 8)}...${signature.slice(-6)}`
        );
      }

      setSending(false);
      setSent(true);
    } catch (err: any) {
      setSending(false);
      setError(err?.message || "Bridge transaction failed");
    }
  };

  // Success screen
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
          {direction === "deposit" ? "Deposit Submitted" : "Withdrawal Submitted"}
        </h2>
        <p className="text-sm text-text-muted text-center mb-1">
          {amountNum} SOL from {sourceNetwork} to {destNetwork}
        </p>
        <p className="text-xs text-text-muted text-center mb-4">
          {direction === "deposit"
            ? "Funds will appear on Mythic L2 within ~2 minutes"
            : "Withdrawal subject to 7-day challenge period"}
        </p>
        {txSignature && (
          <p className="text-[10px] text-text-muted font-mono">{txSignature}</p>
        )}
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setSent(false);
            setAmount("");
            setShowConfirm(false);
            fetchBalances();
          }}
        >
          Bridge Again
        </Button>
        <button
          onClick={onBack}
          className="mt-3 text-xs text-text-muted hover:text-text-body"
        >
          Back to Wallet
        </button>
      </div>
    );
  }

  // Confirmation screen
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
          <h2 className="font-display text-base font-bold">Confirm Bridge</h2>
        </div>

        <div className="flex-1 px-4 pt-6">
          <div className="bg-surface-elevated border border-subtle p-4 mb-4">
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">Direction</span>
              <span className="text-xs text-text-heading font-display font-semibold">
                {sourceNetwork} &rarr; {destNetwork}
              </span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">From</span>
              <span className="font-mono text-xs text-text-body">
                {truncateAddress(address, 6)}
              </span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">To (L2)</span>
              <span className="font-mono text-xs text-text-body">
                {truncateAddress(address, 6)}
              </span>
            </div>
            <div className="border-t border-subtle my-3" />
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">Amount</span>
              <span className="font-mono text-sm font-semibold text-text-heading">
                {amount} SOL
              </span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">Network Fee</span>
              <span className="font-mono text-xs text-text-body">
                ~{estimatedFee} SOL
              </span>
            </div>
            {direction === "deposit" && (
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">You Receive</span>
                <span className="font-mono text-sm font-semibold text-success">
                  ~{amountNum.toFixed(4)} {NATIVE_TOKEN_SYMBOL}
                </span>
              </div>
            )}
          </div>

          {direction === "withdraw" && (
            <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 px-3 py-2 mb-4">
              <p className="text-[10px] text-[#FF9500]">
                Withdrawals are subject to a 7-day challenge period before funds
                are released on Solana L1.
              </p>
            </div>
          )}

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
            onClick={handleBridge}
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
                {direction === "deposit" ? "Depositing..." : "Withdrawing..."}
              </span>
            ) : direction === "deposit" ? (
              "Confirm Deposit"
            ) : (
              "Confirm Withdrawal"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Main bridge form
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
        <h2 className="font-display text-base font-bold">Bridge</h2>
      </div>

      <div className="flex-1 px-4 pt-4 space-y-4 overflow-y-auto">
        {/* Direction Selector */}
        <div className="flex border border-subtle">
          <button
            onClick={() => {
              setDirection("deposit");
              setAmount("");
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-display font-semibold transition-colors ${
              direction === "deposit"
                ? "bg-rose text-white"
                : "text-text-muted hover:text-text-body"
            }`}
          >
            Deposit
          </button>
          <button
            onClick={() => {
              setDirection("withdraw");
              setAmount("");
              setError("");
            }}
            className={`flex-1 py-2.5 text-sm font-display font-semibold transition-colors ${
              direction === "withdraw"
                ? "bg-rose text-white"
                : "text-text-muted hover:text-text-body"
            }`}
          >
            Withdraw
          </button>
        </div>

        {/* Network Flow */}
        <div className="bg-surface-elevated border border-subtle p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  direction === "deposit" ? "bg-[#9945FF]" : "bg-rose"
                }`}
              />
              <span className="text-xs text-text-muted">From</span>
            </div>
            <span className="text-xs font-display text-text-heading">
              {sourceNetwork}
            </span>
          </div>

          <div className="flex justify-center my-1">
            <svg
              className="w-4 h-4 text-text-disabled"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  direction === "deposit" ? "bg-rose" : "bg-[#9945FF]"
                }`}
              />
              <span className="text-xs text-text-muted">To</span>
            </div>
            <span className="text-xs font-display text-text-heading">
              {destNetwork}
            </span>
          </div>
        </div>

        {/* Balance Info */}
        <div className="bg-surface-elevated border border-subtle px-3 py-2 flex justify-between">
          <span className="text-xs text-text-muted">Available on {sourceNetwork}</span>
          {loadingBalances ? (
            <span className="text-xs text-text-muted">Loading...</span>
          ) : (
            <span className="font-mono text-xs text-text-heading">
              {sourceBalance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}{" "}
              SOL
            </span>
          )}
        </div>

        {/* Amount Input */}
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
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              placeholder={`Min ${minDeposit} SOL`}
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose pr-14"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-display">
              SOL
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <div className="bg-surface-elevated border border-subtle px-3 py-2 flex justify-between">
            <span className="text-xs text-text-muted">Estimated Fee</span>
            <span className="font-mono text-xs text-text-body">
              ~{estimatedFee} SOL
            </span>
          </div>
          <div className="bg-surface-elevated border border-subtle px-3 py-2 flex justify-between">
            <span className="text-xs text-text-muted">
              {direction === "deposit" ? "Est. Time" : "Challenge Period"}
            </span>
            <span className="text-xs text-text-body font-display">
              {direction === "deposit" ? "~2 minutes" : "7 days"}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 px-3 py-2">
            <p className="text-xs text-error">{error}</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
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
          {direction === "deposit"
            ? "Review Deposit"
            : "Review Withdrawal"}
        </Button>
      </div>
    </div>
  );
}
