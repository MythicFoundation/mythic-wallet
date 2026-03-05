import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';

// ─── Types ───

export interface WalletAccount {
  publicKey: string;
  secretKey: Uint8Array;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  mint: string;
  balance: number;
  decimals: number;
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

// ─── Networks ───

export const NETWORKS = {
  'mythic-mainnet': {
    name: 'Mythic L2',
    rpcUrl: 'https://rpc.mythic.sh',
    explorerUrl: 'https://explorer.mythic.sh',
    chain: 'mythic' as const,
  },
  'mythic-testnet': {
    name: 'Mythic Testnet',
    rpcUrl: 'https://rpc.mythic.sh',
    explorerUrl: 'https://explorer.mythic.sh',
    chain: 'mythic' as const,
  },
  'solana-mainnet': {
    name: 'Solana',
    rpcUrl: 'https://beta.helius-rpc.com/?api-key=60aa17ec-d160-4cd9-8a51-e74f693bc403',
    explorerUrl: 'https://solscan.io',
    chain: 'solana' as const,
  },
  'solana-devnet': {
    name: 'Solana Devnet',
    rpcUrl: 'https://devnet.helius-rpc.com/?api-key=60aa17ec-d160-4cd9-8a51-e74f693bc403',
    explorerUrl: 'https://solscan.io',
    chain: 'solana' as const,
  },
} as const;

export type NetworkId = keyof typeof NETWORKS;

// Fallback metadata for L2 tokens (L1 uses Helius DAS which returns metadata)
const L2_TOKEN_META: Record<string, { symbol: string; name: string; decimals: number; icon: string }> = {
  '7sfazeMxmuoDkuU5fHkDGin8uYuaTkZrRSwJM1CHXvDq': { symbol: 'MYTH', name: 'Mythic', decimals: 6, icon: '' },
  'FEJa8wGyhXu9Hic1jNTg76Atb57C7jFkmDyDTQZkVwy3': { symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  '6QTVHn4TUPQSpCH1uGmAK1Vd6JhuSEeKMKSi1F1SZMN': { symbol: 'USDC', name: 'USD Coin', decimals: 6, icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  '8Go32n5Pv4HYdML9DNr8ePh4UHunqS9ZgjKMurz1vPSw': { symbol: 'wBTC', name: 'Wrapped BTC', decimals: 8, icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png' },
  '4zmzPzkexJRCVKSrYCHpmP8TVX6kMobjiFu8dVKtuXGT': { symbol: 'wETH', name: 'Wrapped ETH', decimals: 8, icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png' },
};

// Helius DAS RPC URLs for asset metadata
const HELIUS_RPC: Record<string, string> = {
  'solana-mainnet': 'https://beta.helius-rpc.com/?api-key=60aa17ec-d160-4cd9-8a51-e74f693bc403',
  'solana-devnet': 'https://devnet.helius-rpc.com/?api-key=60aa17ec-d160-4cd9-8a51-e74f693bc403',
};

// ─── Key Management ───

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
  return { publicKey: keypair.publicKey.toBase58(), secretKey: keypair.secretKey };
}

export function keypairFromSecretKey(secretKey: Uint8Array): WalletAccount {
  const keypair = Keypair.fromSecretKey(secretKey);
  return { publicKey: keypair.publicKey.toBase58(), secretKey: keypair.secretKey };
}

export function keypairFromBase58PrivateKey(base58Key: string): WalletAccount {
  const decoded = bs58.decode(base58Key);
  if (decoded.length === 64) return keypairFromSecretKey(decoded);
  if (decoded.length === 32) {
    const keypair = Keypair.fromSeed(decoded);
    return { publicKey: keypair.publicKey.toBase58(), secretKey: keypair.secretKey };
  }
  throw new Error('Invalid private key length. Expected 32 or 64 bytes.');
}

export function validateBase58PrivateKey(base58Key: string): boolean {
  try {
    const decoded = bs58.decode(base58Key.trim());
    return decoded.length === 32 || decoded.length === 64;
  } catch {
    return false;
  }
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// ─── RPC Helpers ───

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

// ─── IPFS/Arweave URL resolver ───

function resolveImageUrl(uri: string | undefined): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  if (uri.startsWith('ar://')) {
    return `https://arweave.net/${uri.slice(5)}`;
  }
  return uri;
}

// ─── Helius DAS: getAssetsByOwner (L1 — returns full metadata + images) ───

async function getTokensViaHeliusDAS(owner: string, networkId: NetworkId): Promise<TokenBalance[]> {
  const rpcUrl = HELIUS_RPC[networkId];
  if (!rpcUrl) return [];

  const tokens: TokenBalance[] = [];

  // Native SOL balance
  const conn = new Connection(rpcUrl, 'confirmed');
  const solBalance = await conn.getBalance(new PublicKey(owner));
  tokens.push({
    symbol: 'SOL',
    name: 'Solana',
    mint: 'native',
    balance: solBalance / LAMPORTS_PER_SOL,
    decimals: 9,
    usdValue: 0,
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    change24h: 0,
  });

  // Fungible tokens via DAS
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'tokens',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: owner,
        displayOptions: { showFungible: true, showNativeBalance: false },
      },
    }),
  });

  const data = await res.json();
  const items = data?.result?.items;
  if (!Array.isArray(items)) return tokens;

  for (const asset of items) {
    // Only show fungible tokens
    if (asset.interface !== 'FungibleToken' && asset.interface !== 'FungibleAsset') continue;

    const info = asset.token_info;
    if (!info) continue;

    const balance = Number(info.balance) / Math.pow(10, info.decimals || 0);
    if (balance === 0) continue;

    const imageUri = asset.content?.links?.image
      || asset.content?.files?.[0]?.uri
      || asset.content?.files?.[0]?.cdn_uri
      || '';

    tokens.push({
      symbol: info.symbol || asset.content?.metadata?.symbol || asset.id?.slice(0, 4) + '...',
      name: asset.content?.metadata?.name || info.symbol || 'Unknown Token',
      mint: asset.id,
      balance,
      decimals: info.decimals || 0,
      usdValue: info.price_info?.total_price || 0,
      icon: resolveImageUrl(imageUri),
      change24h: 0,
    });
  }

  // Sort by USD value descending, unknowns at bottom
  tokens.sort((a, b) => {
    if (a.mint === 'native') return -1;
    if (b.mint === 'native') return 1;
    return b.usdValue - a.usdValue;
  });

  return tokens;
}

