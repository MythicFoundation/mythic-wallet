import React, { useState, useMemo } from 'react';
import Button from '../components/Button';
import {
  generateMnemonic,
  validateMnemonic,
  keypairFromMnemonic,
  keypairFromBase58PrivateKey,
  validateBase58PrivateKey,
} from '../../lib/wallet';
import { saveWallet, saveMythDomain } from '../../lib/storage';

interface OnboardingProps {
  onComplete: (publicKey: string) => void;
}

type Step =
  | 'welcome'
  | 'create-password'
  | 'show-phrase'
  | 'confirm-phrase'
  | 'import-choose'
  | 'import-phrase'
  | 'import-privatekey'
  | 'import-password'
  | 'myth-domain';

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [importPhrase, setImportPhrase] = useState('');
  const [importPrivateKey, setImportPrivateKey] = useState('');
  const [importMethod, setImportMethod] = useState<'phrase' | 'privatekey'>('phrase');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);

  // Word-picker state
  const [selectedWords, setSelectedWords] = useState<(string | null)[]>([null, null, null]);
  const [currentConfirmIdx, setCurrentConfirmIdx] = useState(0);

  // .myth domain state
  const [publicKey, setPublicKey] = useState('');
  const [mythUsername, setMythUsername] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [domainSuccess, setDomainSuccess] = useState('');

  // Generate shuffled word options for each confirmation slot
  const wordOptions = useMemo(() => {
    if (!mnemonic || confirmIndices.length === 0) return [];
    const words = mnemonic.split(' ');
    return confirmIndices.map((idx) => {
      const correct = words[idx];
      const others = words.filter((_, i) => i !== idx);
      const shuffledOthers = others.sort(() => Math.random() - 0.5).slice(0, 5);
      const options = [correct, ...shuffledOthers].sort(() => Math.random() - 0.5);
      return options;
    });
  }, [mnemonic, confirmIndices]);

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
    const words = mnemonic.split(' ');
    const indices: number[] = [];
    while (indices.length < 3) {
      const idx = Math.floor(Math.random() * words.length);
      if (!indices.includes(idx)) indices.push(idx);
    }
    indices.sort((a, b) => a - b);
    setConfirmIndices(indices);
    setSelectedWords([null, null, null]);
    setCurrentConfirmIdx(0);
    setStep('show-phrase');
  };

  const handleWordSelect = (word: string) => {
    const updated = [...selectedWords];
    updated[currentConfirmIdx] = word;
    setSelectedWords(updated);
    setError('');
    if (currentConfirmIdx < 2) {
      setCurrentConfirmIdx(currentConfirmIdx + 1);
    }
  };

  const handlePhraseConfirmed = async () => {
    const words = mnemonic.split(' ');
    for (let i = 0; i < confirmIndices.length; i++) {
      if (!selectedWords[i] || selectedWords[i] !== words[confirmIndices[i]]) {
        setError(`Word #${confirmIndices[i] + 1} is incorrect. Tap the correct word.`);
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      const account = await keypairFromMnemonic(mnemonic);
      await saveWallet(mnemonic, account.publicKey, password, 'mnemonic');
      setPublicKey(account.publicKey);
      setStep('myth-domain');
    } catch {
      setError('Failed to create wallet');
    }
    setLoading(false);
  };

  const handleImportPhraseSubmit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!validateMnemonic(importPhrase.trim())) {
      setError('Invalid recovery phrase. Must be 12 or 24 words.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const account = await keypairFromMnemonic(importPhrase.trim());
      await saveWallet(importPhrase.trim(), account.publicKey, password, 'mnemonic');
      setPublicKey(account.publicKey);
      setStep('myth-domain');
    } catch {
      setError('Failed to import wallet');
    }
    setLoading(false);
  };

  const handleImportPrivateKeySubmit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const trimmed = importPrivateKey.trim();
    if (!validateBase58PrivateKey(trimmed)) {
      setError('Invalid private key. Must be a base58-encoded Solana private key.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const account = keypairFromBase58PrivateKey(trimmed);
      await saveWallet(trimmed, account.publicKey, password, 'privatekey');
      setPublicKey(account.publicKey);
      setStep('myth-domain');
    } catch (e: any) {
      setError(e?.message || 'Failed to import wallet');
    }
    setLoading(false);
  };

  const handleRegisterDomain = async () => {
    const name = mythUsername.trim().toLowerCase().replace(/\.myth$/, '').replace(/[^a-z0-9_-]/g, '');
    if (name.length < 2) {
      setDomainError('Username must be at least 2 characters');
      return;
    }
    if (name.length > 24) {
      setDomainError('Username must be 24 characters or fewer');
      return;
    }
    setDomainError('');
    setDomainLoading(true);
    try {
      const res = await fetch('https://mythic.sh/api/register-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': publicKey,
        },
        body: JSON.stringify({
          domain: name,
          metadata_uri: '',
          privacy_shield: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDomainError(data.error || 'Registration failed');
        setDomainLoading(false);
        return;
      }
      await saveMythDomain(`${name}.myth`);
      setDomainSuccess(`${name}.myth`);
      setDomainError('');
    } catch (e: any) {
      setDomainError(e?.message || 'Failed to register domain');
    }
    setDomainLoading(false);
  };

  // ─── Welcome ───
  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <div className="w-20 h-20 mb-6 flex items-center justify-center">
          <svg viewBox="0 0 128 128" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <rect width="128" height="128" rx="26" fill="#FF2D78"/>
            <path d="M64 28L38 66l26 11 26-11L64 28z" fill="white" fillOpacity="0.95"/>
            <path d="M38 66l26 11 26-11L64 100 38 66z" fill="white" fillOpacity="0.65"/>
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold text-text-heading mb-2">Mythic Wallet</h1>
        <p className="text-sm text-text-muted text-center mb-8">
          The gateway to the Mythic L2 network
        </p>

        <div className="w-full space-y-3">
          <Button variant="primary" fullWidth size="lg" onClick={handleCreate}>
            Create New Wallet
          </Button>
          <Button variant="secondary" fullWidth size="lg" onClick={() => setStep('import-choose')}>
            Import Existing Wallet
          </Button>
        </div>
      </div>
    );
  }

  // ─── Import: Choose Method ───
  if (step === 'import-choose') {
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <button onClick={() => setStep('welcome')} className="self-start p-1 hover:bg-surface-hover mb-4">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Import Wallet</h2>
        <p className="text-xs text-text-muted mb-6">Choose how to import your existing wallet</p>

        <div className="space-y-3">
          <button
            onClick={() => { setImportMethod('phrase'); setStep('import-phrase'); }}
            className="w-full flex items-center gap-4 px-4 py-4 border border-subtle hover:border-rose/40 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-rose/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-display font-semibold text-text-heading">Recovery Phrase</div>
              <div className="text-[11px] text-text-muted">12 or 24-word seed phrase</div>
            </div>
          </button>

          <button
            onClick={() => { setImportMethod('privatekey'); setStep('import-privatekey'); }}
            className="w-full flex items-center gap-4 px-4 py-4 border border-subtle hover:border-rose/40 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-rose/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-display font-semibold text-text-heading">Private Key</div>
              <div className="text-[11px] text-text-muted">Base58-encoded Solana private key</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ─── Import: Recovery Phrase ───
  if (step === 'import-phrase') {
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <button onClick={() => setStep('import-choose')} className="self-start p-1 hover:bg-surface-hover mb-4">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Recovery Phrase</h2>
        <p className="text-xs text-text-muted mb-4">Enter your 12 or 24-word recovery phrase</p>

        <textarea
          value={importPhrase}
          onChange={(e) => setImportPhrase(e.target.value)}
          placeholder="word1 word2 word3 ..."
          rows={4}
          className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose resize-none mb-4"
        />

        <Button
          variant="primary"
          fullWidth
          size="lg"
          onClick={() => { setError(''); setStep('import-password'); }}
          disabled={!importPhrase.trim()}
        >
          Continue
        </Button>
      </div>
    );
  }

  // ─── Import: Private Key ───
  if (step === 'import-privatekey') {
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <button onClick={() => setStep('import-choose')} className="self-start p-1 hover:bg-surface-hover mb-4">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Private Key</h2>
        <p className="text-xs text-text-muted mb-4">Paste your base58-encoded Solana private key</p>

        <div className="bg-rose/5 border border-rose/20 px-3 py-2 mb-4">
          <p className="text-[10px] text-rose">
            Your private key will be encrypted with your password and stored locally. It never leaves your device.
          </p>
        </div>

        <textarea
          value={importPrivateKey}
          onChange={(e) => setImportPrivateKey(e.target.value)}
          placeholder="Paste your private key here..."
          rows={3}
          spellCheck={false}
          className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose resize-none mb-4 break-all"
        />

        <Button
          variant="primary"
          fullWidth
          size="lg"
          onClick={() => { setError(''); setStep('import-password'); }}
          disabled={!importPrivateKey.trim()}
        >
          Continue
        </Button>
      </div>
    );
  }

  // ─── Password (create new wallet) ───
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
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
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

  // ─── Show Recovery Phrase ───
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

  // ─── Confirm Phrase — WORD PICKER ───
  if (step === 'confirm-phrase') {
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <h2 className="font-display text-xl font-bold text-text-heading mb-2">Verify Phrase</h2>
        <p className="text-xs text-text-muted mb-4">
          Tap the correct word for each position to verify you saved your phrase.
        </p>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-5">
          {confirmIndices.map((wordIdx, i) => (
            <button
              key={wordIdx}
              onClick={() => setCurrentConfirmIdx(i)}
              className={`flex-1 py-2 text-center text-xs font-mono transition-all ${
                currentConfirmIdx === i
                  ? 'border-2 border-rose bg-rose/10 text-rose'
                  : selectedWords[i]
                  ? 'border border-green-500/40 bg-green-500/5 text-green-400'
                  : 'border border-subtle bg-surface-elevated text-text-muted'
              }`}
            >
              <span className="block text-[10px] text-text-disabled">Word #{wordIdx + 1}</span>
              <span className="block mt-0.5">{selectedWords[i] || '---'}</span>
            </button>
          ))}
        </div>

        {/* Word options for current slot */}
        <p className="text-xs text-text-muted mb-2">
          Select word #{confirmIndices[currentConfirmIdx] + 1}:
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {wordOptions[currentConfirmIdx]?.map((word) => (
            <button
              key={word}
              onClick={() => handleWordSelect(word)}
              className={`py-2.5 px-3 text-sm font-mono text-center transition-all ${
                selectedWords[currentConfirmIdx] === word
                  ? 'bg-rose/15 border-2 border-rose text-rose'
                  : 'bg-surface-elevated border border-subtle text-text-heading hover:border-rose/50'
              }`}
            >
              {word}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-error mb-2">{error}</p>}

        <div className="mt-auto pb-6">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={handlePhraseConfirmed}
            disabled={loading || selectedWords.some(w => w === null)}
          >
            {loading ? 'Creating Wallet...' : 'Confirm & Create Wallet'}
          </Button>
          <button
            onClick={() => {
              setStep('show-phrase');
              setSelectedWords([null, null, null]);
              setCurrentConfirmIdx(0);
              setError('');
            }}
            className="w-full mt-2 py-2 text-xs text-text-muted hover:text-text-body transition-colors"
          >
            Show phrase again
          </button>
        </div>
      </div>
    );
  }

  // ─── Import: Set Password ───
  if (step === 'import-password') {
    const isPhrase = importMethod === 'phrase';
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <button
          onClick={() => setStep(isPhrase ? 'import-phrase' : 'import-privatekey')}
          className="self-start p-1 hover:bg-surface-hover mb-4"
        >
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
              onKeyDown={(e) => e.key === 'Enter' && (isPhrase ? handleImportPhraseSubmit() : handleImportPrivateKeySubmit())}
              className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
            />
          </div>
        </div>

        {error && <p className="text-xs text-error mt-2">{error}</p>}

        <div className="mt-auto pb-6">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={isPhrase ? handleImportPhraseSubmit : handleImportPrivateKeySubmit}
            disabled={loading}
          >
            {loading ? 'Importing...' : 'Import Wallet'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── .myth Domain Registration ───
  if (step === 'myth-domain') {
    return (
      <div className="flex flex-col h-full px-6 pt-6">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-[#FF2D78]/10 border border-[#FF2D78]/20 flex items-center justify-center">
            <span className="font-display text-lg font-bold text-[#FF2D78]">.myth</span>
          </div>
        </div>

        <h2 className="font-display text-xl font-bold text-text-heading mb-2 text-center">
          Claim Your Identity
        </h2>
        <p className="text-xs text-text-muted mb-6 text-center">
          Register a <span className="text-[#FF2D78] font-semibold">.myth</span> username on the Mythic network. This is your on-chain identity.
        </p>

        <div className="relative mb-3">
          <input
            type="text"
            value={mythUsername}
            onChange={(e) => {
              setMythUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
              setDomainError('');
              setDomainSuccess('');
            }}
            placeholder="yourname"
            maxLength={24}
            spellCheck={false}
            className="w-full bg-surface-elevated border border-subtle px-3 py-3 pr-16 text-sm font-mono text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-[#FF2D78]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-[#FF2D78] font-semibold">
            .myth
          </span>
        </div>

        {mythUsername.length > 0 && mythUsername.length < 2 && (
          <p className="text-[10px] text-text-muted mb-2">Must be at least 2 characters</p>
        )}

        {domainError && (
          <div className="bg-rose/5 border border-rose/20 px-3 py-2 mb-3">
            <p className="text-[10px] text-rose">{domainError}</p>
          </div>
        )}

        {domainSuccess && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 mb-3">
            <p className="text-[10px] text-emerald-400 font-semibold">
              {domainSuccess} registered on-chain!
            </p>
          </div>
        )}

        <div className="space-y-2 mt-auto pb-6">
          {!domainSuccess ? (
            <>
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={handleRegisterDomain}
                disabled={domainLoading || mythUsername.length < 2}
              >
                {domainLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Registering...
                  </span>
                ) : (
                  `Register ${mythUsername || '...'}.myth`
                )}
              </Button>
              <Button variant="ghost" fullWidth size="md" onClick={() => onComplete(publicKey)}>
                Skip for now
              </Button>
            </>
          ) : (
            <Button variant="primary" fullWidth size="lg" onClick={() => onComplete(publicKey)}>
              Continue to Wallet
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
