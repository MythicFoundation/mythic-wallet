import type { NetworkId } from './wallet';

export interface StoredWallet {
  encryptedMnemonic: string;
  publicKey: string;
  createdAt: number;
}

export interface WalletState {
  isLocked: boolean;
  hasWallet: boolean;
  activeNetwork: NetworkId;
  connectedSites: string[];
}

const STORAGE_KEYS = {
  WALLET: 'mythic_wallet',
  STATE: 'mythic_state',
  PASSWORD_HASH: 'mythic_pw_hash',
} as const;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptData(data: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(data),
  );
  const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedStr: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedStr), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );
  return new TextDecoder().decode(decrypted);
}

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(password + 'mythic_salt'));
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export async function saveWallet(mnemonic: string, publicKey: string, password: string): Promise<void> {
  const encryptedMnemonic = await encryptData(mnemonic, password);
  const pwHash = await hashPassword(password);
  const wallet: StoredWallet = {
    encryptedMnemonic,
    publicKey,
    createdAt: Date.now(),
  };
  const state: WalletState = {
    isLocked: false,
    hasWallet: true,
    activeNetwork: 'mythic-testnet',
    connectedSites: [],
  };
  await chrome.storage.local.set({
    [STORAGE_KEYS.WALLET]: wallet,
    [STORAGE_KEYS.STATE]: state,
    [STORAGE_KEYS.PASSWORD_HASH]: pwHash,
  });
}

export async function getWallet(): Promise<StoredWallet | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WALLET);
  return result[STORAGE_KEYS.WALLET] || null;
}

export async function getState(): Promise<WalletState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STATE);
  return result[STORAGE_KEYS.STATE] || {
    isLocked: true,
    hasWallet: false,
    activeNetwork: 'mythic-testnet',
    connectedSites: [],
  };
}

export async function updateState(updates: Partial<WalletState>): Promise<void> {
  const current = await getState();
  await chrome.storage.local.set({
    [STORAGE_KEYS.STATE]: { ...current, ...updates },
  });
}

export async function verifyPassword(password: string): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PASSWORD_HASH);
  const storedHash = result[STORAGE_KEYS.PASSWORD_HASH];
  if (!storedHash) return false;
  const inputHash = await hashPassword(password);
  return inputHash === storedHash;
}

export async function unlockWallet(password: string): Promise<string | null> {
  const isValid = await verifyPassword(password);
  if (!isValid) return null;
  const wallet = await getWallet();
  if (!wallet) return null;
  try {
    const mnemonic = await decryptData(wallet.encryptedMnemonic, password);
    await updateState({ isLocked: false });
    return mnemonic;
  } catch {
    return null;
  }
}

export async function lockWallet(): Promise<void> {
  await updateState({ isLocked: true });
}
