/**
 * rpc-config.js - RPC endpoint management, localStorage, and UI rendering
 */

import { loadConfig, DEFAULT_RPC_ENDPOINTS } from './config.js';
import { log, elements } from './ui.js';

// RPC configuration state
export let userRpcEndpoints = { mainnet: [], devnet: [], testnet: [] };
export let minConsensusThreshold = 2;
export let primaryEndpointByCluster = { mainnet: null, devnet: null, testnet: null };
export let currentCluster = 'devnet';
let editingEndpointIndex = null;

// Store loaded config for reference
let loadedConfig = null;

/**
 * Initialize RPC configuration - load config.json and merge with localStorage
 */
export async function initRpcConfig() {
  // Load config.json
  loadedConfig = await loadConfig();
  
  // Load user customizations from localStorage
  const stored = localStorage.getItem('rpcEndpointsConfig');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Merge: Start with config.json defaults, then add/override with user customizations
      userRpcEndpoints = {
        mainnet: mergeEndpoints(loadedConfig.rpc.mainnet, parsed.mainnet),
        devnet: mergeEndpoints(loadedConfig.rpc.devnet, parsed.devnet),
        testnet: mergeEndpoints(loadedConfig.rpc.testnet, parsed.testnet)
      };
    } catch (e) {
      console.error('Failed to parse stored RPC endpoints:', e);
      // Fall back to config.json defaults
      userRpcEndpoints = {
        mainnet: [...loadedConfig.rpc.mainnet],
        devnet: [...loadedConfig.rpc.devnet],
        testnet: [...loadedConfig.rpc.testnet]
      };
    }
  } else {
    // No localStorage, use config.json defaults
    userRpcEndpoints = {
      mainnet: [...loadedConfig.rpc.mainnet],
      devnet: [...loadedConfig.rpc.devnet],
      testnet: [...loadedConfig.rpc.testnet]
    };
  }
  
  // Load consensus threshold
  const storedThreshold = localStorage.getItem('minConsensusThreshold');
  if (storedThreshold) {
    minConsensusThreshold = parseInt(storedThreshold, 10) || 2;
  }

  // Load primary endpoint selections
  const storedPrimary = localStorage.getItem('primaryEndpointByCluster');
  if (storedPrimary) {
    try {
      primaryEndpointByCluster = JSON.parse(storedPrimary);
    } catch (e) {
      console.error('Failed to parse stored primary endpoints:', e);
      primaryEndpointByCluster = { mainnet: null, devnet: null, testnet: null };
    }
  }
}

/**
 * Merge config.json endpoints with user customizations
 * @param {Array} configEndpoints - Endpoints from config.json
 * @param {Array} userEndpoints - User customizations from localStorage
 * @returns {Array} Merged endpoint list
 */
function mergeEndpoints(configEndpoints, userEndpoints) {
  if (!userEndpoints || !Array.isArray(userEndpoints)) {
    return [...configEndpoints];
  }
  
  // Start with config.json defaults
  const merged = [...configEndpoints];
  
  // Add custom endpoints (those not marked as isDefault)
  for (const userEp of userEndpoints) {
    if (!userEp.isDefault) {
      // Custom endpoint - add it if not already present
      const exists = merged.find(ep => ep.id === userEp.id);
      if (!exists) {
        merged.push(userEp);
      }
    } else {
      // Default endpoint - update settings if user modified them
      const defaultEp = merged.find(ep => ep.id === userEp.id);
      if (defaultEp) {
        // Preserve user's enabled/disabled preference for default endpoints
        defaultEp.enabled = userEp.enabled;
      }
    }
  }
  
  return merged;
}

/**
 * Save RPC configuration to localStorage
 */
export function saveRpcEndpoints() {
  localStorage.setItem('rpcEndpointsConfig', JSON.stringify(userRpcEndpoints));
  localStorage.setItem('minConsensusThreshold', minConsensusThreshold.toString());
  localStorage.setItem('primaryEndpointByCluster', JSON.stringify(primaryEndpointByCluster));
}

