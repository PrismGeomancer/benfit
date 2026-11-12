// Launch transaction on Meteora Dynamic Bonding Curve. Loaded only on #/launch.
import './polyfill';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

export interface LaunchInput {
  rpcUrl: string;
  configKey: string;
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  firstBuySol: number;
}

/**
 * One transaction: create the pool (and its mint) under the BENFIT config, plus an optional first buy.
 * The mint keypair is generated here and signs locally; the creator's wallet signs and sends.
 * Fee routing comes from the config (fee claimer = payroll wallet), not from anything in this tx.
 */
export async function buildLaunchTx(i: LaunchInput) {
  const connection = new Connection(i.rpcUrl, 'confirmed');
  const client = new DynamicBondingCurveClient(connection, 'confirmed');
  const creator = new PublicKey(i.creator);
  const baseMint = Keypair.generate();
  const tx = await client.creator.createPoolWithFirstBuy({
    createPoolParam: {
      name: i.name,
      symbol: i.symbol,
      uri: i.uri,
      payer: creator,
      poolCreator: creator,
      config: new PublicKey(i.configKey),
      baseMint: baseMint.publicKey,
    },
    firstBuyParam:
      i.firstBuySol > 0
        ? {
            buyer: creator,
            buyAmount: new BN(Math.round(i.firstBuySol * LAMPORTS_PER_SOL)),
            // Same transaction as pool creation: nobody can trade in between.
            minimumAmountOut: new BN(1),
            referralTokenAccount: null,
          }
        : undefined,
  });
  tx.feePayer = creator;
  tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
  tx.partialSign(baseMint);
  return {
    bytes: tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
    mint: baseMint.publicKey.toBase58(),
    connection,
  };
}

export async function confirmed(connection: Connection, signature: string): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const s = value[0];
    if (s?.err) return false;
    if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}
