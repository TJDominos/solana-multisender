/**
 * config.js - Configuration loading
 * Loads config.json from repo root and provides configuration
 * 
 * RPC endpoints are now fully driven by config.json at the root.
 * The fallback DEFAULT_RPC_ENDPOINTS only provides empty arrays to avoid runtime crashes.
 */

// Minimal fallback to avoid runtime crashes if config.json is missing or invalid
// This does not contain real endpoints - all real endpoints should be in config.json
export const DEFAULT_RPC_ENDPOINTS = {
  mainnet: [],
  devnet: [],
  testnet: []
};

/**
 * Load config.json from the repository root
 * @returns {Promise<Object>} Configuration object with RPC endpoints
 * 
 * Returns config.json as the single source of truth for RPC endpoints.
 * If config.json is missing or invalid, returns minimal fallback with empty arrays.
 */
export async function loadConfig() {
  try {
    const response = await fetch('./config.json');
    
    if (!response.ok) {
      console.warn('⚠️ config.json not found or not accessible (HTTP', response.status, ')');
      console.warn('⚠️ Using minimal fallback with empty endpoint arrays');
      console.warn('⚠️ Please ensure config.json exists in the repository root with proper RPC configuration');
      return { rpc: DEFAULT_RPC_ENDPOINTS };
    }
    
    const config = await response.json();
    
    // Validate that config has rpc property
    if (!config.rpc) {
      console.warn('⚠️ config.json missing "rpc" property');
      console.warn('⚠️ Using minimal fallback with empty endpoint arrays');
      console.warn('⚠️ Expected format: { "rpc": { "mainnet": [...], "devnet": [...], "testnet": [...] } }');
      return { rpc: DEFAULT_RPC_ENDPOINTS };
    }
    
    // Validate that each network property is an array (if present)
    const validatedRpc = {
      mainnet: Array.isArray(config.rpc.mainnet) ? config.rpc.mainnet : [],
      devnet: Array.isArray(config.rpc.devnet) ? config.rpc.devnet : [],
      testnet: Array.isArray(config.rpc.testnet) ? config.rpc.testnet : []
    };
    
    console.log('✓ config.json loaded successfully');
    console.log('  - Mainnet endpoints:', validatedRpc.mainnet.length);
    console.log('  - Devnet endpoints:', validatedRpc.devnet.length);
    console.log('  - Testnet endpoints:', validatedRpc.testnet.length);
    
    return { rpc: validatedRpc };
    
  } catch (error) {
    console.warn('⚠️ Failed to load config.json:', error.message);
    console.warn('⚠️ Using minimal fallback with empty endpoint arrays');
    console.warn('⚠️ Please ensure config.json exists and contains valid JSON');
    return { rpc: DEFAULT_RPC_ENDPOINTS };
  }
}
