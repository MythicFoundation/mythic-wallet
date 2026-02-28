import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../components/Button';
import { truncateAddress, NETWORKS, type NetworkId } from '../../lib/wallet';

interface ReceiveProps {
  address: string;
  network: NetworkId;
  onBack: () => void;
}

export default function Receive({ address, network, onBack }: ReceiveProps) {
  const net = NETWORKS[network];
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
        <button onClick={onBack} className="p-1 hover:bg-surface-hover">
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-base font-bold">Receive</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* QR Code */}
        <div className="bg-white p-4 mb-6">
          <QRCodeSVG
            value={address}
            size={180}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="M"
          />
        </div>

        <p className="text-xs text-text-muted mb-2 font-sans">Your Wallet Address</p>

        {/* Full Address */}
        <div className="bg-surface-elevated border border-subtle px-4 py-3 w-full mb-4">
          <p className="font-mono text-xs text-text-body break-all text-center leading-relaxed">
            {address}
          </p>
        </div>

        <Button variant="primary" fullWidth onClick={handleCopy}>
          {copied ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Address
            </span>
          )}
        </Button>

        <p className="text-[10px] text-text-muted mt-4 text-center">
          Only send tokens on <span className="text-text-body font-semibold">{net.name}</span> to this address
        </p>
      </div>
    </div>
  );
}
