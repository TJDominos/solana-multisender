/**
 * ui.js - UI helpers, logging, and progress tracking
 */

// UI element references
export const elements = {
  connectBtn: document.getElementById('connect-wallet-btn'),
  clusterSelect: document.getElementById('cluster-select'),
  mintInput: document.getElementById('token-mint-address'),
  recipientsInput: document.getElementById('recipients-list'),
  trimRecipientsBtn: document.getElementById('trim-recipients-btn'),
  batchSizeInput: document.getElementById('batch-size'),
  sendBtn: document.getElementById('send-btn'),
  hint: document.getElementById('connect-hint'),
  clearLogBtn: document.getElementById('clear-log-btn'),
  logOutput: document.getElementById('log-output'),
  progressBar: document.getElementById('progress-bar'),
  progressLabel: document.getElementById('progress-label'),
  countCompleted: document.getElementById('count-completed'),
  countPending: document.getElementById('count-pending'),
  countFailed: document.getElementById('count-failed'),
  toggleCompleted: document.getElementById('toggle-completed'),
  togglePending: document.getElementById('toggle-pending'),
  toggleFailed: document.getElementById('toggle-failed'),
  detailsCompleted: document.getElementById('details-completed'),
  detailsPending: document.getElementById('details-pending'),
  detailsFailed: document.getElementById('details-failed')
};

// Progress tracking state
export const progressState = {
  allRecipients: [],
  completedRecipients: new Set(),
  failedRecipients: []
};

// Toggle state for expandable sections
const toggleState = {
  completed: false,
  pending: false,
  failed: false
};

/**
 * Log a message to the log output
 * @param {string} msg - Message to log
 * @param {string} type - Message type: 'info', 'success', 'error', 'warning'
 */
export function log(msg, type = 'info') {
  const ts = new Date().toLocaleTimeString();
  const color = type === 'error' ? 'text-red-400'
    : type === 'success' ? 'text-green-400'
    : type === 'warning' ? 'text-yellow-400'
    : 'text-slate-300';
  elements.logOutput.innerHTML += `\n<div class="${color}"><span class="text-slate-500">${ts}:</span> ${msg}</div>`;
  elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
}

/**
 * Clear the log output
 */
export function clearLog() {
  elements.logOutput.innerHTML = 'Log cleared.';
}

/**
 * Set UI enabled/disabled state based on wallet connection
 * @param {boolean} connected - Whether wallet is connected
 */
export function setUi(connected) {
  elements.mintInput.disabled = !connected;
  elements.recipientsInput.disabled = !connected;
  elements.batchSizeInput.disabled = !connected;
  elements.sendBtn.disabled = !connected;
  elements.sendBtn.textContent = connected ? 'Prepare & Send Transactions' : 'Connect Wallet to Start';
  elements.hint.textContent = connected
    ? 'Wallet connected. Enter mint & recipients.'
    : 'Please connect your wallet first to enable the form.';
}

/**
 * Update progress bar and counters
 */
export function updateProgress() {
  const total = progressState.allRecipients.length;
  const done = progressState.completedRecipients.size;
  const failed = progressState.failedRecipients.length;
  const pending = Math.max(0, total - done - failed);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  elements.progressBar.style.width = pct + '%';
  elements.progressLabel.textContent = `${done} / ${total} (${pct}%)`;
  elements.countCompleted.textContent = String(done);
  elements.countPending.textContent = String(pending);
  elements.countFailed.textContent = String(failed);

  // Update detail lists if expanded
  if (toggleState.completed) {
    updateCompletedDetails();
  }
  if (toggleState.pending) {
    updatePendingDetails();
  }
  if (toggleState.failed) {
    updateFailedDetails();
  }
}

/**
 * Update completed details list
 */
