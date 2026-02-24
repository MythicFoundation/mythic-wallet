import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, SendOptions } from "@solana/web3.js";
import * as bip39 from "bip39";
import { wordlists } from "bip39";

const english = wordlists.english ?? wordlists.EN;
import { derivePath } from "ed25519-hd-key";

export interface WalletAccount {
  publicKey: string;
  secretKey: Uint8Array;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  mint: string;
  balance: number;
  usdValue: number;
  icon: string;
  change24h: number;
}

export interface TransactionRecord {
  signature: string;
  type: "send" | "receive" | "swap" | "unknown";
  amount: number;
  symbol: string;
  to?: string;
  from?: string;
  timestamp: number;
  status: "confirmed" | "pending" | "failed";
}

// Native token on Mythic L2 is MYTH (like SOL on Solana)
export const NATIVE_TOKEN_SYMBOL = "MYTH";
export const NATIVE_TOKEN_NAME = "Mythic";
// Native balance uses the system program (lamports), not an SPL mint
export const NATIVE_TOKEN_MINT = "native";

// Known SPL token mints on Mythic L2
export const KNOWN_MINTS: Record<string, { symbol: string; name: string; decimals: number }> = {
  "7sfazeMxmuoDkuU5fHkDGin8uYuaTkZrRSwJM1CHXvDq": { symbol: "MYTH", name: "Mythic Token (SPL)", decimals: 6 },
  "FEJa8wGyhXu9Hic1jNTg76Atb57C7jFkmDyDTQZkVwy3": { symbol: "wSOL", name: "Wrapped SOL", decimals: 9 },
  "6QTVHn4TUPQSpCH1uGmAK1Vd6JhuSEeKMKSi1F1SZMN": { symbol: "USDC", name: "USD Coin", decimals: 6 },
  "8Go32n5Pv4HYdML9DNr8ePh4UHunqS9ZgjKMurz1vPSw": { symbol: "wBTC", name: "Wrapped Bitcoin", decimals: 8 },
  "4zmzPzkexJRCVKSrYCHpmP8TVX6kMobjiFu8dVKtuXGT": { symbol: "wETH", name: "Wrapped Ethereum", decimals: 8 },
};

export const NETWORKS = {
  "mythic-mainnet": {
    name: "Mythic Mainnet",
    rpcUrl: "https://rpc.mythic.sh",
    explorerUrl: "https://explorer.mythic.sh",
  },
  "mythic-testnet": {
    name: "Mythic Testnet",
    rpcUrl: "https://testnet.mythic.sh",
    explorerUrl: "https://explorer.mythic.sh",
  },
} as const;

export type NetworkId = keyof typeof NETWORKS;

export function generateMnemonic(): string {
  return bip39.generateMnemonic(128, undefined, english);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic, english);
}

export async function keypairFromMnemonic(mnemonic: string, accountIndex = 0): Promise<WalletAccount> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const path = `m/44'/501'/${accountIndex}'/0'`;
  const derived = derivePath(path, Buffer.from(seed).toString("hex"));
  const keypair = Keypair.fromSeed(derived.key);
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: keypair.secretKey,
  };
}

export function keypairFromSecretKey(secretKey: Uint8Array): WalletAccount {
  const keypair = Keypair.fromSecretKey(secretKey);
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: keypair.secretKey,
  };
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function getConnection(networkId: NetworkId): Connection {
  return new Connection(NETWORKS[networkId].rpcUrl, "confirmed");
}

export async function getBalance(connection: Connection, publicKey: string): Promise<number> {
  try {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

export async function sendMyth(
  connection: Connection,
  fromKeypair: Keypair,
  toAddress: string,
  amount: number,
): Promise<string> {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports: Math.round(amount * LAMPORTS_PER_SOL),
    }),
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKeypair.publicKey;

  transaction.sign(fromKeypair);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature);
  return signature;
}

// Backwards compat alias
export const sendSol = sendMyth;
