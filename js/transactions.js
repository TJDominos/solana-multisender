/**
 * transactions.js - Transaction building, sending, and verification
 */

import { Connection, PublicKey, Transaction } from 'https://esm.sh/@solana/web3.js@1.95.3';
import {
  getMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from 'https://esm.sh/@solana/spl-token@0.4.6';

import { getWallet, getProvider } from './wallet.js';
import { log, elements, progressState, updateProgress, formatAmount } from './ui.js';
import { 
  getEnabledEndpoints, 
  buildEndpointUrl, 
  getCurrentCluster, 
  minConsensusThreshold 
} from './rpc-config.js';

// Connection state
export let connection = null;
export let mintPubkey = null;
export let tokenProgramId = TOKEN_PROGRAM_ID;
export let decimals = 0;
export let senderAta = null;

/**
 * Initialize connection with primary endpoint
 */
export function initializeConnection(userRpcEndpoints, primaryEndpointByCluster) {
  const cluster = getCurrentCluster();
  const endpoints = userRpcEndpoints[cluster] || [];
  
  // Find primary endpoint
  const primaryId = primaryEndpointByCluster[cluster];
  let selectedEndpoint = null;
  
  if (primaryId) {
    selectedEndpoint = endpoints.find(ep => ep.id === primaryId);
  }
  
  // Fallback to first enabled endpoint
  if (!selectedEndpoint) {
    selectedEndpoint = endpoints.find(ep => ep.enabled);
  }
  
  // Final fallback to first endpoint
  if (!selectedEndpoint && endpoints.length > 0) {
    selectedEndpoint = endpoints[0];
  }
  
  if (selectedEndpoint) {
    const url = buildEndpointUrl(selectedEndpoint);
    connection = new Connection(url, 'confirmed');
    log(`Primary RPC set to: ${selectedEndpoint.label}`, 'info');
  } else {
    // No endpoints configured, fall back to dropdown selection
    const dropdownUrl = elements.clusterSelect.value;
    connection = new Connection(dropdownUrl, 'confirmed');
    log(`Using default RPC from dropdown: ${dropdownUrl}`, 'info');
  }
  
  return connection;
}

/**
 * Get current connection
 */
export function getConnection() {
  return connection;
}

/**
 * Verify transaction signature on a single RPC endpoint at 'finalized' commitment level
 */
async function verifyTransactionOnEndpoint(signature, endpoint) {
  const fullUrl = buildEndpointUrl(endpoint);
  try {
    // Create a temporary connection to this endpoint
    const conn = new Connection(fullUrl, 'finalized');
    
    // Query the signature status with finalized commitment
    const status = await conn.getSignatureStatus(signature, {
      searchTransactionHistory: true
    });

    if (!status || !status.value) {
      return {
        success: false,
        status: 'not_found',
        error: 'Transaction not recognized by this endpoint'
      };
    }

    const confirmationStatus = status.value.confirmationStatus;
    const hasError = status.value.err;

    if (hasError) {
      return {
        success: false,
        status: 'error',
        error: JSON.stringify(hasError)
      };
    }

    if (confirmationStatus === 'finalized') {
      return {
        success: true,
        status: 'finalized'
      };
    } else if (confirmationStatus === 'confirmed') {
      return {
        success: true,
        status: 'confirmed'
      };
    } else if (confirmationStatus === 'processed') {
      return {
        success: false,
        status: 'processed',
        error: 'Only processed, not yet confirmed'
      };
    } else {
      return {
        success: false,
        status: confirmationStatus || 'unknown',
        error: 'Unexpected confirmation status'
      };
    }

  } catch (err) {
    return {
      success: false,
      status: 'error',
      error: err?.message || String(err)
    };
  }
}

/**
 * Perform multi-endpoint consensus verification for a transaction
 */
export async function performConsensusVerification(signature) {
  const endpoints = getEnabledEndpoints();
  
  if (endpoints.length === 0) {
    log(`⚠️ No RPC endpoints enabled for verification. Skipping consensus check.`, 'warning');
    return {
      consensusReached: false,
      results: [],
      confirmedCount: 0,
      totalCount: 0
    };
  }

  if (endpoints.length < 3) {
    log(`⚠️ Warning: Only ${endpoints.length} endpoint(s) enabled. Recommend at least 3 for reliable consensus.`, 'warning');
  }

  log(`🔍 Multi-RPC Consensus Verification: Querying ${endpoints.length} endpoint(s)...`, 'info');

  // Query all endpoints in parallel
  const verificationPromises = endpoints.map(async (endpoint) => {
    const result = await verifyTransactionOnEndpoint(signature, endpoint);
    return {
      endpoint: endpoint.label,
      ...result
    };
  });

  const results = await Promise.all(verificationPromises);
  
  // Count how many endpoints successfully confirmed at finalized level
  const confirmedCount = results.filter(r => r.success && r.status === 'finalized').length;
  const totalCount = results.length;
  
  // Check if consensus threshold is met
  const consensusReached = confirmedCount >= minConsensusThreshold;

  // Log detailed results
  log(`📊 Consensus Verification Results:`, 'info');
  results.forEach(r => {
    if (r.success) {
      log(`  ✅ ${r.endpoint}: ${r.status}`, 'success');
    } else {
      log(`  ❌ ${r.endpoint}: ${r.status} - ${r.error || 'Unknown error'}`, 'warning');
    }
  });

  if (consensusReached) {
    log(`✅ Consensus Reached: ${confirmedCount}/${totalCount} endpoints confirmed (threshold: ${minConsensusThreshold})`, 'success');
  } else {
    log(`⚠️ Consensus NOT Reached: Only ${confirmedCount}/${totalCount} endpoints confirmed (threshold: ${minConsensusThreshold})`, 'warning');
    log(`ℹ️ This may indicate network sync delays. Check manually: https://solscan.io/tx/${signature}`, 'warning');
  }

  return {
    consensusReached,
    results,
    confirmedCount,
    totalCount
  };
}

/**
 * Ensure sender ATA exists
 */
async function ensureSenderAtaExists() {
  const wallet = getWallet();
  const provider = getProvider();
  
  const info = await connection.getAccountInfo(senderAta, 'confirmed');
  if (info) return;

  log('Sender ATA missing, creating...', 'info');
  const tx = new Transaction();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet;
  tx.add(
    createAssociatedTokenAccountInstruction(
      wallet, senderAta, wallet, mintPubkey, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );
  const signed = await provider.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  log(`Sender ATA creation tx: ${sig}`, 'success');
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'finalized');
  log('Sender ATA confirmed.', 'success');
}

/**
 * Build batch transaction
 */
async function buildBatchTx(batch) {
  const wallet = getWallet();
  const tx = new Transaction();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet;

  let ataCreations = 0;

  for (const r of batch) {
    const destAta = await getAssociatedTokenAddress(
      mintPubkey, r.address, true, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const destInfo = await connection.getAccountInfo(destAta, 'confirmed');
    if (!destInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet, destAta, r.address, mintPubkey, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
      ataCreations++;
    }
    tx.add(
      createTransferCheckedInstruction(
        senderAta, mintPubkey, destAta, wallet, r.amount, decimals, [], tokenProgramId
      )
    );
  }

  return { tx, ataCreations, lastValidBlockHeight };
}

/**
 * Confirm signature
 */
async function confirmSig(signature, blockhash, lastValidBlockHeight, commitment = 'finalized') {
  const res = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    commitment
  );
  return !res?.value?.err;
}

/**
 * Simulate transaction
 */
async function simulateTx(tx) {
  try {
    const sim = await connection.simulateTransaction(tx, { sigVerify: false });
    return sim.value;
  } catch (e) {
    return { err: e?.message || String(e), logs: [] };
  }
}

/**
 * Try to send a batch as a single atomic transaction
 */
async function trySendBatch(batch, { simulateBefore = false, attemptLabel = '' } = {}) {
  const wallet = getWallet();
  const provider = getProvider();
  
  try {
    const { tx, ataCreations, lastValidBlockHeight } = await buildBatchTx(batch);
    log(`${attemptLabel}Prepared batch of ${batch.length}. New ATAs: ${ataCreations}`, 'info');

    if (simulateBefore) {
      const sim = await simulateTx(tx);
      if (sim?.err) {
        log(`${attemptLabel}Simulation error: ${JSON.stringify(sim.err)}`, 'error');
        if (sim?.logs?.length) log(sim.logs.join('\n'), 'error');
        return false;
      } else {
        log(`${attemptLabel}Simulation OK.`, 'success');
      }
    }

    log(`${attemptLabel}Signing...`, 'info');
    const signed = await provider.signTransaction(tx);

    log(`${attemptLabel}Sending...`, 'info');
    const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    log(`${attemptLabel}TX sent: ${sig}`, 'success');

    const ok = await confirmSig(sig, tx.recentBlockhash, tx.lastValidBlockHeight ?? lastValidBlockHeight, 'finalized');
    if (!ok) {
      log(`${attemptLabel}Confirmation reported failure.`, 'error');
      return false;
    }

    const rpc = connection._rpcEndpoint || '';
    const devnetParam = (rpc.includes('devnet') || elements.clusterSelect.value.includes('devnet')) ? '?cluster=devnet' : '';
    log(`${attemptLabel}Confirmed: https://solscan.io/tx/${sig}${devnetParam}`, 'success');

    // Perform multi-endpoint consensus verification
    const consensusResult = await performConsensusVerification(sig);
    
    // Show warning if consensus not reached (but don't fail the batch)
    if (!consensusResult.consensusReached) {
      log(`⚠️ Warning: Consensus verification did not reach threshold. Transaction may still be valid.`, 'warning');
    }

    return true;
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      log('RPC returned 403 (forbidden). Use a Custom RPC URL from your provider and try again.', 'error');
    } else if (msg.toLowerCase().includes('failed to get info about account')) {
      log('RPC blocked account access. Use a provider RPC URL that allows browser access.', 'error');
    }
    log(`${attemptLabel}Batch send error: ${msg}`, 'error');
    return false;
  }
}

