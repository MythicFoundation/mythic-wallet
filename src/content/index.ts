// Mythic Wallet — Content Script
// Injects the window.mythic provider into web pages

function injectProvider() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      'use strict';

      class MythicWalletProvider {
        constructor() {
          this.isConnected = false;
          this.publicKey = null;
          this._listeners = {};
        }

        async connect() {
          return new Promise((resolve, reject) => {
            window.postMessage({ type: 'MYTHIC_CONNECT_REQUEST', origin: window.location.origin }, '*');

            const handler = (event) => {
              if (event.data.type === 'MYTHIC_CONNECT_RESPONSE') {
                window.removeEventListener('message', handler);
                if (event.data.error) {
                  reject(new Error(event.data.error));
                } else {
                  this.isConnected = true;
                  this.publicKey = event.data.publicKey;
                  this._emit('connect', { publicKey: this.publicKey });
                  resolve({ publicKey: this.publicKey });
                }
              }
            };
            window.addEventListener('message', handler);
          });
        }

        async disconnect() {
          window.postMessage({ type: 'MYTHIC_DISCONNECT_REQUEST', origin: window.location.origin }, '*');
          this.isConnected = false;
          this.publicKey = null;
          this._emit('disconnect');
        }

        async signTransaction(transaction) {
          return new Promise((resolve, reject) => {
            window.postMessage({
              type: 'MYTHIC_SIGN_TRANSACTION_REQUEST',
              transaction: JSON.stringify(transaction),
            }, '*');

            const handler = (event) => {
              if (event.data.type === 'MYTHIC_SIGN_TRANSACTION_RESPONSE') {
                window.removeEventListener('message', handler);
                if (event.data.error) {
                  reject(new Error(event.data.error));
                } else {
                  resolve(event.data.signedTransaction);
                }
              }
            };
            window.addEventListener('message', handler);
          });
        }

        async signMessage(message) {
          return new Promise((resolve, reject) => {
            window.postMessage({
              type: 'MYTHIC_SIGN_MESSAGE_REQUEST',
              message: typeof message === 'string' ? message : Array.from(message),
            }, '*');

            const handler = (event) => {
              if (event.data.type === 'MYTHIC_SIGN_MESSAGE_RESPONSE') {
                window.removeEventListener('message', handler);
                if (event.data.error) {
                  reject(new Error(event.data.error));
                } else {
                  resolve({ signature: new Uint8Array(event.data.signature) });
                }
              }
            };
            window.addEventListener('message', handler);
          });
        }

        on(event, callback) {
          if (!this._listeners[event]) this._listeners[event] = [];
          this._listeners[event].push(callback);
        }

        off(event, callback) {
          if (!this._listeners[event]) return;
          this._listeners[event] = this._listeners[event].filter(function(cb) { return cb !== callback; });
        }

        _emit(event, data) {
          if (!this._listeners[event]) return;
          this._listeners[event].forEach(function(cb) { cb(data); });
        }
      }

      if (!window.mythic) {
        window.mythic = new MythicWalletProvider();
      }
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Relay messages between page and background
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'MYTHIC_CONNECT_REQUEST') {
    chrome.runtime.sendMessage(
      { type: 'MYTHIC_CONNECT', origin: event.data.origin },
      (response) => {
        window.postMessage({
          type: 'MYTHIC_CONNECT_RESPONSE',
          ...response,
        }, '*');
      },
    );
  }

  if (event.data.type === 'MYTHIC_DISCONNECT_REQUEST') {
    chrome.runtime.sendMessage(
      { type: 'MYTHIC_DISCONNECT', origin: event.data.origin },
      (response) => {
        window.postMessage({
          type: 'MYTHIC_DISCONNECT_RESPONSE',
          ...response,
        }, '*');
      },
    );
  }

  if (event.data.type === 'MYTHIC_SIGN_TRANSACTION_REQUEST') {
    // In production, this would open a popup for transaction approval
    window.postMessage({
      type: 'MYTHIC_SIGN_TRANSACTION_RESPONSE',
      error: 'Transaction signing not yet implemented in this version',
    }, '*');
  }

  if (event.data.type === 'MYTHIC_SIGN_MESSAGE_REQUEST') {
    window.postMessage({
      type: 'MYTHIC_SIGN_MESSAGE_RESPONSE',
      error: 'Message signing not yet implemented in this version',
    }, '*');
  }
});

injectProvider();
