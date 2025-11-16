/**
 * wallet.js - Wallet connection and state management
 */

import { log, setUi, elements } from './ui.js';

// Wallet state
export let provider = null;
export let wallet = null;

/**
 * Set wallet and provider (used internally and by other modules)
 */
export function setWallet(newProvider, newWallet) {
  provider = newProvider;
  wallet = newWallet;
}

/**
 * Get current wallet public key
 */
export function getWallet() {
  return wallet;
}

/**
 * Get current provider
 */
export function getProvider() {
  return provider;
}

/**
 * Connect wallet
 */
export async function connectWallet() {
  const injected = window.phantom?.solana || window.solana;
  if (!injected || !injected.isPhantom) {
    log('Phantom wallet not found. Install: https://phantom.app/', 'error');
    window.open('https://phantom.app/', '_blank');
    return;
  }
  
  try {
    provider = injected;
    log('Requesting wallet connection...', 'info');
    const res = await provider.connect();
    wallet = provider.publicKey || res?.publicKey;
    if (!wallet) throw new Error('No public key returned.');
    log('Wallet connected.', 'success');
    log(`Address: ${wallet.toString()}`);
    elements.connectBtn.textContent = `Connected: ${wallet.toString().slice(0, 4)}...${wallet.toString().slice(-4)}`;
    elements.connectBtn.classList.replace('bg-indigo-600', 'bg-slate-700');
    setUi(true);

    if (provider.on) {
      provider.on('disconnect', () => {
        log('Wallet disconnected.', 'error');
        wallet = null;
        provider = null;
        elements.connectBtn.textContent = 'Connect Wallet';
        elements.connectBtn.classList.replace('bg-slate-700', 'bg-indigo-600');
        setUi(false);
      });
    }
  } catch (e) {
    const msg = e?.message || String(e);
    if (e?.code === 4001) log('User rejected connection.', 'error');
    else log(`Connect error: ${msg}`, 'error');
  }
}
