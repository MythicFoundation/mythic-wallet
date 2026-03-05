// Mythic Wallet — Content Script
// Injects the window.mythic provider into web pages

function injectProvider() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      'use strict';

      class MythicWalletProvider {
        constructor() {
          this.isMythicWallet = true;
          this.isConnected = false;
          this.publicKey = null;
          this._listeners = {};
        }

        get connected() {
          return this.isConnected;
        }

        async connect() {
          return new Promise((resolve, reject) => {
            window.postMessage({ type: 'MYTHIC_CONNECT_REQUEST', origin: window.location.origin }, '*');

            var handler = function(event) {
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
            }.bind(this);
            window.addEventListener('message', handler);

            setTimeout(function() {
              window.removeEventListener('message', handler);
              reject(new Error('Connection request timed out'));
            }, 60000);
          });
        }

        async disconnect() {
          window.postMessage({ type: 'MYTHIC_DISCONNECT_REQUEST', origin: window.location.origin }, '*');
          this.isConnected = false;
          this.publicKey = null;
          this._emit('disconnect');
        }

        async signTransaction(transaction) {
          var txBase64;
          if (typeof transaction === 'string') {
            txBase64 = transaction;
          } else if (transaction && typeof transaction.serialize === 'function') {
            try {
              txBase64 = btoa(String.fromCharCode.apply(null, transaction.serialize({ requireAllSignatures: false, verifySignatures: false })));
            } catch(e) {
              try {
                txBase64 = btoa(String.fromCharCode.apply(null, transaction.serialize({ requireAllSignatures: false })));
              } catch(e2) {
                throw new Error('Failed to serialize transaction: ' + (e2.message || e.message));
              }
            }
          } else if (transaction instanceof Uint8Array || (transaction && transaction.constructor && transaction.constructor.name === 'Uint8Array')) {
            txBase64 = btoa(String.fromCharCode.apply(null, transaction));
          } else {
            throw new Error('Unsupported transaction format. Pass a Transaction object or base64 string.');
          }

          return new Promise(function(resolve, reject) {
            var requestId = 'sign_tx_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            window.postMessage({
              type: 'MYTHIC_SIGN_TRANSACTION_REQUEST',
              requestId: requestId,
              transaction: txBase64,
            }, '*');

            var handler = function(event) {
              if (event.data.type === 'MYTHIC_SIGN_TRANSACTION_RESPONSE' && event.data.requestId === requestId) {
                window.removeEventListener('message', handler);
                if (event.data.error) {
                  reject(new Error(event.data.error));
                } else {
                  try {
                    var raw = atob(event.data.signedTransaction);
                    var bytes = new Uint8Array(raw.length);
                    for (var j = 0; j < raw.length; j++) bytes[j] = raw.charCodeAt(j);
                    var signedTx = {
                      _signedBytes: bytes,
                      _signedBase64: event.data.signedTransaction,
                      serialize: function() { return this._signedBytes; },
                    };
                    resolve(signedTx);
                  } catch(e) {
                    resolve(event.data.signedTransaction);
                  }
                }
              }
            };
            window.addEventListener('message', handler);

            setTimeout(function() {
              window.removeEventListener('message', handler);
              reject(new Error('Transaction signing timed out'));
            }, 120000);
          });
        }

        async signAllTransactions(transactions) {
          var signed = [];
          for (var i = 0; i < transactions.length; i++) {
            signed.push(await this.signTransaction(transactions[i]));
          }
          return signed;
        }

        async signMessage(message) {
          return new Promise(function(resolve, reject) {
            var requestId = 'sign_msg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            var msgData;
            if (typeof message === 'string') {
              msgData = message;
            } else {
              msgData = Array.from(message);
            }
            window.postMessage({
              type: 'MYTHIC_SIGN_MESSAGE_REQUEST',
              requestId: requestId,
              message: msgData,
            }, '*');

            var handler = function(event) {
              if (event.data.type === 'MYTHIC_SIGN_MESSAGE_RESPONSE' && event.data.requestId === requestId) {
                window.removeEventListener('message', handler);
                if (event.data.error) {
                  reject(new Error(event.data.error));
                } else {
                  resolve({ signature: new Uint8Array(event.data.signature) });
                }
              }
            };
            window.addEventListener('message', handler);

            setTimeout(function() {
              window.removeEventListener('message', handler);
              reject(new Error('Message signing timed out'));
            }, 120000);
          });
        }

        async signAndSendTransaction(transaction, options) {
          var self = this;
          var signed = await self.signTransaction(transaction);
          return new Promise(function(resolve, reject) {
            var requestId = 'send_tx_' + Date.now() + '_' + Math.random().toString(36).slice(2);

            var signedBase64;
            if (typeof signed === 'string') {
              signedBase64 = signed;
            } else if (signed && signed._signedBase64) {
              signedBase64 = signed._signedBase64;
            } else if (signed && typeof signed.serialize === 'function') {
              var raw = signed.serialize();
              signedBase64 = btoa(String.fromCharCode.apply(null, raw));
            } else {
              reject(new Error('Cannot serialize signed transaction'));
              return;
            }

            window.postMessage({
              type: 'MYTHIC_SEND_TRANSACTION_REQUEST',
              requestId: requestId,
              signedTransaction: signedBase64,
              options: options || {},
            }, '*');

            var handler = function(event) {
              if (event.data.type === 'MYTHIC_SEND_TRANSACTION_RESPONSE' && event.data.requestId === requestId) {
                window.removeEventListener('message', handler);
                if (event.data.error) {
                  reject(new Error(event.data.error));
                } else {
                  resolve({ signature: event.data.signature });
                }
              }
            };
            window.addEventListener('message', handler);

            setTimeout(function() {
              window.removeEventListener('message', handler);
              reject(new Error('Send transaction timed out'));
            }, 120000);
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
        window.dispatchEvent(new Event('mythic#initialized'));
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
    chrome.runtime.sendMessage(
      {
        type: 'MYTHIC_SIGN_TRANSACTION',
        requestId: event.data.requestId,
        transaction: event.data.transaction,
        origin: window.location.origin,
      },
      (response) => {
        window.postMessage({
          type: 'MYTHIC_SIGN_TRANSACTION_RESPONSE',
          requestId: event.data.requestId,
          ...response,
        }, '*');
      },
    );
  }

  if (event.data.type === 'MYTHIC_SIGN_MESSAGE_REQUEST') {
    chrome.runtime.sendMessage(
      {
        type: 'MYTHIC_SIGN_MESSAGE',
        requestId: event.data.requestId,
        message: event.data.message,
        origin: window.location.origin,
      },
      (response) => {
        window.postMessage({
          type: 'MYTHIC_SIGN_MESSAGE_RESPONSE',
          requestId: event.data.requestId,
          ...response,
        }, '*');
      },
    );
  }

  if (event.data.type === 'MYTHIC_SEND_TRANSACTION_REQUEST') {
    chrome.runtime.sendMessage(
      {
        type: 'MYTHIC_SEND_TRANSACTION',
        requestId: event.data.requestId,
        signedTransaction: event.data.signedTransaction,
        options: event.data.options,
        origin: window.location.origin,
      },
      (response) => {
        window.postMessage({
          type: 'MYTHIC_SEND_TRANSACTION_RESPONSE',
          requestId: event.data.requestId,
          ...response,
        }, '*');
      },
    );
  }
});

injectProvider();
