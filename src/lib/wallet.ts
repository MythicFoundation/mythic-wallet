import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, SendOptions } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

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
  type: 'send' | 'receive' | 'swap' | 'unknown';
  amount: number;
  symbol: string;
  to?: string;
  from?: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
}

// Native token on Mythic L2 is MYTH (not SOL)
export const NATIVE_TOKEN_SYMBOL = 'MYTH';
export const NATIVE_TOKEN_NAME = 'Mythic';
export const NATIVE_TOKEN_MINT = 'So11111111111111111111111111111111111111112';

export const NETWORKS = {
  'mythic-mainnet': {
    name: 'Mythic Mainnet',
    rpcUrl: 'https://rpc.mythic.sh',
    explorerUrl: 'https://explorer.mythic.sh',
  },
  'mythic-testnet': {
    name: 'Mythic Testnet',
    rpcUrl: 'http://MYTHIC_SERVER_IP:8899',
    explorerUrl: 'https://explorer.mythic.sh',
  },
} as const;

export type NetworkId = keyof typeof NETWORKS;

export function generateMnemonic(): string {
  return bip39.generateMnemonic();
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

export async function keypairFromMnemonic(mnemonic: string, accountIndex = 0): Promise<WalletAccount> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const path = `m/44'/501'/${accountIndex}'/0'`;
  const derived = derivePath(path, Buffer.from(seed).toString('hex'));
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
  return new Connection(NETWORKS[networkId].rpcUrl, 'confirmed');
}

export async function getBalance(connection: Connection, publicKey: string): Promise<number> {
  try {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

export async function sendSol(
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

// Mock data for demo — uses MYTH as native token
export const MOCK_TOKENS: TokenBalance[] = [
  {
    symbol: 'MYTH',
    name: 'Mythic',
    mint: NATIVE_TOKEN_MINT,
    balance: 142.58,
    usdValue: 21387.0,
    icon: 'MYTH',
    change24h: 2.4,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    balance: 1250.0,
    usdValue: 1250.0,
    icon: 'USDC',
    change24h: 0.0,
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    balance: 15000000,
    usdValue: 345.0,
    icon: 'BONK',
    change24h: -3.2,
  },
];

export const MOCK_TRANSACTIONS: TransactionRecord[] = [
  {
    signature: '5KtPn1...3xYm',
    type: 'receive',
    amount: 25.0,
    symbol: 'MYTH',
    from: '7nYB...4kPq',
    timestamp: Date.now() - 1000 * 60 * 30,
    status: 'confirmed',
  },
  {
    signature: '3mWqR...7nLk',
    type: 'send',
    amount: 10.5,
    symbol: 'MYTH',
    to: 'DLB2...HjSg',
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    status: 'confirmed',
  },
  {
    signature: '9pLxN...2vHj',
    type: 'swap',
    amount: 10.0,
    symbol: 'MYTH',
    timestamp: Date.now() - 1000 * 60 * 60 * 5,
    status: 'confirmed',
  },
  {
    signature: '2kRmT...8wQp',
    type: 'receive',
    amount: 1000,
    symbol: 'USDC',
    from: 'AnVq...hT9e',
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    status: 'confirmed',
  },
  {
    signature: '8jNvS...1cYd',
    type: 'send',
    amount: 2.5,
    symbol: 'MYTH',
    to: '4pPD...sk6s',
    timestamp: Date.now() - 1000 * 60 * 60 * 48,
    status: 'confirmed',
  },
];