/**
 * Recursive batch processor - splits failed batches to isolate issues
 */
async function processBatchRecursive(batch, depth = 0) {
  const label = depth ? `[Depth ${depth}] ` : '';
  const ok = await trySendBatch(batch, { simulateBefore: false, attemptLabel: label });
  if (ok) {
    for (const r of batch) progressState.completedRecipients.add(r.address.toString());
    updateProgress();
    return;
  }

  const okRetry = await trySendBatch(batch, { simulateBefore: true, attemptLabel: `${label}[Retry] ` });
  if (okRetry) {
    for (const r of batch) progressState.completedRecipients.add(r.address.toString());
    updateProgress();
    return;
  }

  if (batch.length === 1) {
    const r = batch[0];
    progressState.failedRecipients.push(r);
    log(`${label}Recipient failed permanently: ${r.address.toString()}`, 'error');
    updateProgress();
    return;
  }

  const mid = Math.floor(batch.length / 2);
  const left = batch.slice(0, mid);
  const right = batch.slice(mid);

  log(`${label}Splitting batch (${batch.length}) into ${left.length} + ${right.length} to isolate failures...`, 'error');

  await processBatchRecursive(left, depth + 1);
  await processBatchRecursive(right, depth + 1);
}

/**
 * Main send handler - process all recipients
 */