function updateCompletedDetails() {
  if (!elements.detailsCompleted) return;
  
  const completedList = Array.from(progressState.completedRecipients);
  if (completedList.length === 0) {
    elements.detailsCompleted.innerHTML = '<div class="text-slate-500">No completed transfers yet.</div>';
    return;
  }

  // Find decimals from allRecipients (if available)
  const recipientsMap = new Map(
    progressState.allRecipients.map(r => [r.address.toString(), r])
  );

  const html = completedList.map(addrStr => {
    const recipient = recipientsMap.get(addrStr);
    const amount = recipient ? formatAmount(recipient.amount, getDecimals()) : 'N/A';
    const shortAddr = `${addrStr.slice(0, 4)}...${addrStr.slice(-4)}`;
    return `<div class="py-1 border-b border-slate-600 last:border-0">
      <span class="text-slate-300">${shortAddr}</span>
      <span class="text-green-400 float-right">${amount}</span>
    </div>`;
  }).join('');

  elements.detailsCompleted.innerHTML = html;
}

/**
 * Update pending details list
 */
function updatePendingDetails() {
  if (!elements.detailsPending) return;
  
  // Pending = all recipients minus completed and failed
  const completedSet = progressState.completedRecipients;
  const failedSet = new Set(progressState.failedRecipients.map(r => r.address.toString()));
  
  const pendingList = progressState.allRecipients.filter(r => {
    const addrStr = r.address.toString();
    return !completedSet.has(addrStr) && !failedSet.has(addrStr);
  });

  if (pendingList.length === 0) {
    elements.detailsPending.innerHTML = '<div class="text-slate-500">No pending transfers.</div>';
    return;
  }

  const html = pendingList.map(recipient => {
    const addrStr = recipient.address.toString();
    const amount = formatAmount(recipient.amount, getDecimals());
    const shortAddr = `${addrStr.slice(0, 4)}...${addrStr.slice(-4)}`;
    return `<div class="py-1 border-b border-slate-600 last:border-0">
      <span class="text-slate-300">${shortAddr}</span>
      <span class="text-yellow-400 float-right">${amount}</span>
    </div>`;
  }).join('');

  elements.detailsPending.innerHTML = html;
}

/**
 * Update failed details list
 */
function updateFailedDetails() {
  if (!elements.detailsFailed) return;
  
  if (progressState.failedRecipients.length === 0) {
    elements.detailsFailed.innerHTML = '<div class="text-slate-500">No failed transfers.</div>';
    return;
  }

  const html = progressState.failedRecipients.map(recipient => {
    const addrStr = recipient.address.toString();
    const amount = formatAmount(recipient.amount, getDecimals());
    const shortAddr = `${addrStr.slice(0, 4)}...${addrStr.slice(-4)}`;
    return `<div class="py-1 border-b border-slate-600 last:border-0">
      <span class="text-slate-300">${shortAddr}</span>
      <span class="text-red-400 float-right">${amount}</span>
    </div>`;
  }).join('');

  elements.detailsFailed.innerHTML = html;
}

/**
 * Get decimals from transactions module (if initialized)
 * Fallback to 9 if not available
 */
function getDecimals() {
  // Import decimals from transactions.js dynamically if needed
  // For now, we'll check if it's available in the global scope
  return window._tokenDecimals || 9;
}

/**
 * Toggle completed details visibility
 */
export function toggleCompletedDetails() {
  toggleState.completed = !toggleState.completed;
  if (toggleState.completed) {
    elements.detailsCompleted.classList.remove('hidden');
    elements.toggleCompleted.querySelector('span').textContent = '▼';
    updateCompletedDetails();
  } else {
    elements.detailsCompleted.classList.add('hidden');
    elements.toggleCompleted.querySelector('span').textContent = '▶';
  }
}

/**
 * Toggle pending details visibility
 */
export function togglePendingDetails() {
  toggleState.pending = !toggleState.pending;
  if (toggleState.pending) {
    elements.detailsPending.classList.remove('hidden');
    elements.togglePending.querySelector('span').textContent = '▼';
    updatePendingDetails();
  } else {
    elements.detailsPending.classList.add('hidden');
    elements.togglePending.querySelector('span').textContent = '▶';
  }
}

