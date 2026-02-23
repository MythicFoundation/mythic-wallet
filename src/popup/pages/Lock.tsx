import React, { useState } from 'react';
import Button from '../components/Button';

interface LockProps {
  onUnlock: (password: string) => Promise<boolean>;
}

export default function Lock({ onUnlock }: LockProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    const success = await onUnlock(password);
    if (!success) {
      setError('Incorrect password');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <svg viewBox="0 0 100 100" className="w-16 h-16 mb-4" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,8 20,44 50,56" fill="#FF2D78" opacity="0.92"/>
        <polygon points="50,8 80,44 50,56" fill="#FF5C96" opacity="0.78"/>
        <polygon points="20,44 50,56 80,44 50,92" fill="#CC2460" opacity="0.88"/>
      </svg>

      <h1 className="font-display text-xl font-bold text-text-heading mb-1">Mythic Wallet</h1>
      <p className="text-xs text-text-muted mb-6">Enter your password to unlock</p>

      <div className="w-full mb-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Password"
          autoFocus
          className="w-full bg-surface-elevated border border-subtle px-3 py-2.5 text-sm text-text-heading placeholder:text-text-disabled focus:outline-none focus:border-rose"
        />
        {error && <p className="text-xs text-error mt-1.5">{error}</p>}
      </div>

      <Button variant="primary" fullWidth size="lg" onClick={handleUnlock} disabled={loading || !password}>
        {loading ? 'Unlocking...' : 'Unlock'}
      </Button>
    </div>
  );
}
