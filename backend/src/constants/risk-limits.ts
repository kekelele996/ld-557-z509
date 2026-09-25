import { RiskLevel } from './enums';

/**
 * 单一资产市值占组合总市值的最高比例，按组合风险等级划分。
 * 保守 30% / 稳健 50% / 激进 80%。
 */
export const RISK_CONCENTRATION_LIMITS: Record<RiskLevel, number> = {
  [RiskLevel.CONSERVATIVE]: 0.3,
  [RiskLevel.MODERATE]: 0.5,
  [RiskLevel.AGGRESSIVE]: 0.8,
};

/** 浮点比较容差：占比恰好等于上限时视为未超限 */
export const CONCENTRATION_EPSILON = 1e-9;
