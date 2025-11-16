/**
 * config.js - Configuration loading and merging
 * Loads config.json from repo root and provides merged configuration
 */

// Built-in default RPC endpoints (fallback if config.json not found)
export const DEFAULT_RPC_ENDPOINTS = {
  mainnet: [
    { id: 'mainnet-solana-official', label: 'Solana Official (Mainnet)', url: 'https://api.mainnet-beta.solana.com', apiKey: '', enabled: true, isDefault: true },
    { id: 'mainnet-helius-public', label: 'Helius (Mainnet - Public)', url: 'https://mainnet.helius-rpc.com', apiKey: 'fda76be1-7d09-4880-80db-837831934193', enabled: true, isDefault: true },
    { id: 'mainnet-quicknode', label: 'QuickNode (Mainnet - Demo)', url: 'https://api.mainnet-beta.solana.com', apiKey: '', enabled: true, isDefault: true },
  ],
  devnet: [
    { id: 'devnet-solana-official', label: 'Solana Official (Devnet)', url: 'https://api.devnet.solana.com', apiKey: '', enabled: true, isDefault: true },
    { id: 'devnet-helius', label: 'Helius (Devnet)', url: 'https://devnet.helius-rpc.com', apiKey: 'fda76be1-7d09-4880-80db-837831934193', enabled: true, isDefault: true },
    { id: 'devnet-quicknode', label: 'QuickNode (Devnet - Demo)', url: 'https://api.devnet.solana.com', apiKey: '', enabled: true, isDefault: true },
  ],
  testnet: [
    { id: 'testnet-solana-official', label: 'Solana Official (Testnet)', url: 'https://api.testnet.solana.com', apiKey: '', enabled: true, isDefault: true },
    { id: 'testnet-helius', label: 'Helius (Testnet)', url: 'https://testnet.helius-rpc.com', apiKey: '', enabled: false, isDefault: true },
    { id: 'testnet-quicknode', label: 'QuickNode (Testnet - Demo)', url: 'https://api.testnet.solana.com', apiKey: '', enabled: false, isDefault: true },
  ]
};

/**
 * Load config.json and merge with defaults
 * @returns {Promise<Object>} Configuration object with RPC endpoints
 */
export async function loadConfig() {
  try {
    const response = await fetch('./config.json');
    
    if (!response.ok) {
      console.warn('config.json not found or not accessible, using built-in defaults');
      return { rpc: DEFAULT_RPC_ENDPOINTS };
    }
    
    const config = await response.json();
    
    // Validate and merge with defaults
    if (!config.rpc) {
      console.warn('config.json missing "rpc" property, using built-in defaults');
      return { rpc: DEFAULT_RPC_ENDPOINTS };
    }
    
    // Deep clone to avoid mutations
    const mergedConfig = {
      rpc: {
        mainnet: config.rpc.mainnet || DEFAULT_RPC_ENDPOINTS.mainnet,
        devnet: config.rpc.devnet || DEFAULT_RPC_ENDPOINTS.devnet,
        testnet: config.rpc.testnet || DEFAULT_RPC_ENDPOINTS.testnet
      }
    };
    
    console.log('✓ config.json loaded successfully');
    return mergedConfig;
    
  } catch (error) {
    console.warn('Failed to load config.json:', error.message);
    console.warn('Using built-in default RPC endpoints');
    return { rpc: DEFAULT_RPC_ENDPOINTS };
  }
}
