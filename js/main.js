/**
 * main.js - Main entry point and event binding
 */

import { 
  initRpcConfig, 
  renderEndpointsList, 
  editEndpoint, 
  cancelEditEndpoint, 
  saveEndpoint, 
  setPrimaryEndpoint, 
  toggleEndpointEnabled, 
  moveEndpointUp, 
  moveEndpointDown, 
  removeEndpoint, 
  addCustomEndpoint, 
  resetEndpointsToDefaults, 
  updateConsensusThreshold,
  updateCurrentCluster,
  userRpcEndpoints,
  primaryEndpointByCluster,
  minConsensusThreshold
} from './rpc-config.js';

import { connectWallet } from './wallet.js';

import { 
  elements, 
  clearLog, 
  setUi, 
  resetProgress, 
  resetSendBtn,
  applyRecipientsNormalization,
  log
} from './ui.js';

import { initializeConnection, sendTransactions } from './transactions.js';

/**
 * Initialize the application
 */
async function init() {
  // Load RPC configuration
  await initRpcConfig();
  
  // Initialize connection with primary endpoint
  initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
  
  // Set initial consensus threshold in UI
  const thresholdInput = document.getElementById('min-consensus-threshold');
  if (thresholdInput) {
    thresholdInput.value = minConsensusThreshold;
  }
  
  setUi(false);
  resetProgress();
  
  log('Welcome! Connect your wallet to begin.', 'info');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Connect wallet button
  elements.connectBtn.addEventListener('click', async () => {
    await connectWallet();
    // Re-initialize connection after wallet connects
    initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
  });
  
  // Clear log button
  elements.clearLogBtn.addEventListener('click', clearLog);
  
  // Cluster selection change
  elements.clusterSelect.addEventListener('change', () => {
    updateCurrentCluster();
    const section = document.getElementById('rpc-verification-section');
    if (section.style.display !== 'none') {
      renderEndpointsList();
    }
    initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
  });
  
  // Toggle RPC section visibility
  document.getElementById('toggle-rpc-section')?.addEventListener('click', () => {
    const section = document.getElementById('rpc-verification-section');
    if (section.style.display === 'none') {
      section.style.display = 'block';
      renderEndpointsList();
    } else {
      section.style.display = 'none';
    }
  });
  
  // Toggle add endpoint form
  document.getElementById('toggle-add-endpoint')?.addEventListener('click', () => {
    const form = document.getElementById('add-endpoint-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });
  
  // Cancel add endpoint
  document.getElementById('cancel-add-endpoint-btn')?.addEventListener('click', () => {
    document.getElementById('add-endpoint-form').style.display = 'none';
    document.getElementById('new-endpoint-label').value = '';
    document.getElementById('new-endpoint-url').value = '';
    document.getElementById('new-endpoint-apikey').value = '';
  });
  
  // Add new endpoint
  document.getElementById('add-endpoint-btn')?.addEventListener('click', () => {
    const label = document.getElementById('new-endpoint-label').value.trim();
    const url = document.getElementById('new-endpoint-url').value.trim();
    const apiKey = document.getElementById('new-endpoint-apikey').value.trim();
    
    if (!label || !url) {
      alert('Please provide both a label and URL for the endpoint.');
      return;
    }
    
    addCustomEndpoint(label, url, apiKey);
    
    // Clear form
    document.getElementById('new-endpoint-label').value = '';
    document.getElementById('new-endpoint-url').value = '';
    document.getElementById('new-endpoint-apikey').value = '';
    document.getElementById('add-endpoint-form').style.display = 'none';
    
    // Re-initialize connection if needed
    initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
  });
  
  // Update consensus threshold
  document.getElementById('min-consensus-threshold')?.addEventListener('change', (e) => {
    updateConsensusThreshold(e.target.value);
  });
  
  // Reset endpoints to defaults
  document.getElementById('reset-endpoints-btn')?.addEventListener('click', () => {
    resetEndpointsToDefaults();
    initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
  });
  
  // Info link for consensus explanation
  document.getElementById('info-consensus-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert(
      'Consensus Verification Explained:\n\n' +
      'After each transaction is confirmed, we query multiple independent RPC endpoints to verify the transaction is finalized.\n\n' +
      'Why? Different RPC providers may have slightly different views of the blockchain state. By requiring multiple endpoints to agree, we ensure greater confidence that your transaction succeeded.\n\n' +
      'Minimum Consensus Threshold: The number of endpoints that must report "finalized" status for the transaction to be considered successful.\n\n' +
      'Example: With 3 endpoints and threshold of 2, at least 2 must confirm the transaction.\n\n' +
      'Recommendation: Use at least 3 endpoints from different providers (e.g., Solana official, Helius, QuickNode) for best reliability.'
    );
  });
  
  // Recipients normalization - passive auto-trim events
  elements.recipientsInput.addEventListener('blur', applyRecipientsNormalization);
  elements.recipientsInput.addEventListener('change', applyRecipientsNormalization);
  elements.recipientsInput.addEventListener('paste', () => setTimeout(applyRecipientsNormalization, 0));
  
  // Manual trim button
  if (elements.trimRecipientsBtn) {
    elements.trimRecipientsBtn.addEventListener('click', applyRecipientsNormalization);
  }
  
  // Send button
  elements.sendBtn.addEventListener('click', async () => {
    elements.sendBtn.disabled = true;
    elements.sendBtn.textContent = 'Processing...';
    resetProgress();
    log('Starting multisend with retries...', 'info');
    
    const mintStr = elements.mintInput.value.trim();
    
    // Safety normalization before parsing recipients
    applyRecipientsNormalization();
    const listStr = elements.recipientsInput.value.trim();
    
    const batchSize = parseInt(elements.batchSizeInput.value, 10);
    
    if (!mintStr) {
      log('Mint address required.', 'error');
      resetSendBtn();
      return;
    }
    if (!listStr) {
      log('Recipients list empty.', 'error');
      resetSendBtn();
      return;
    }
    if (isNaN(batchSize) || batchSize <= 0 || batchSize > 12) {
      log('Batch size 1–12 required.', 'error');
      resetSendBtn();
      return;
    }
    
    try {
      await sendTransactions(mintStr, listStr, batchSize, userRpcEndpoints, primaryEndpointByCluster);
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
        log('RPC returned 403 (forbidden). Use a Custom RPC URL from your provider and try again.', 'error');
      }
      log(`Error: ${msg}`, 'error');
      if (err?.stack) log(err.stack, 'error');
    } finally {
      resetSendBtn();
    }
  });
  
  // Delegate click events for dynamically rendered endpoint list
  document.getElementById('rpc-endpoints-list')?.addEventListener('click', (e) => {
    const target = e.target;
    const action = target.getAttribute('data-action');
    const idx = parseInt(target.getAttribute('data-idx'), 10);
    
    if (!action) return;
    
    switch (action) {
      case 'edit-endpoint':
        editEndpoint(idx);
        break;
      case 'save-endpoint':
        saveEndpoint(idx);
        initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
        break;
      case 'cancel-edit-endpoint':
        cancelEditEndpoint();
        break;
      case 'set-primary-endpoint':
        setPrimaryEndpoint(idx);
        initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
        break;
      case 'toggle-endpoint-enabled':
        toggleEndpointEnabled(idx);
        initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
        break;
      case 'move-endpoint-up':
        moveEndpointUp(idx);
        initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
        break;
      case 'move-endpoint-down':
        moveEndpointDown(idx);
        initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
        break;
      case 'remove-endpoint':
        removeEndpoint(idx);
        initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
        break;
    }
  });
  
  // Also handle change events for checkboxes/radios (they don't always trigger click)
  document.getElementById('rpc-endpoints-list')?.addEventListener('change', (e) => {
    const target = e.target;
    const action = target.getAttribute('data-action');
    const idx = parseInt(target.getAttribute('data-idx'), 10);
    
    if (!action) return;
    
    if (action === 'set-primary-endpoint') {
      setPrimaryEndpoint(idx);
      initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
    } else if (action === 'toggle-endpoint-enabled') {
      toggleEndpointEnabled(idx);
      initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
    }
  });
}

/**
 * Start the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
  await init();
  setupEventListeners();
});
