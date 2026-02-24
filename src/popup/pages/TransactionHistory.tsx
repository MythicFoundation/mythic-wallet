import React, { useState, useEffect, useCallback } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import TransactionItem from "../components/TransactionItem";
import {
  getConnection,
  truncateAddress,
  NATIVE_TOKEN_SYMBOL,
  type NetworkId,
  type TransactionRecord,
} from "../../lib/wallet";

interface TransactionHistoryProps {
  address: string;
  network: NetworkId;
  onBack: () => void;
}

export default function TransactionHistory({
  address,
  network,
  onBack,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    try {
      const connection = getConnection(network);
      const pubkey = new PublicKey(address);
      const signatures = await connection.getSignaturesForAddress(pubkey, {
        limit: 20,
      });

      if (signatures.length === 0) {
        setTransactions([]);
        return;
      }

      const txRecords: TransactionRecord[] = signatures.map((sig) => ({
        signature: `${sig.signature.slice(0, 6)}...${sig.signature.slice(-4)}`,
        type: "unknown" as const,
        amount: 0,
        symbol: NATIVE_TOKEN_SYMBOL,
        timestamp: (sig.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
        status: sig.err ? ("failed" as const) : ("confirmed" as const),
      }));

      try {
        const fullSignatures = signatures.map((s) => s.signature);
        const parsedTxs = await connection.getParsedTransactions(
          fullSignatures,
          {
            maxSupportedTransactionVersion: 0,
          }
        );

        for (let i = 0; i < parsedTxs.length; i++) {
          const parsed = parsedTxs[i];
          if (!parsed) continue;
          const instructions = parsed.transaction.message.instructions;
          for (const ix of instructions) {
            if (
              "parsed" in ix &&
              ix.program === "system" &&
              ix.parsed?.type === "transfer"
            ) {
              const info = ix.parsed.info;
              const lamports = info.lamports ?? 0;
              const amount = lamports / LAMPORTS_PER_SOL;
              const source = info.source as string;
              const dest = info.destination as string;

              if (source === address) {
                txRecords[i] = {
                  ...txRecords[i],
                  type: "send",
                  amount,
                  to: truncateAddress(dest, 4),
                };
              } else if (dest === address) {
                txRecords[i] = {
                  ...txRecords[i],
                  type: "receive",
                  amount,
                  from: truncateAddress(source, 4),
                };
              }
              break;
            }
          }
        }
      } catch {
        // keep basic records
      }

      setTransactions(txRecords);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [address, network]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <div className="flex flex-col h-full">
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
        <h2 className="font-display text-base font-bold">
          Transaction History
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg
              className="w-6 h-6 animate-spin text-text-muted"
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
          </div>
        ) : transactions.length > 0 ? (
          transactions.map((tx, i) => (
            <TransactionItem key={`${tx.signature}-${i}`} tx={tx} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <p className="text-sm text-text-muted">No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
