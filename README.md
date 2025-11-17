# Solana Token Multisender

A browser-based tool for sending SPL tokens to multiple recipients in batches, with multi-RPC consensus verification.

## Features

- 🔐 **Wallet Integration**: Connect via Phantom wallet
- 📦 **Batch Sending**: Send to multiple recipients in configurable batch sizes
- ✅ **Multi-RPC Consensus**: Verify transactions across multiple RPC endpoints
- 🔄 **Auto-Retry Logic**: Automatically retry failed transactions with batch splitting
- 📝 **Recipients Normalization**: Auto-trim whitespace and normalize addresses
- 💾 **Persistent Configuration**: Save custom RPC endpoints in browser localStorage
- 🎨 **Modern UI**: Clean, responsive interface with Tailwind CSS

## Quick Start

1. Open `index.html` in a web browser (or serve it via HTTP server)
2. Click "Connect Wallet" to connect your Phantom wallet
3. Select cluster (Devnet for testing, Mainnet for production)
4. Enter token mint address
5. Paste recipients list (format: `Address, Amount`)
6. Click "Prepare & Send Transactions"

## Configuration

### Using `config.json` (Required)

**RPC endpoints are configured via `config.json` in the repository root.** This file is the single source of truth for all RPC endpoints. Create or edit `config.json` to configure your endpoints:

```json
{
  "rpc": {
    "mainnet": [
      {
        "id": "mainnet-solana-official",
        "label": "Solana Official (Mainnet)",
        "url": "https://api.mainnet-beta.solana.com",
        "apiKey": "",
        "enabled": true,
        "isDefault": true
      },
      {
        "id": "mainnet-helius-public",
        "label": "Helius (Mainnet - Public)",
        "url": "https://mainnet.helius-rpc.com",
        "apiKey": "your-api-key-here",
        "enabled": true,
        "isDefault": true
      }
    ],
    "devnet": [
      {
        "id": "devnet-solana-official",
        "label": "Solana Official (Devnet)",
        "url": "https://api.devnet.solana.com",
        "apiKey": "",
        "enabled": true,
        "isDefault": true
      }
    ],
    "testnet": [...]
  }
}
```

### Configuration Properties

- **id**: Unique identifier for the endpoint (required)
- **label**: Human-readable name displayed in UI (required)
- **url**: RPC endpoint URL (required)
- **apiKey**: Optional API key (stored separately from URL)
- **enabled**: Whether endpoint is active for consensus verification
- **isDefault**: Whether endpoint is a default (prevents deletion in UI)

### API Key Handling

- API keys can be specified in `config.json` or added via the UI
- Keys are automatically extracted from URLs (e.g., `?api-key=xxx`)
- Keys are stored separately and appended to URLs when making requests
- Keys are obfuscated in the UI for security

### Fallback Behavior

**Important:** RPC endpoints are now fully driven by `config.json` - no endpoints are hardcoded in the application.

If `config.json` is missing or malformed:
1. Console warnings are logged with detailed error information
2. Application uses empty endpoint arrays as minimal fallback
3. You will need to add custom endpoints via the UI or fix your `config.json`
4. **Ensure `config.json` exists in the repository root with proper RPC configuration**

### Custom Endpoints

Users can add custom RPC endpoints via the UI:
1. Click "[Show/Hide]" in "RPC Nodes for Verification" section
2. Click "+ Add Custom Endpoint"
3. Enter label, URL, and optional API key
4. Custom endpoints are saved in browser localStorage

## File Structure

```
solana-multisender/
├── index.html          # Main HTML file (UI structure only)
├── config.json         # RPC endpoint configuration (optional)
├── js/
│   ├── config.js       # Config loading with fallback
│   ├── ui.js           # UI helpers and logging
│   ├── wallet.js       # Wallet connection management
│   ├── rpc-config.js   # RPC endpoint management
│   ├── transactions.js # Transaction building and verification
│   └── main.js         # Main entry point and event binding
└── README.md           # This file
```

## Security Considerations

⚠️ **Important Security Notes:**

1. **Public API Keys**: Keys in `config.json` are visible in browser DevTools and network requests
2. **Demo Keys Only**: Never commit production API keys to public repositories
3. **Client-Side Storage**: Custom endpoints in localStorage are client-side only
4. **Private Keys**: Wallet private keys never leave the browser extension
5. **Testing First**: Always test on Devnet before using Mainnet

## Development

### Running Locally

```bash
# Simple HTTP server with Python
python3 -m http.server 8000

# Or with Node.js
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser.

### Modular Architecture

The codebase uses ES6 modules for clean separation of concerns:

- **config.js**: Loads and validates config.json
- **ui.js**: UI state, logging, progress tracking
- **wallet.js**: Phantom wallet integration
- **rpc-config.js**: RPC endpoint CRUD operations
- **transactions.js**: Solana transaction building and sending
- **main.js**: Application initialization and event handling

## Multi-RPC Consensus Verification

After each transaction is sent:

1. Transaction is confirmed on primary RPC endpoint
2. Verification queries are sent to all enabled endpoints in parallel
3. Each endpoint checks if transaction is finalized
4. Consensus threshold (default: 2) determines success
5. Results are logged with color-coded status

This provides confidence that transactions are truly finalized across the network.

## Troubleshooting

### "403 Forbidden" Errors

Some public RPC endpoints block browser requests. Solutions:
- Use a paid RPC provider (Helius, QuickNode, etc.)
- Add custom endpoint with your API key
- Use a CORS proxy (development only)

### Config Not Loading

- Ensure `config.json` is in the same directory as `index.html`
- Check browser console for JSON parsing errors
- Verify JSON syntax is valid

### Wallet Connection Issues

- Ensure Phantom wallet extension is installed
- Check that you're on a supported network
- Try refreshing the page

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please open an issue or pull request.

---

**Disclaimer**: This tool is provided as-is. Always verify transactions and test on Devnet before using with real funds.