export async function sendTransactions(mintStr, recipientsList, batchSize, userRpcEndpoints, primaryEndpointByCluster) {
  const wallet = getWallet();
  
  if (!wallet) {
    log('Connect wallet first.', 'error');
    return false;
  }

  // Ensure connection is initialized with the primary endpoint
  if (!connection) {
    initializeConnection(userRpcEndpoints, primaryEndpointByCluster);
  }
  
  log(`Using RPC: ${connection._rpcEndpoint}`, 'info');
  
  // Validate endpoint configuration
  const enabledEndpoints = getEnabledEndpoints();
  log(`Verification endpoints enabled: ${enabledEndpoints.length}`, 'info');
  
  if (enabledEndpoints.length < 3) {
    log(`⚠️ Warning: Less than 3 RPC endpoints enabled for verification. Recommend enabling at least 3.`, 'warning');
    log(`ℹ️ Go to "RPC Nodes for Verification" section to configure endpoints.`, 'warning');
  } else {
    log(`✓ Using ${enabledEndpoints.length} endpoints for consensus verification (threshold: ${minConsensusThreshold})`, 'info');
  }
  
  mintPubkey = new PublicKey(mintStr);

  // Detect token program by mint owner
  const mintAcct = await connection.getAccountInfo(mintPubkey, 'confirmed');
  if (!mintAcct) throw new Error('Mint account not found on this cluster.');
  const token2022 = TOKEN_2022_PROGRAM_ID ?? TOKEN_PROGRAM_ID;
  tokenProgramId = mintAcct.owner?.toString() === token2022.toString() ? token2022 : TOKEN_PROGRAM_ID;
  log(`Program: ${tokenProgramId.toString() === TOKEN_PROGRAM_ID.toString() ? 'SPL Token (legacy)' : 'Token-2022'}`, 'info');

  const mintInfo = await getMint(connection, mintPubkey, 'confirmed', tokenProgramId);
  decimals = mintInfo.decimals;
  window._tokenDecimals = decimals; // Expose for UI module
  log(`Decimals: ${decimals}`, 'info');

  // Sender ATA
  senderAta = await getAssociatedTokenAddress(
    mintPubkey, wallet, true, tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  log(`Sender ATA: ${senderAta.toString()}`, 'info');

  await ensureSenderAtaExists();

  // Parse recipients
  const lines = recipientsList.split('\n').filter(l => l.trim() !== '');
  const recipients = [];
  for (const [i, raw] of lines.entries()) {
    const parts = raw.split(',').map(s => s.trim());
    if (parts.length !== 2)
      throw new Error(`Invalid line #${i + 1}: "${raw}" (expected "address, amount")`);
    const [addrStr, amtStr] = parts;
    let pk;
    try {
      pk = new PublicKey(addrStr);
    } catch {
      throw new Error(`Bad address line #${i + 1}: ${addrStr}`);
    }
    const amount = await import('./ui.js').then(m => m.decimalToAmount(amtStr, decimals));
    if (amount <= 0n) throw new Error(`Amount must be > 0 line #${i + 1}`);
    recipients.push({ address: pk, amount });
  }

  progressState.allRecipients = recipients.slice();
  updateProgress();

  const total = recipients.reduce((s, r) => s + r.amount, 0n);
  log(`Recipients: ${recipients.length}, Total: ${formatAmount(total, decimals)} tokens.`, 'info');

  // Optional: sender token balance
  try {
    const bal = await connection.getTokenAccountBalance(senderAta, 'confirmed');
    log(`Sender balance (approx): ${bal?.value?.uiAmountString ?? '0'}`, 'info');
  } catch (_) { }

  // Create batches
  const batches = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }
  log(`Batches: ${batches.length} (size ${batchSize})`, 'info');

  // Process batches sequentially with recursive splitting
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].filter(r => !progressState.completedRecipients.has(r.address.toString()));
    if (batch.length === 0) continue;

    log(`--- Batch ${i + 1}/${batches.length} (recipients: ${batch.length}) ---`, 'info');
    await processBatchRecursive(batch, 0);
  }

  // Final reconciliation log
  log(`Completed: ${progressState.completedRecipients.size} / ${progressState.allRecipients.length}`, 'success');
  if (progressState.failedRecipients.length > 0) {
    log(`Failed recipients: ${progressState.failedRecipients.length}`, 'error');
    for (const r of progressState.failedRecipients) {
      log(` - ${r.address.toString()} (${formatAmount(r.amount, decimals)})`, 'error');
    }
    log('Tip: If you saw 403/forbidden earlier, ensure your Custom RPC URL is set and valid.', 'error');
  } else {
    log('All recipients processed successfully.', 'success');
  }
  
  return true;
}