/**
 * Toggle failed details visibility
 */
export function toggleFailedDetails() {
  toggleState.failed = !toggleState.failed;
  if (toggleState.failed) {
    elements.detailsFailed.classList.remove('hidden');
    elements.toggleFailed.querySelector('span').textContent = '▼';
    updateFailedDetails();
  } else {
    elements.detailsFailed.classList.add('hidden');
    elements.toggleFailed.querySelector('span').textContent = '▶';
  }
}

/**
 * Reset progress state
 */
export function resetProgress() {
  progressState.allRecipients = [];
  progressState.completedRecipients = new Set();
  progressState.failedRecipients = [];
  
  // Reset toggle states
  toggleState.completed = false;
  toggleState.pending = false;
  toggleState.failed = false;
  
  // Hide and clear all detail sections
  if (elements.detailsCompleted) {
    elements.detailsCompleted.classList.add('hidden');
    elements.detailsCompleted.innerHTML = '';
  }
  if (elements.detailsPending) {
    elements.detailsPending.classList.add('hidden');
    elements.detailsPending.innerHTML = '';
  }
  if (elements.detailsFailed) {
    elements.detailsFailed.classList.add('hidden');
    elements.detailsFailed.innerHTML = '';
  }
  
  // Reset toggle button chevrons
  if (elements.toggleCompleted) {
    elements.toggleCompleted.querySelector('span').textContent = '▶';
  }
  if (elements.togglePending) {
    elements.togglePending.querySelector('span').textContent = '▶';
  }
  if (elements.toggleFailed) {
    elements.toggleFailed.querySelector('span').textContent = '▶';
  }
  
  updateProgress();
}

/**
 * Reset send button to enabled state
 */
export function resetSendBtn() {
  elements.sendBtn.disabled = false;
  elements.sendBtn.textContent = 'Prepare & Send Transactions';
}

/**
 * Amount conversion helpers
 */

/**
 * Convert decimal string to amount in smallest unit (using BigInt)
 * @param {string} str - Decimal amount string
 * @param {number} decimals - Token decimals
 * @returns {bigint} Amount in smallest unit
 */
export function decimalToAmount(str, decimals) {
  const s = String(str).trim();
  if (!/^\d+(?:\.\d+)?$/.test(s)) throw new Error(`Invalid amount: ${str}`);
  const [whole, fracRaw = ''] = s.split('.');
  const frac = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + frac);
}

/**
 * Format amount from smallest unit to decimal string
 * @param {bigint} bi - Amount in smallest unit
 * @param {number} decimals - Token decimals
 * @returns {string} Formatted decimal amount
 */
export function formatAmount(bi, decimals) {
  const s = bi.toString();
  if (decimals === 0) return s;
  const pad = s.padStart(decimals + 1, '0');
  const whole = pad.slice(0, -decimals);
  const frac = pad.slice(-decimals).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Recipients normalization
 * - Convert CRLF to LF
 * - Replace unicode space chars with regular space
 * - Trim each line & remove blanks
 * - Remove all internal whitespace from address portion
 * - Trim amount portion
 * @param {string} raw - Raw recipients input
 * @returns {string} Normalized recipients string
 */
export function normalizeRecipients(raw) {
  if (!raw) return '';
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00A0\u2000-\u200B\u202F\uFEFF]/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => {
      const idx = l.indexOf(',');
      if (idx === -1) return l; // malformed; parser will error later
      const addrPart = l.slice(0, idx);
      const amtPart = l.slice(idx + 1);
      const addr = addrPart.replace(/\s+/g, '');
      const amt = amtPart.trim();
      return `${addr}, ${amt}`;
    })
    .join('\n');
}

/**
 * Apply recipients normalization to the input field
 */
export function applyRecipientsNormalization() {
  const before = elements.recipientsInput.value;
  const after = normalizeRecipients(before);
  if (before !== after) {
    elements.recipientsInput.value = after;
    log('Recipients trimmed & normalized.', 'info');
  }
}
