<p align="center">
  <img src="https://wallet.mythic.sh/brand/mythic-wallet-logo.svg" alt="Mythic Wallet" width="120" />
</p>

<h1 align="center">Mythic Wallet</h1>

<p align="center">
  <strong>The official browser extension wallet for Mythic L2</strong>
</p>

<p align="center">
  <a href="https://github.com/MythicFoundation/mythic-wallet/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-39FF14?style=flat-square" alt="License" /></a>
  <a href="https://github.com/MythicFoundation/mythic-wallet/actions"><img src="https://img.shields.io/badge/Build-Passing-39FF14?style=flat-square" alt="Build" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Version-1.2.0-7B2FFF?style=flat-square" alt="Version" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Manifest-V3-39FF14?style=flat-square" alt="Manifest V3" /></a>
</p>

<p align="center">
  <a href="https://wallet.mythic.sh">Web Wallet</a> &nbsp;|&nbsp;
  <a href="https://mythic.sh/docs">Documentation</a> &nbsp;|&nbsp;
  <a href="https://mythic.sh">Mythic L2</a>
</p>

---

## Overview

Mythic Wallet is a non-custodial browser extension wallet purpose-built for the Mythic L2 network. It supports sending and receiving MYTH and all L2 tokens, cross-chain bridging between Solana L1 and Mythic L2, and direct interaction with Mythic dApps. Built with Chrome Manifest V3, React 18, and Vite for a fast, secure experience.

## Features

- **Send and Receive** -- Transfer MYTH, wSOL, USDC, wBTC, wETH, and any SPL token on Mythic L2
- **Cross-Chain Bridge** -- Bridge assets between Solana L1 and Mythic L2 directly from the wallet
- **HD Wallet** -- BIP39 mnemonic seed phrase with HD key derivation
- **Multi-Network** -- Switch between Mythic L2 mainnet, testnet, and Solana mainnet
- **Token Portfolio** -- View all token balances with real-time prices
- **Transaction History** -- Browse recent transactions with status indicators
- **QR Code Receive** -- Generate QR codes for receiving tokens
- **Lock Screen** -- Password-protected access with auto-lock
- **Settings** -- Network configuration, export keys, manage accounts

## Security Model

- **Non-Custodial** -- Private keys never leave the device
- **Encrypted Storage** -- Keys are encrypted with AES-256 in `chrome.storage.local`
- **Minimal Permissions** -- Only `storage` permission required; network access scoped to Mythic RPC endpoints
- **No Analytics** -- Zero tracking, zero telemetry
- **Open Source** -- Full source code available for audit

## Install

### Chrome Web Store

> Coming soon -- the extension will be available on the Chrome Web Store at launch.

### Build from Source

```bash
git clone https://github.com/MythicFoundation/mythic-wallet.git
cd mythic-wallet
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension in Chrome:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` directory

## Tech Stack

- **Runtime:** Chrome Extension Manifest V3
- **UI Framework:** React 18 with TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS
- **Cryptography:** `tweetnacl` (Ed25519), `bip39` (mnemonics), `ed25519-hd-key` (HD derivation)
- **Blockchain:** `@solana/web3.js`
- **QR Codes:** `qrcode.react`
- **Typography:** Sora (display), Inter (body), JetBrains Mono (code)

## Directory Structure

```
mythic-wallet/
├── manifest.json            # Chrome Manifest V3 configuration
├── src/
│   ├── popup/               # Extension popup UI
│   │   ├── App.tsx          # Root component and router
│   │   ├── index.tsx        # Popup entrypoint
│   │   ├── pages/
│   │   │   ├── Home.tsx             # Main wallet dashboard
│   │   │   ├── Send.tsx             # Token send flow
│   │   │   ├── Receive.tsx          # QR code receive page
│   │   │   ├── Bridge.tsx           # L1 <-> L2 bridge interface
│   │   │   ├── TransactionHistory.tsx # Recent transactions
│   │   │   ├── Settings.tsx         # Wallet settings
│   │   │   ├── Onboarding.tsx       # Seed phrase creation/import
│   │   │   └── Lock.tsx             # Lock screen
│   │   └── components/
│   │       ├── Header.tsx           # Navigation header
│   │       ├── Button.tsx           # Styled button component
│   │       ├── TokenList.tsx        # Token balance list
│   │       └── TransactionItem.tsx  # Transaction row component
│   ├── background/          # Service worker (background scripts)
│   ├── content/             # Content scripts for dApp injection
│   ├── lib/
│   │   ├── wallet.ts        # Key management and signing
│   │   └── storage.ts       # Encrypted chrome.storage wrapper
│   └── styles/              # Global CSS and Tailwind config
├── public/
│   └── icons/               # Extension icons (16, 32, 48, 128px)
├── vite.config.ts           # Vite build configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json
└── package.json
```

## Supported Networks

| Network | RPC Endpoint |
|---------|-------------|
| Mythic L2 Mainnet | `https://rpc.mythic.sh` |
| Mythic L2 Testnet | `https://testnet.mythic.sh` |
| Solana Mainnet | `https://api.mainnet-beta.solana.com` |

## Supported Tokens

| Token | Decimals | Mint Address |
|-------|----------|-------------|
| MYTH | 6 | `7sfazeMxmuoDkuU5fHkDGin8uYuaTkZrRSwJM1CHXvDq` |
| wSOL | 9 | `FEJa8wGyhXu9Hic1jNTg76Atb57C7jFkmDyDTQZkVwy3` |
| USDC | 6 | `6QTVHn4TUPQSpCH1uGmAK1Vd6JhuSEeKMKSi1F1SZMN` |
| wBTC | 8 | `8Go32n5Pv4HYdML9DNr8ePh4UHunqS9ZgjKMurz1vPSw` |
| wETH | 8 | `4zmzPzkexJRCVKSrYCHpmP8TVX6kMobjiFu8dVKtuXGT` |

## Development

### Run in Watch Mode

```bash
npm run dev
```

This rebuilds the extension on every file change. Reload the extension in Chrome to see updates.

### Production Build

```bash
npm run build
```

The production-optimized build is output to `dist/`.

## Contributing

We welcome contributions. To get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Ensure the build passes (`npm run build`)
4. Test the extension manually in Chrome
5. Submit a pull request

## Security

If you discover a security vulnerability in Mythic Wallet, please report it responsibly:

- Email: security@mythic.sh
- Do NOT open public issues for security vulnerabilities
- We will acknowledge receipt within 24 hours

## License


This project is licensed under the [Business Source License 1.1](./LICENSE). The Licensed Work will convert to MIT License on February 25, 2028.