// ─── L2 token balances (getParsedTokenAccountsByOwner + on-chain metadata) ───

async function getTokensViaRPC(connection: Connection, owner: string, networkId?: NetworkId): Promise<TokenBalance[]> {
  const tokens: TokenBalance[] = [];
  const ownerPubkey = new PublicKey(owner);
  const isMythicL2 = networkId?.startsWith('mythic');

  // Native balance — MYTH on L2, SOL on L1
  const nativeLamports = await connection.getBalance(ownerPubkey);
  if (isMythicL2) {
    // Mythic L2: native token is MYTH (6 decimals, stored as lamports with 9 decimal places in runtime)
    tokens.push({
      symbol: 'MYTH',
      name: 'Mythic',
      mint: 'native',
      balance: nativeLamports / LAMPORTS_PER_SOL,
      decimals: 9,
      usdValue: 0,
      icon: '',
      change24h: 0,
    });
  } else {
    tokens.push({
      symbol: 'SOL',
      name: 'Solana',
      mint: 'native',
      balance: nativeLamports / LAMPORTS_PER_SOL,
      decimals: 9,
      usdValue: 0,
      icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      change24h: 0,
    });
  }

  // SPL token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPubkey, {
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  });

  // Collect mints that need metadata lookup
  const mintsMissingMeta: string[] = [];

  for (const { account } of tokenAccounts.value) {
    const parsed = account.data.parsed?.info;
    if (!parsed) continue;
    const mint = parsed.mint as string;
    const amount = parsed.tokenAmount;
    if (!amount || Number(amount.uiAmount) === 0) continue;

    const known = L2_TOKEN_META[mint];
    if (known) {
      tokens.push({
        symbol: known.symbol,
        name: known.name,
        mint,
        balance: Number(amount.uiAmount),
        decimals: amount.decimals,
        usdValue: 0,
        icon: known.icon,
        change24h: 0,
      });
    } else {
      // Unknown token — try to read on-chain metadata
      mintsMissingMeta.push(mint);
      tokens.push({
        symbol: mint.slice(0, 4) + '...',
        name: 'Unknown Token',
        mint,
        balance: Number(amount.uiAmount),
        decimals: amount.decimals,
        usdValue: 0,
        icon: '',
        change24h: 0,
      });
    }
  }

  // Fetch Metaplex metadata for unknown tokens (Token Metadata Program)
  if (mintsMissingMeta.length > 0) {
    const METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    await Promise.all(
      mintsMissingMeta.map(async (mint) => {
        try {
          const [metadataPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('metadata'), METADATA_PROGRAM.toBytes(), new PublicKey(mint).toBytes()],
            METADATA_PROGRAM,
          );
          const accountInfo = await connection.getAccountInfo(metadataPDA);
          if (!accountInfo?.data) return;

          // Parse Metaplex metadata v1 layout (minimal: name at offset 65, symbol at 101, uri at 115)
          const data = accountInfo.data;
          const nameLen = data.readUInt32LE(65);
          const name = data.subarray(69, 69 + Math.min(nameLen, 32)).toString('utf-8').replace(/\0/g, '').trim();
          const symbolLen = data.readUInt32LE(69 + 32);
          const symbol = data.subarray(69 + 32 + 4, 69 + 32 + 4 + Math.min(symbolLen, 10)).toString('utf-8').replace(/\0/g, '').trim();
          const uriLen = data.readUInt32LE(69 + 32 + 4 + 10);
          const uri = data.subarray(69 + 32 + 4 + 10 + 4, 69 + 32 + 4 + 10 + 4 + Math.min(uriLen, 200)).toString('utf-8').replace(/\0/g, '').trim();

          // Update the token entry
          const entry = tokens.find((t) => t.mint === mint);
          if (entry) {
            if (name) entry.name = name;
            if (symbol) entry.symbol = symbol;
            // Fetch off-chain JSON for image
            if (uri && (uri.startsWith('http') || uri.startsWith('ipfs://') || uri.startsWith('ar://'))) {
              try {
                const jsonUrl = resolveImageUrl(uri);
                const metaRes = await fetch(jsonUrl, { signal: AbortSignal.timeout(5000) });
                const meta = await metaRes.json();
                if (meta.image) entry.icon = resolveImageUrl(meta.image);
              } catch { /* skip image fetch failures */ }
            }
          }
        } catch { /* skip metadata parse failures */ }
      }),
    );
  }

  return tokens;
}

