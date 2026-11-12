// The BENFIT launch curve, shared by create-config.ts and the localnet run.
import '../../src/launch/polyfill';
import * as sdk from '@meteora-ag/dynamic-bonding-curve-sdk';

export function benfitCurve() {
  return sdk.buildCurveWithMarketCap({
    token: {
      tokenType: sdk.TokenType.SPLToken,
      tokenBaseDecimal: sdk.TokenDecimal.SIX,
      tokenQuoteDecimal: sdk.TokenDecimal.NINE,
      tokenAuthorityOption: sdk.TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: sdk.BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: { startingFeeBps: 100, endingFeeBps: 100, numberOfPeriod: 0, totalDuration: 0 },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: sdk.CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 0,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: sdk.MigrationOption.MET_DAMM_V2,
      migrationFeeOption: sdk.MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: 100,
      creatorLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: sdk.ActivationType.Timestamp,
    initialMarketCap: Number(process.env.INITIAL_MCAP_SOL ?? 30),
    migrationMarketCap: Number(process.env.MIGRATION_MCAP_SOL ?? 400),
  } as never);
}
