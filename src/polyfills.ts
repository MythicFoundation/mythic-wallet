// Node.js polyfills for browser environment
// Must be imported before any @solana/web3.js, bip39, or ed25519-hd-key usage
import { Buffer } from 'buffer';
import process from 'process';

(window as any).Buffer = Buffer;
(window as any).process = process;
(window as any).global = window;