// ─── Token Balances (dispatch to DAS or RPC) ───

export async function getTokenBalances(connection: Connection, owner: string, networkId?: NetworkId): Promise<TokenBalance[]> {
  try {
    // Use Helius DAS for L1 networks (rich metadata + images built-in)
    if (networkId && networkId in HELIUS_RPC) {
      return await getTokensViaHeliusDAS(owner, networkId);
    }
    // Fallback to standard RPC for L2 / other networks
    return await getTokensViaRPC(connection, owner, networkId);
  } catch (e) {
    console.error('Failed to fetch token balances:', e);
    return [];
  }
}

// ─── Transaction History (real signatures) ───

export async function getTransactionHistory(
  connection: Connection,
  owner: string,
  limit = 20,
): Promise<TransactionRecord[]> {
  const records: TransactionRecord[] = [];
  try {
    const ownerPubkey = new PublicKey(owner);
    const signatures = await connection.getSignaturesForAddress(ownerPubkey, { limit });

    for (const sigInfo of signatures) {
      let type: TransactionRecord['type'] = 'unknown';
      let amount = 0;
      let symbol = 'SOL';
      let to: string | undefined;
      let from: string | undefined;

      // Try to parse the transaction for send/receive info
      try {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (tx?.meta && tx.transaction.message.accountKeys.length > 0) {
          const preBalances = tx.meta.preBalances;
          const postBalances = tx.meta.postBalances;
          const accounts = tx.transaction.message.accountKeys;

          // Find our account index
          const ownerIdx = accounts.findIndex((a) => a.pubkey.toBase58() === owner);
          if (ownerIdx >= 0 && preBalances && postBalances) {
            const diff = (postBalances[ownerIdx] - preBalances[ownerIdx]) / LAMPORTS_PER_SOL;
            // Account for fees if we're the fee payer
            const fee = (tx.meta.fee || 0) / LAMPORTS_PER_SOL;
            const adjustedDiff = ownerIdx === 0 ? diff + fee : diff;

            if (adjustedDiff > 0.000001) {
              type = 'receive';
              amount = adjustedDiff;
              // Find sender (account that decreased)
              for (let i = 0; i < accounts.length; i++) {
                if (i !== ownerIdx && preBalances[i] > postBalances[i]) {
                  from = accounts[i].pubkey.toBase58();
                  break;
                }
              }
            } else if (adjustedDiff < -0.000001) {
              type = 'send';
              amount = Math.abs(adjustedDiff);
              // Find receiver (account that increased)
              for (let i = 0; i < accounts.length; i++) {
                if (i !== ownerIdx && postBalances[i] > preBalances[i]) {
                  to = accounts[i].pubkey.toBase58();
                  break;
                }
              }
            }

            // Check for token transfers in inner instructions
            if (tx.meta.innerInstructions?.length) {
              type = type === 'unknown' ? 'swap' : type;
            }
          }
        }
      } catch {
        // Failed to parse — show as unknown
      }

      records.push({
        signature: sigInfo.signature,
        type,
        amount: Math.abs(amount),
        symbol,
        to,
        from,
        timestamp: (sigInfo.blockTime || 0) * 1000,
        status: sigInfo.confirmationStatus === 'finalized' || sigInfo.confirmationStatus === 'confirmed'
          ? 'confirmed'
          : sigInfo.err
          ? 'failed'
          : 'pending',
      });
    }
  } catch (e) {
    console.error('Failed to fetch tx history:', e);
  }
  return records;
}