/**
 * Get current cluster name based on dropdown selection
 * @returns {string} Current cluster name
 */
export function getCurrentCluster() {
  const dropdownUrl = elements.clusterSelect.value;
  
  if (dropdownUrl.includes('devnet')) return 'devnet';
  if (dropdownUrl.includes('testnet')) return 'testnet';
  return 'mainnet';
}

/**
 * Get enabled endpoints for current cluster
 * @returns {Array} List of enabled endpoints
 */
export function getEnabledEndpoints() {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster] || [];
  return endpoints.filter(ep => ep.enabled);
}

/**
 * Build full URL with API key if needed
 * @param {Object} endpoint - Endpoint configuration
 * @returns {string} Full URL with API key
 */
export function buildEndpointUrl(endpoint) {
  if (!endpoint.apiKey) return endpoint.url;
  
  // If URL already has query params, append with &
  if (endpoint.url.includes('?')) {
    return `${endpoint.url}&api-key=${endpoint.apiKey}`;
  }
  // Otherwise, add with ?
  return `${endpoint.url}?api-key=${endpoint.apiKey}`;
}

/**
 * Obfuscate API key for display
 * @param {string} key - API key
 * @returns {string} Obfuscated key
 */
function obfuscateApiKey(key) {
  if (!key || key.length < 8) return '••••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}

/**
 * Render endpoint list UI
 */
export function renderEndpointsList() {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster] || [];
  const container = document.getElementById('rpc-endpoints-list');
  
  if (endpoints.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-sm">No endpoints configured for this cluster.</p>';
    return;
  }

  const primaryId = primaryEndpointByCluster[cluster];

  container.innerHTML = endpoints.map((ep, idx) => {
    const isEditing = editingEndpointIndex === idx;
    const isPrimary = ep.id === primaryId;
    
    if (isEditing) {
      // Edit mode
      const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
      };
      
      return `
        <div class="bg-slate-700 rounded p-3">
          <div class="space-y-2">
            <input id="edit-label-${idx}" type="text" value="${escapeHtml(ep.label)}" 
                   placeholder="Label"
                   class="w-full bg-slate-600 text-white border border-slate-500 rounded p-2 text-sm">
            <input id="edit-url-${idx}" type="text" value="${escapeHtml(ep.url)}" 
                   placeholder="RPC URL"
                   class="w-full bg-slate-600 text-white border border-slate-500 rounded p-2 text-sm">
            <input id="edit-apikey-${idx}" type="text" value="${escapeHtml(ep.apiKey || '')}" 
                   placeholder="API Key (optional)"
                   class="w-full bg-slate-600 text-white border border-slate-500 rounded p-2 text-sm">
            <div class="flex gap-2">
              <button data-action="save-endpoint" data-idx="${idx}" 
                      class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-1 px-3 rounded transition">
                Save
              </button>
              <button data-action="cancel-edit-endpoint" 
                      class="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-sm py-1 px-3 rounded transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      // Display mode
      const displayUrl = ep.url.length > 50 ? ep.url.slice(0, 47) + '...' : ep.url;
      const hasApiKey = ep.apiKey && ep.apiKey.trim() !== '';
      const apiKeyDisplay = hasApiKey ? obfuscateApiKey(ep.apiKey) : 'None';
      
      return `
        <div class="bg-slate-700 rounded p-3 flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <input type="radio" name="primary-endpoint-${cluster}" 
                     ${isPrimary ? 'checked' : ''}
                     data-action="set-primary-endpoint" data-idx="${idx}"
                     class="rounded bg-slate-600 border-slate-500"
                     title="Set as Primary">
              <input type="checkbox" id="endpoint-enabled-${idx}" 
                     ${ep.enabled ? 'checked' : ''}
                     class="rounded bg-slate-600 border-slate-500"
                     data-action="toggle-endpoint-enabled" data-idx="${idx}">
              <label for="endpoint-enabled-${idx}" class="text-sm font-medium text-white truncate">
                ${ep.label}
              </label>
              ${ep.isDefault ? '<span class="text-xs bg-blue-600 text-white px-1 rounded">Default</span>' : ''}
              ${isPrimary ? '<span class="text-xs bg-green-600 text-white px-1 rounded">Primary</span>' : ''}
            </div>
            <div class="text-xs text-slate-400 truncate" title="${ep.url}">
              URL: ${displayUrl}
            </div>
            <div class="text-xs text-slate-400">
              API Key: ${apiKeyDisplay}
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <button data-action="edit-endpoint" data-idx="${idx}" class="text-indigo-400 hover:text-indigo-300 text-xs" title="Edit">✎</button>
            ${idx > 0 ? `<button data-action="move-endpoint-up" data-idx="${idx}" class="text-slate-400 hover:text-white text-xs" title="Move up">↑</button>` : '<span class="text-xs invisible">↑</span>'}
            ${idx < endpoints.length - 1 ? `<button data-action="move-endpoint-down" data-idx="${idx}" class="text-slate-400 hover:text-white text-xs" title="Move down">↓</button>` : '<span class="text-xs invisible">↓</span>'}
            ${!ep.isDefault ? `<button data-action="remove-endpoint" data-idx="${idx}" class="text-red-400 hover:text-red-300 text-xs" title="Remove">✕</button>` : '<span class="text-xs invisible">✕</span>'}
          </div>
        </div>
      `;
    }
  }).join('');

  // Update display counters
  const enabledCount = endpoints.filter(ep => ep.enabled).length;
  document.getElementById('total-endpoints-display').textContent = enabledCount;
  document.getElementById('min-consensus-display').textContent = minConsensusThreshold;
}

/**
 * Edit endpoint - enter edit mode
 */
export function editEndpoint(idx) {
  editingEndpointIndex = idx;
  renderEndpointsList();
}

/**
 * Cancel edit mode
 */
export function cancelEditEndpoint() {
  editingEndpointIndex = null;
  renderEndpointsList();
}

/**
 * Save endpoint changes
 */
export function saveEndpoint(idx) {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster];
  if (!endpoints || !endpoints[idx]) return;

  let label = document.getElementById(`edit-label-${idx}`)?.value.trim() || '';
  let url = document.getElementById(`edit-url-${idx}`)?.value.trim() || '';
  let apiKey = document.getElementById(`edit-apikey-${idx}`)?.value.trim() || '';

  if (!label || !url) {
    alert('Label and URL are required.');
    return;
  }

  // Extract API key from URL if present
  try {
    if (url.includes('api-key=') || url.includes('apikey=')) {
      const urlObj = new URL(url);
      const keyFromUrl = urlObj.searchParams.get('api-key') || urlObj.searchParams.get('apikey');
      if (keyFromUrl && !apiKey) {
        apiKey = keyFromUrl;
      }
      // Remove API key from URL
      urlObj.searchParams.delete('api-key');
      urlObj.searchParams.delete('apikey');
      url = urlObj.toString();
    }
  } catch (e) {
    console.error('Error parsing URL:', e);
  }

  endpoints[idx].label = label;
  endpoints[idx].url = url;
  endpoints[idx].apiKey = apiKey;

  editingEndpointIndex = null;
  saveRpcEndpoints();
  renderEndpointsList();
  
  log(`Endpoint updated: ${label}`, 'success');
}

/**
 * Set primary endpoint
 */
export function setPrimaryEndpoint(idx) {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster];
  if (!endpoints || !endpoints[idx]) return;

  primaryEndpointByCluster[cluster] = endpoints[idx].id;
  saveRpcEndpoints();
  renderEndpointsList();
  log(`Primary endpoint set to: ${endpoints[idx].label}`, 'success');
}

/**
 * Toggle endpoint enabled state
 */
export function toggleEndpointEnabled(idx) {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster];
  if (endpoints && endpoints[idx]) {
    endpoints[idx].enabled = !endpoints[idx].enabled;
    saveRpcEndpoints();
    renderEndpointsList();
  }
}

/**
 * Move endpoint up in list
 */
export function moveEndpointUp(idx) {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster];
  if (idx > 0 && endpoints) {
    [endpoints[idx - 1], endpoints[idx]] = [endpoints[idx], endpoints[idx - 1]];
    saveRpcEndpoints();
    renderEndpointsList();
  }
}

/**
 * Move endpoint down in list
 */
export function moveEndpointDown(idx) {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster];
  if (idx < endpoints.length - 1 && endpoints) {
    [endpoints[idx], endpoints[idx + 1]] = [endpoints[idx + 1], endpoints[idx]];
    saveRpcEndpoints();
    renderEndpointsList();
  }
}

/**
 * Remove endpoint
 */
export function removeEndpoint(idx) {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster];
  if (endpoints && endpoints[idx] && !endpoints[idx].isDefault) {
    if (confirm(`Remove endpoint "${endpoints[idx].label}"?`)) {
      const removedId = endpoints[idx].id;
      endpoints.splice(idx, 1);
      
      // Clear primary if we removed it
      if (primaryEndpointByCluster[cluster] === removedId) {
        primaryEndpointByCluster[cluster] = null;
      }
      
      saveRpcEndpoints();
      renderEndpointsList();
    }
  }
}

/**
 * Add new custom endpoint
 */
export function addCustomEndpoint(label, url, apiKey) {
  // Auto-extract API key from URL if present
  if (url.includes('api-key=') || url.includes('apikey=')) {
    try {
      const urlObj = new URL(url);
      const keyFromUrl = urlObj.searchParams.get('api-key') || urlObj.searchParams.get('apikey');
      if (keyFromUrl && !apiKey) {
        apiKey = keyFromUrl;
        // Remove API key from URL to store separately
        urlObj.searchParams.delete('api-key');
        urlObj.searchParams.delete('apikey');
        url = urlObj.toString();
      }
    } catch (e) {
      console.error('Error parsing URL:', e);
    }
  }

  const cluster = getCurrentCluster();
  const newEndpoint = {
    id: `custom-${Date.now()}`,
    label,
    url,
    apiKey,
    enabled: true,
    isDefault: false
  };

  userRpcEndpoints[cluster].push(newEndpoint);
  saveRpcEndpoints();
  renderEndpointsList();

  log(`Added new RPC endpoint: ${label}`, 'success');
}

/**
 * Reset endpoints to defaults for current cluster
 * Resets to config.json endpoints (or empty array if config.json was not loaded)
 */
export function resetEndpointsToDefaults() {
  const cluster = getCurrentCluster();
  if (confirm(`Reset all endpoints for ${cluster} to defaults? This will remove all custom endpoints for this cluster.`)) {
    // Use config.json defaults if available, otherwise empty array fallback
    const defaults = loadedConfig ? loadedConfig.rpc[cluster] : DEFAULT_RPC_ENDPOINTS[cluster];
    userRpcEndpoints[cluster] = JSON.parse(JSON.stringify(defaults));
    primaryEndpointByCluster[cluster] = null;
    saveRpcEndpoints();
    renderEndpointsList();
    log(`Endpoints reset to defaults for ${cluster}`, 'success');
  }
}

/**
 * Update consensus threshold
 */
export function updateConsensusThreshold(value) {
  const val = parseInt(value, 10);
  if (val >= 1 && val <= 10) {
    minConsensusThreshold = val;
    saveRpcEndpoints();
    renderEndpointsList();
    log(`Consensus threshold updated to ${val}`, 'info');
  }
}

/**
 * Update current cluster
 */
export function updateCurrentCluster() {
  currentCluster = getCurrentCluster();
}
