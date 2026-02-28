import React, { useState } from 'react';
import Button from '../components/Button';
import {
  truncateAddress,
  getConnection,
  sendSol,
  NETWORKS,
  type TokenBalance,
  type NetworkId,
} from '../../lib/wallet';
import { Keypair } from '@solana/web3.js';
import { decryptData, getWallet, verifyPassword } from '../../lib/storage';

interface SendProps {
  address: string;
  network: NetworkId;
  tokens: TokenBalance[];
  solPrice: number;
  mythPrice: number;
  onBack: () => void;
  onSent: () => void;
}

export default function Send({ address, network, tokens, solPrice, mythPrice, onBack, onSent }: SendProps) {
  const isL2 = network.startsWith('mythic');
  const nativeSymbol = isL2 ? 'MYTH' : 'SOL';
  const nativeToken = tokens.find((t) => t.mint === 'native');
  const unitPrice = isL2 ? mythPrice : solPrice;

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [txSig, setTxSig] = useState('');
  const [error, setError] = useState('');

  const balance = nativeToken?.balance || 0;
  const estimatedFee = 0.000005;
  const parsedAmount = parseFloat(amount) || 0;
  const isValid = recipient.length >= 32 && parsedAmount > 0 && parsedAmount <= balance - estimatedFee;

  const net = NETWORKS[network];
  const explorerTxUrl = (sig: string) =>
    net.chain === 'solana'
      ? `${net.explorerUrl}/tx/${sig}`
      : `${net.explorerUrl}/tx/${sig}`;

  const handleMax = () => {
    setAmount(Math.max(0, balance - 0.01).toFixed(6));
  };

  const handleSend = async () => {
    setError('');
    setSending(true);
    try {
      const valid = await verifyPassword(password);
      if (!valid) { setError('Incorrect password'); setSending(false); return; }

      const wallet = await getWallet();
      if (!wallet) { setError('Wallet not found'); setSending(false); return; }

      const secret = await decryptData(wallet.encryptedMnemonic, password);

      let keypair: Keypair;
      if (wallet.importType === 'privatekey') {
        const bs58 = (await import('bs58')).default;
        const decoded = bs58.decode(secret);
        keypair = decoded.length === 64
          ? Keypair.fromSecretKey(decoded)
          : Keypair.fromSeed(decoded);
      } else {
        const bip39 = await import('bip39');
        const { derivePath } = await import('ed25519-hd-key');
        const seed = await bip39.mnemonicToSeed(secret);
        const derived = derivePath("m/44'/501'/0'/0'", Buffer.from(seed).toString('hex'));
        keypair = Keypair.fromSeed(derived.key);
      }

      const conn = getConnection(network);
      const sig = await sendSol(conn, keypair, recipient.trim(), parsedAmount);
      setTxSig(sig);
      setSent(true);
      setTimeout(onSent, 3000);
    } catch (e: any) {
      setError(e?.message || 'Transaction failed');
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="w-16 h-16 flex items-center justify-center bg-success/10 mb-4">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Transaction Sent</h2>
        <p className="text-sm text-text-muted text-center mb-3">
          {amount} {nativeSymbol} sent to {truncateAddress(recipient, 6)}
        </p>
        <button
          onClick={() => {
            const url = explorerTxUrl(txSig);
            if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url });
            else window.open(url, '_blank');
          }}
          className="font-mono text-[10px] text-rose hover:underline break-all text-center px-4"
        >
          View on Explorer
        </button>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
          <button onClick={() => { setShowConfirm(false); setPassword(''); setError(''); }} className="p-1 hover:bg-surface-hover">
            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-display text-base font-bold">Confirm Transaction</h2>
        </div>

        <div className="flex-1 px-4 pt-6">
          <div className="bg-surface-elevated border border-subtle p-4 mb-4">
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">Network</span>
              <span className="text-xs text-text-body font-display">{net.name}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">From</span>
              <span className="font-mono text-xs text-text-body">{truncateAddress(address, 6)}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">To</span>
              <span className="font-mono text-xs text-text-body">{truncateAddress(recipient, 6)}</span>
            </div>
            <div className="border-t border-subtle my-3" />
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">Amount</span>
              <span className="font-mono text-sm font-semibold text-text-heading">{amount} {nativeSymbol}</span>
            </div>
            {unitPrice > 0 && (
              <div className="flex justify-between mb-3">
                <span className="text-xs text-text-muted">Value</span>
                <span className="font-mono text-xs text-text-body">~${(parsedAmount * unitPrice).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs text-text-muted">Network Fee</span>
              <span className="font-mono text-xs text-text-body">~{estimatedFee} {nativeSymbol}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-text-muted mb-1.5">Enter password to confirm</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wallet password"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
              onKeyDown={(e) => e.key === 'Enter' && password && handleSend()}
            />
          </div>

          {error && (
            <div className="bg-rose/5 border border-rose/20 px-3 py-2 mb-4">
              <p className="text-[10px] text-rose">{error}</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <Button variant="primary" fullWidth size="lg" onClick={handleSend} disabled={sending || !password}>
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              'Confirm & Send'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
        <button onClick={onBack} className="p-1 hover:bg-surface-hover">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-base font-bold">Send {nativeSymbol}</h2>
      </div>

      <div className="flex-1 px-4 pt-4 space-y-4">
        <div className="bg-surface-elevated border border-subtle px-3 py-2 flex justify-between">
          <span className="text-xs text-text-muted">Available ({net.name})</span>
          <span className="text-xs font-mono text-text-body">{balance.toFixed(4)} {nativeSymbol}</span>
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1.5 font-sans">Recipient Address</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={isL2 ? 'Enter address or .myth name...' : 'Enter Solana address...'}
            spellCheck={false}
            className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-text-muted font-sans">Amount ({nativeSymbol})</label>
            <button onClick={handleMax} className="text-[10px] text-rose font-display font-semibold hover:text-rose-light">
              MAX
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.0001"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-display">{nativeSymbol}</span>
          </div>
          {parsedAmount > 0 && unitPrice > 0 && (
            <p className="text-[10px] text-text-muted mt-1 font-mono">
              ~ ${(parsedAmount * unitPrice).toFixed(2)} USD
            </p>
          )}
        </div>

        <div className="bg-surface-elevated border border-subtle px-3 py-2 flex justify-between">
          <span className="text-xs text-text-muted">Estimated Fee</span>
          <span className="text-xs font-mono text-text-body">~{estimatedFee} {nativeSymbol}</span>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button variant="primary" fullWidth size="lg" disabled={!isValid} onClick={() => setShowConfirm(true)}>
          Review Transaction
        </Button>
      </div>
    </div>
  );
}