/**
 * Poll for transaction confirmation using getSignatureStatuses.
 * Firedancer does not reliably support websocket-based confirmTransaction.
 */
async function pollConfirmation(
  connection: Connection,
  signature: string,
  timeoutMs = 20_000,
  intervalMs = 800,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { value } = await connection.getSignatureStatuses([signature]);
      const status = value?.[0];
      if (status) {
        if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          return;
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.startsWith('Transaction failed')) throw e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  // Timed out but tx was sent — likely succeeded
}

// ─── Send SOL (real) ───

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

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKeypair.publicKey;
  transaction.sign(fromKeypair);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  await pollConfirmation(connection, signature);
  return signature;
}

// ─── SOL Price (CoinGecko free API) ───

let _cachedSolPrice: { price: number; ts: number } | null = null;

export async function getSolPrice(): Promise<number> {
  if (_cachedSolPrice && Date.now() - _cachedSolPrice.ts < 60_000) {
    return _cachedSolPrice.price;
  }
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await res.json();
    const price = data?.solana?.usd || 0;
    _cachedSolPrice = { price, ts: Date.now() };
    return price;
  } catch {
    return _cachedSolPrice?.price || 0;
  }
}

// ─── MYTH Price (DexScreener → PumpFun pool) ───

const MYTH_L1_MINT = '5UP2iL9DefXC3yovX9b4XG2EiCnyxuVo3S2F6ik5pump';
let _cachedMythPrice: { priceUsd: number; priceSOL: number; ts: number } | null = null;

export async function getMythPrice(): Promise<{ priceUsd: number; priceSOL: number }> {
  if (_cachedMythPrice && Date.now() - _cachedMythPrice.ts < 30_000) {
    return { priceUsd: _cachedMythPrice.priceUsd, priceSOL: _cachedMythPrice.priceSOL };
  }
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MYTH_L1_MINT}`);
    const data = await res.json();
    const pairs = data?.pairs || [];
    // Prefer SOL pair
    const solPair = pairs.find((p: any) =>
      p.quoteToken?.symbol === 'SOL' || p.quoteToken?.symbol === 'WSOL'
    );
    const best = solPair || pairs[0];
    if (best) {
      const priceUsd = parseFloat(best.priceUsd || '0');
      const priceSOL = parseFloat(best.priceNative || '0');
      _cachedMythPrice = { priceUsd, priceSOL, ts: Date.now() };
      return { priceUsd, priceSOL };
    }
  } catch {}
  return {
    priceUsd: _cachedMythPrice?.priceUsd || 0,
    priceSOL: _cachedMythPrice?.priceSOL || 0,
  };
}

// ─── .myth Domain Resolution ───

export async function resolveMythDomain(domain: string): Promise<string | null> {
  const name = domain.toLowerCase().replace(/\.myth$/, '');
  if (!name) return null;
  try {
    const res = await fetch(`https://mythicswap.app/api/profiles?username=${encodeURIComponent(name)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.wallet_address) return data.wallet_address;
    }
  } catch {}
  return null;
}

// Backwards compat alias
export const sendMyth = sendSol;
