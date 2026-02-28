import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import {
  truncateAddress,
  getConnection,
  NETWORKS,
  getMythPrice,
  getSolPrice,
  type NetworkId,
} from '../../lib/wallet';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { decryptData, getWallet, verifyPassword } from '../../lib/storage';

interface BridgeProps {
  address: string;
  network: NetworkId;
  onBack: () => void;
  onDone: () => void;
}

// Bridge program IDs
const BRIDGE_L1_PROGRAM = new PublicKey('oEQfREm4FQkaVeRoxJHkJLB1feHprrntY6eJuW2zbqQ');
const BRIDGE_L2_PROGRAM = new PublicKey('MythBrdgL2111111111111111111111111111111111');

// PDA derivations
function deriveBridgeConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('bridge_config')], BRIDGE_L1_PROGRAM);
}
function deriveSolVault(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('sol_vault')], BRIDGE_L1_PROGRAM);
}
function deriveL2BridgeConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('l2_bridge_config')], BRIDGE_L2_PROGRAM);
}
function deriveBridgeReserve(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('bridge_reserve')], BRIDGE_L2_PROGRAM);
}

type Direction = 'l1-to-l2' | 'l2-to-l1';

export default function Bridge({ address, network, onBack, onDone }: BridgeProps) {
  const [direction, setDirection] = useState<Direction>('l1-to-l2');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'input' | 'confirm' | 'sending' | 'success' | 'error'>('input');
  const [error, setError] = useState('');
  const [txSig, setTxSig] = useState('');
  const [l1Balance, setL1Balance] = useState(0);
  const [l2Balance, setL2Balance] = useState(0);
  const [mythPriceUsd, setMythPriceUsd] = useState(0);
  const [solPriceUsd, setSolPriceUsd] = useState(0);
  const [loadingBalances, setLoadingBalances] = useState(true);

  const parsedAmount = parseFloat(amount) || 0;
  const sourceBalance = direction === 'l1-to-l2' ? l1Balance : l2Balance;
  const isValid = parsedAmount > 0 && parsedAmount <= sourceBalance - 0.01;

  // Fetch balances on both chains
  useEffect(() => {
    (async () => {
      setLoadingBalances(true);
      try {
        const l1Conn = new Connection(NETWORKS['solana-mainnet'].rpcUrl, 'confirmed');
        const l2Conn = new Connection(NETWORKS['mythic-mainnet'].rpcUrl, 'confirmed');
        const pubkey = new PublicKey(address);

        const [l1Bal, l2Bal, myth, sol] = await Promise.all([
          l1Conn.getBalance(pubkey).catch(() => 0),
          l2Conn.getBalance(pubkey).catch(() => 0),
          getMythPrice(),
          getSolPrice(),
        ]);

        setL1Balance(l1Bal / LAMPORTS_PER_SOL);
        setL2Balance(l2Bal / LAMPORTS_PER_SOL);
        setMythPriceUsd(myth.priceUsd);
        setSolPriceUsd(sol);
      } catch {}
      setLoadingBalances(false);
    })();
  }, [address]);

  const handleMax = () => {
    setAmount(Math.max(0, sourceBalance - 0.01).toFixed(6));
  };

  const flipDirection = () => {
    setDirection((d) => (d === 'l1-to-l2' ? 'l2-to-l1' : 'l1-to-l2'));
    setAmount('');
  };

  const handleBridge = async () => {
    setError('');
    setStep('sending');
    try {
      const valid = await verifyPassword(password);
      if (!valid) { setError('Incorrect password'); setStep('confirm'); return; }

      const wallet = await getWallet();
      if (!wallet) { setError('Wallet not found'); setStep('confirm'); return; }

      const secret = await decryptData(wallet.encryptedMnemonic, password);

      let keypair: Keypair;
      if (wallet.importType === 'privatekey') {
        const bs58 = (await import('bs58')).default;
        const decoded = bs58.decode(secret);
        keypair = decoded.length === 64 ? Keypair.fromSecretKey(decoded) : Keypair.fromSeed(decoded);
      } else {
        const bip39 = await import('bip39');
        const { derivePath } = await import('ed25519-hd-key');
        const seed = await bip39.mnemonicToSeed(secret);
        const derived = derivePath("m/44'/501'/0'/0'", Buffer.from(seed).toString('hex'));
        keypair = Keypair.fromSeed(derived.key);
      }

      const amountLamports = BigInt(Math.round(parsedAmount * LAMPORTS_PER_SOL));

      if (direction === 'l1-to-l2') {
        // Deposit SOL to L1 bridge → receive MYTH on L2
        const conn = new Connection(NETWORKS['solana-mainnet'].rpcUrl, 'confirmed');
        const [configPda] = deriveBridgeConfig();
        const [solVault] = deriveSolVault();

        const data = Buffer.alloc(1 + 8 + 32);
        data[0] = 2; // DEPOSIT_SOL
        data.writeBigUInt64LE(amountLamports, 1);
        keypair.publicKey.toBuffer().copy(data, 9); // l2_recipient = self

        const ix = new TransactionInstruction({
          programId: BRIDGE_L1_PROGRAM,
          keys: [
            { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: solVault, isSigner: false, isWritable: true },
            { pubkey: configPda, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        });

        const tx = new Transaction().add(ix);
        tx.feePayer = keypair.publicKey;
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.sign(keypair);

        const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
        await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
        setTxSig(sig);

      } else {
        // L2 → L1: call BridgeToL1 instruction on L2 bridge program
        const conn = new Connection(NETWORKS['mythic-mainnet'].rpcUrl, 'confirmed');
        const [l2Config] = deriveL2BridgeConfig();
        const [reserve] = deriveBridgeReserve();

        const l1Recipient = keypair.publicKey; // same address on L1

        const data = Buffer.alloc(1 + 8 + 32);
        data[0] = 3; // BRIDGE_TO_L1
        data.writeBigUInt64LE(amountLamports, 1);
        l1Recipient.toBuffer().copy(data, 9);

        const ix = new TransactionInstruction({
          programId: BRIDGE_L2_PROGRAM,
          keys: [
            { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: l2Config, isSigner: false, isWritable: true },
            { pubkey: reserve, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        });

        const tx = new Transaction().add(ix);
        tx.feePayer = keypair.publicKey;
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.sign(keypair);

        const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed' });
        await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
        setTxSig(sig);
      }

      setStep('success');
      setTimeout(onDone, 4000);
    } catch (e: any) {
      setError(e?.message || 'Bridge transaction failed');
      setStep('error');
    }
  };

  // Success screen
  if (step === 'success') {
    const explorerUrl = direction === 'l1-to-l2'
      ? `https://solscan.io/tx/${txSig}`
      : `https://explorer.mythic.sh/tx/${txSig}`;
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="w-16 h-16 flex items-center justify-center bg-success/10 mb-4">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Bridge Initiated</h2>
        <p className="text-sm text-text-muted text-center mb-1">
          {amount} {direction === 'l1-to-l2' ? 'SOL → MYTH' : 'MYTH → SOL'}
        </p>
        <p className="text-[10px] text-text-disabled text-center mb-4">
          {direction === 'l1-to-l2'
            ? 'MYTH will appear on L2 after relayer processes the deposit'
            : 'SOL will be released on L1 after the challenge period'}
        </p>
        <button
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url: explorerUrl });
            else window.open(explorerUrl, '_blank');
          }}
          className="text-[10px] text-rose hover:underline font-mono"
        >
          View on Explorer
        </button>
      </div>
    );
  }

  // Error screen
  if (step === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="w-16 h-16 flex items-center justify-center bg-error/10 mb-4">
          <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="font-display text-lg font-bold text-text-heading mb-2">Bridge Failed</h2>
        <p className="text-xs text-text-muted text-center mb-4 px-4">{error}</p>
        <Button variant="secondary" onClick={() => { setStep('input'); setError(''); setPassword(''); }}>
          Try Again
        </Button>
      </div>
    );
  }

  // Confirm screen
  if (step === 'confirm') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
          <button onClick={() => { setStep('input'); setPassword(''); setError(''); }} className="p-1 hover:bg-surface-hover">
            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-display text-base font-bold">Confirm Bridge</h2>
        </div>

        <div className="flex-1 px-4 pt-6">
          <div className="bg-surface-elevated border border-subtle p-4 mb-4">
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">Direction</span>
              <span className="text-xs font-display text-text-heading">
                {direction === 'l1-to-l2' ? 'Solana L1 → Mythic L2' : 'Mythic L2 → Solana L1'}
              </span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">You Send</span>
              <span className="font-mono text-sm font-semibold text-text-heading">
                {amount} {direction === 'l1-to-l2' ? 'SOL' : 'MYTH'}
              </span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-xs text-text-muted">You Receive</span>
              <span className="font-mono text-sm font-semibold text-success">
                ~{amount} {direction === 'l1-to-l2' ? 'MYTH' : 'SOL'}
              </span>
            </div>
            {direction === 'l2-to-l1' && (
              <div className="flex justify-between">
                <span className="text-xs text-text-muted">Challenge Period</span>
                <span className="text-xs text-text-body">~42 hours</span>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-xs text-text-muted mb-1.5">Enter password to confirm</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wallet password"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
              onKeyDown={(e) => e.key === 'Enter' && password && handleBridge()}
            />
          </div>

          {error && (
            <div className="bg-rose/5 border border-rose/20 px-3 py-2 mb-4">
              <p className="text-[10px] text-rose">{error}</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <Button variant="primary" fullWidth size="lg" onClick={handleBridge} disabled={step === 'sending' || !password}>
            {step === 'sending' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Bridging...
              </span>
            ) : (
              'Confirm Bridge'
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Input screen
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
        <button onClick={onBack} className="p-1 hover:bg-surface-hover">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-base font-bold">Bridge</h2>
      </div>

      <div className="flex-1 px-4 pt-4 space-y-4">
        {/* Direction toggle */}
        <div className="bg-surface-elevated border border-subtle p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">From</p>
              <p className="text-sm font-display font-semibold text-text-heading">
                {direction === 'l1-to-l2' ? 'Solana L1' : 'Mythic L2'}
              </p>
              <p className="text-[10px] text-text-muted font-mono">
                {direction === 'l1-to-l2'
                  ? `${l1Balance.toFixed(4)} SOL`
                  : `${l2Balance.toFixed(4)} MYTH`}
              </p>
            </div>
            <button
              onClick={flipDirection}
              className="w-8 h-8 flex items-center justify-center border border-subtle hover:border-rose transition-colors"
            >
              <svg className="w-4 h-4 text-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </button>
            <div className="text-right">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">To</p>
              <p className="text-sm font-display font-semibold text-text-heading">
                {direction === 'l1-to-l2' ? 'Mythic L2' : 'Solana L1'}
              </p>
              <p className="text-[10px] text-success font-mono">
                {direction === 'l1-to-l2' ? 'Receive MYTH' : 'Receive SOL'}
              </p>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-text-muted font-sans">
              Amount ({direction === 'l1-to-l2' ? 'SOL' : 'MYTH'})
            </label>
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
              step="0.01"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-display">
              {direction === 'l1-to-l2' ? 'SOL' : 'MYTH'}
            </span>
          </div>
          {parsedAmount > 0 && (
            <p className="text-[10px] text-text-muted mt-1 font-mono">
              ~ ${(parsedAmount * (direction === 'l1-to-l2' ? solPriceUsd : mythPriceUsd)).toFixed(2)} USD
            </p>
          )}
        </div>

        {/* Info */}
        <div className="bg-surface-elevated border border-subtle px-3 py-2 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[10px] text-text-muted">You Receive</span>
            <span className="text-[10px] font-mono text-success">
              ~{parsedAmount.toFixed(4)} {direction === 'l1-to-l2' ? 'MYTH' : 'SOL'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-text-muted">Network Fee</span>
            <span className="text-[10px] font-mono text-text-body">~0.000005</span>
          </div>
          {direction === 'l2-to-l1' && (
            <div className="flex justify-between">
              <span className="text-[10px] text-text-muted">Challenge Period</span>
              <span className="text-[10px] text-text-body">~42 hours</span>
            </div>
          )}
        </div>

        {loadingBalances && (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="w-3 h-3 border-2 border-rose border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-text-muted">Loading balances...</span>
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <Button variant="primary" fullWidth size="lg" disabled={!isValid || loadingBalances} onClick={() => setStep('confirm')}>
          Review Bridge
        </Button>
      </div>
    </div>
  );
}
