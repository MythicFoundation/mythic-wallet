import React from "react";

interface ConnectApprovalProps {
  origin: string;
  onApprove: () => void;
  onReject: () => void;
}

export default function ConnectApproval({
  origin,
  onApprove,
  onReject,
}: ConnectApprovalProps) {
  // Extract a display-friendly domain from the origin
  let displayOrigin = origin;
  try {
    const url = new URL(origin);
    displayOrigin = url.hostname;
  } catch {
    // Use raw origin if parsing fails
  }

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header */}
      <div className="flex items-center justify-center px-4 py-3 border-b border-border-subtle">
        <svg
          viewBox="0 0 100 100"
          className="w-6 h-6 mr-2"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="50,8 20,44 50,56" fill="#FF2D78" opacity="0.92" />
          <polygon points="50,8 80,44 50,56" fill="#FF5C96" opacity="0.78" />
          <polygon points="20,44 50,56 80,44 50,92" fill="#CC2460" opacity="0.88" />
        </svg>
        <span className="text-sm font-semibold text-text-primary">
          Connection Request
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Site icon placeholder */}
        <div className="w-14 h-14 bg-surface-raised border border-border-subtle flex items-center justify-center mb-4">
          <svg
            className="w-7 h-7 text-text-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
        </div>

        <p className="text-base font-semibold text-text-primary mb-1">
          {displayOrigin}
        </p>
        <p className="text-xs text-text-secondary text-center mb-6 leading-relaxed">
          wants to connect to your Mythic wallet.
          This will allow the site to view your public address.
        </p>

        {/* Permissions */}
        <div className="w-full bg-surface-raised border border-border-subtle p-3 mb-6">
          <p className="text-xs font-medium text-text-secondary mb-2">
            This site will be able to:
          </p>
          <ul className="space-y-1.5">
            <li className="flex items-center text-xs text-text-tertiary">
              <svg className="w-3.5 h-3.5 mr-2 text-accent-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              View your wallet address
            </li>
            <li className="flex items-center text-xs text-text-tertiary">
              <svg className="w-3.5 h-3.5 mr-2 text-accent-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Request transaction signatures
            </li>
          </ul>
        </div>

        <p className="text-[10px] text-text-tertiary text-center mb-4">
          You can revoke access anytime in Settings.
        </p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-3">
        <button
          onClick={onReject}
          className="flex-1 px-4 py-2.5 bg-surface-raised border border-border-subtle text-text-primary text-sm font-medium hover:border-accent-primary/30 transition-colors"
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          className="flex-1 px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white text-sm font-semibold transition-colors"
        >
          Connect
        </button>
      </div>
    </div>
  );
}
