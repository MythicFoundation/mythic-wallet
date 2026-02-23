import React, { useState } from 'react';
import Button from '../components/Button';
import { generateMnemonic, validateMnemonic, keypairFromMnemonic } from '../../lib/wallet';
import { saveWallet } from '../../lib/storage';

interface OnboardingProps {
  onComplete: (publicKey: string) => void;
}

type Step = 'welcome' | 'create-password' | 'show-phrase' | 'confirm-phrase' | 'import' | 'import-password';

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [confirmWords, setConfirmWords] = useState<string[]>([]);
  const [importPhrase, setImportPhrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // For phrase confirmation: pick 3 random indices
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);

  const handleCreate = () => {
    const phrase = generateMnemonic();
    setMnemonic(phrase);
    setStep('create-password');
  };

  const handlePasswordSubmit = () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    // Pick 3 random positions for confirmation
    const words = mnemonic.split(' ');
    const indices: number[] = [];
    while (indices.length < 3) {
      const idx = Math.floor(Math.random() * words.length);
      if (!indices.includes(idx)) indices.push(idx);
    }
    indices.sort((a, b) => a - b);
    setConfirmIndices(indices);
    setConfirmWords(new Array(3).fill(''));
    setStep('show-phrase');
  };

  const handlePhraseConfirmed = async () => {
    const words = mnemonic.split(' ');
    for (let i = 0; i < confirmIndices.length; i++) {
      if (confirmWords[i].trim().toLowerCase() !== words[confirmIndices[i]].toLowerCase()) {
        setError(`Word #${confirmIndices[i] + 1} is incorrect`);
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      const account = await keypairFromMnemonic(mnemonic);
      await saveWallet(mnemonic, account.publicKey, password);
      onComplete(account.publicKey);
    } catch {
      setError('Failed to create wallet');
    }
    setLoading(false);
  };

  const handleImportSubmit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!validateMnemonic(importPhrase.trim())) {
      setError('Invalid recovery phrase');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const account = await keypairFromMnemonic(importPhrase.trim());
      await saveWallet(importPhrase.trim(), account.publicKey, password);
      onComplete(account.publicKey);
    } catch {
      setError('Failed to import wallet');
    }
    setLoading(false);
  };

  // Welcome screen
  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <svg viewBox="0 0 100 100" className="w-20 h-20 mb-6" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,8 20,44 50,56" fill="#FF2D78" opacity="0.92"/>
          <polygon points="50,8 80,44 50,56" fill="#FF5C96" opacity="0.78"/>
          <polygon points="20,44 50,56 80,44 50,92" fill="#CC2460" opacity="0.88"/>
        </svg>
        <h1 className="font-display text-2xl font-bold text-text-heading mb-2">Mythic Wallet</h1>
        <p className="text-sm text-text-muted text-center mb-8">
          The gateway to the Mythic L2 network
        </p>

        <div className="w-full space-y-3">
          <Button variant="primary" fullWidth size="lg" onClick={handleCreate}>
            Create New Wallet
          </Button>
          <Button variant="secondary" fullWidth size="lg" onClick={() => setStep('import')}>
            Import Existing Wallet
          </Button>
        </div>
      </div>
    );
  }

  // Password creation
  if (step === 'create-password') {
    return (
      <div className="flex flex-col h-full px-6 pt-8">
        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Set Password</h2>
        <p className="text-sm text-text-muted mb-6">Create a password to protect your wallet</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
            />
          </div>
        </div>

        {error && <p className="text-xs text-error mt-2">{error}</p>}

        <div className="mt-auto pb-6">
          <Button variant="primary" fullWidth size="lg" onClick={handlePasswordSubmit}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Show recovery phrase
  if (step === 'show-phrase') {
    const words = mnemonic.split(' ');
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Recovery Phrase</h2>
        <p className="text-xs text-text-muted mb-4">
          Write down these 12 words in order. Never share them with anyone.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {words.map((word, i) => (
            <div key={i} className="bg-surface-elevated border border-subtle px-2 py-2 flex items-center gap-1.5">
              <span className="text-[10px] text-text-disabled w-4 text-right">{i + 1}</span>
              <span className="font-mono text-xs text-text-heading">{word}</span>
            </div>
          ))}
        </div>

        <div className="bg-rose/5 border border-rose/20 px-3 py-2 mb-4">
          <p className="text-[10px] text-rose">
            Warning: If you lose this phrase, you will lose access to your wallet forever.
          </p>
        </div>

        <Button variant="primary" fullWidth size="lg" onClick={() => setStep('confirm-phrase')}>
          I've Saved My Phrase
        </Button>
      </div>
    );
  }

  // Confirm phrase
  if (step === 'confirm-phrase') {
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Confirm Phrase</h2>
        <p className="text-xs text-text-muted mb-6">
          Enter the following words from your recovery phrase to verify you saved it correctly.
        </p>

        <div className="space-y-4">
          {confirmIndices.map((wordIdx, i) => (
            <div key={wordIdx}>
              <label className="block text-xs text-text-muted mb-1.5">Word #{wordIdx + 1}</label>
              <input
                type="text"
                value={confirmWords[i]}
                onChange={(e) => {
                  const updated = [...confirmWords];
                  updated[i] = e.target.value;
                  setConfirmWords(updated);
                }}
                placeholder={`Enter word #${wordIdx + 1}`}
                className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-error mt-2">{error}</p>}

        <div className="mt-auto pb-6">
          <Button variant="primary" fullWidth size="lg" onClick={handlePhraseConfirmed} disabled={loading}>
            {loading ? 'Creating Wallet...' : 'Confirm & Create Wallet'}
          </Button>
        </div>
      </div>
    );
  }

  // Import wallet
  if (step === 'import') {
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <button onClick={() => setStep('welcome')} className="self-start p-1 hover:bg-surface-hover mb-4">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Import Wallet</h2>
        <p className="text-xs text-text-muted mb-4">Enter your 12-word recovery phrase</p>

        <textarea
          value={importPhrase}
          onChange={(e) => setImportPhrase(e.target.value)}
          placeholder="Enter your recovery phrase, separated by spaces..."
          rows={4}
          className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose resize-none mb-4"
        />

        <Button variant="primary" fullWidth size="lg" onClick={() => setStep('import-password')} disabled={!importPhrase.trim()}>
          Continue
        </Button>
      </div>
    );
  }

  // Import password
  if (step === 'import-password') {
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <button onClick={() => setStep('import')} className="self-start p-1 hover:bg-surface-hover mb-4">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Set Password</h2>
        <p className="text-sm text-text-muted mb-6">Create a password to protect your imported wallet</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
            />
          </div>
        </div>

        {error && <p className="text-xs text-error mt-2">{error}</p>}

        <div className="mt-auto pb-6">
          <Button variant="primary" fullWidth size="lg" onClick={handleImportSubmit} disabled={loading}>
            {loading ? 'Importing...' : 'Import Wallet'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
