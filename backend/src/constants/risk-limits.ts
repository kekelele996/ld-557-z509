import { RiskLevel } from './enums';

/**
 * 单一资产市值占组合总市值的比例上限（按风险等级）
 * - 保守组合：单个资产最多 30%
 * - 稳健组合：单个资产最多 50%
 * - 激进组合：单个资产最多 80%
 */
export const SINGLE_ASSET_LIMITS: Record<RiskLevel, number> = {
  [RiskLevel.CONSERVATIVE]: 0.3,
  [RiskLevel.MODERATE]: 0.5,
  [RiskLevel.AGGRESSIVE]: 0.8,
};

export function getSingleAssetLimit(riskLevel: RiskLevel): number {
  return SINGLE_ASSET_LIMITS[riskLevel];
}
