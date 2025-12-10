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
  stopBtn: document.getElementById('stop-btn'),
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
  listCompleted: document.getElementById('list-completed'),
  listPending: document.getElementById('list-pending'),
  listFailed: document.getElementById('list-failed'),
  chevronCompleted: document.getElementById('chevron-completed'),
  chevronPending: document.getElementById('chevron-pending'),
  chevronFailed: document.getElementById('chevron-failed')
};

// Progress tracking state
export const progressState = {
  allRecipients: [],
  completedRecipients: new Set(),
  failedRecipients: [],
  decimals: 0
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

  // Update detail lists
  updateDetailLists();
}

/**
 * Update the detail lists for completed, pending, and failed recipients
 */
function updateDetailLists() {
  const decimals = progressState.decimals || 0;
  
  // Create a map for O(1) recipient lookups
  const recipientMap = new Map();
  for (const recipient of progressState.allRecipients) {
    recipientMap.set(recipient.address.toString(), recipient);
  }
  
  // Completed list
  const completedHtml = Array.from(progressState.completedRecipients).map(addr => {
    const recipient = recipientMap.get(addr);
    if (!recipient) return '';
    const amount = formatAmount(recipient.amount, decimals);
    return `<div class="py-1 border-b border-slate-600 last:border-b-0">
      <div class="font-mono text-[10px] text-slate-400 truncate">${addr}</div>
      <div class="text-green-400">${amount}</div>
    </div>`;
  }).join('');
  elements.listCompleted.innerHTML = completedHtml || '<div class="text-slate-500 py-2">No completed transfers</div>';

  // Failed list
  const failedHtml = progressState.failedRecipients.map(recipient => {
    const addr = recipient.address.toString();
    const amount = formatAmount(recipient.amount, decimals);
    return `<div class="py-1 border-b border-slate-600 last:border-b-0">
      <div class="font-mono text-[10px] text-slate-400 truncate">${addr}</div>
      <div class="text-red-400">${amount}</div>
    </div>`;
  }).join('');
  elements.listFailed.innerHTML = failedHtml || '<div class="text-slate-500 py-2">No failed transfers</div>';

  // Pending list (allRecipients - completed - failed)
  const completedSet = progressState.completedRecipients;
  const failedSet = new Set(progressState.failedRecipients.map(r => r.address.toString()));
  const pendingRecipients = progressState.allRecipients.filter(r => {
    const addr = r.address.toString();
    return !completedSet.has(addr) && !failedSet.has(addr);
  });
  
  const pendingHtml = pendingRecipients.map(recipient => {
    const addr = recipient.address.toString();
    const amount = formatAmount(recipient.amount, decimals);
    return `<div class="py-1 border-b border-slate-600 last:border-b-0">
      <div class="font-mono text-[10px] text-slate-400 truncate">${addr}</div>
      <div class="text-yellow-400">${amount}</div>
    </div>`;
  }).join('');
  elements.listPending.innerHTML = pendingHtml || '<div class="text-slate-500 py-2">No pending transfers</div>';
}

/**
 * Reset progress state
 */
export function resetProgress() {
  progressState.allRecipients = [];
  progressState.completedRecipients = new Set();
  progressState.failedRecipients = [];
  progressState.decimals = 0;
  
  // Collapse all detail sections
  elements.listCompleted.classList.add('hidden');
  elements.listPending.classList.add('hidden');
  elements.listFailed.classList.add('hidden');
  elements.chevronCompleted.style.transform = 'rotate(0deg)';
  elements.chevronPending.style.transform = 'rotate(0deg)';
  elements.chevronFailed.style.transform = 'rotate(0deg)';
  
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

/**
 * Toggle detail list visibility
 * @param {string} type - 'completed', 'pending', or 'failed'
 */
export function toggleDetailList(type) {
  const listElement = elements[`list${type.charAt(0).toUpperCase() + type.slice(1)}`];
  const chevronElement = elements[`chevron${type.charAt(0).toUpperCase() + type.slice(1)}`];
  
  if (listElement.classList.contains('hidden')) {
    listElement.classList.remove('hidden');
    chevronElement.style.transform = 'rotate(90deg)';
  } else {
    listElement.classList.add('hidden');
    chevronElement.style.transform = 'rotate(0deg)';
  }
}

/**
 * Setup toggle event listeners for detail lists
 */
export function setupDetailListToggles() {
  elements.toggleCompleted?.addEventListener('click', () => toggleDetailList('completed'));
  elements.togglePending?.addEventListener('click', () => toggleDetailList('pending'));
  elements.toggleFailed?.addEventListener('click', () => toggleDetailList('failed'));
}
