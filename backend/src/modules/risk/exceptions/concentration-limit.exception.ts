import { BadRequestException } from '@nestjs/common';
import { RiskLevel } from '../../../constants/enums';

export interface ConcentrationViolationDetails {
  symbol: string;
  riskLevel: RiskLevel;
  limit: number;
  weight: number;
  marketValue: number;
  totalValue: number;
}

/**
 * 加仓/新增持仓会使单一资产超过该风险等级的集中度上限时抛出。
 * 交易入账前抛出以保证交易、持仓、组合市值均不发生变化。
 */
export class ConcentrationLimitException extends BadRequestException {
  readonly details: ConcentrationViolationDetails;

  constructor(details: ConcentrationViolationDetails) {
    const percent = (details.limit * 100).toFixed(0);
    const weightPercent = (details.weight * 100).toFixed(2);
    super({
      message: `资产 ${details.symbol} 交易后占比 ${weightPercent}%，超过${details.riskLevel}风险等级单一资产上限 ${percent}%`,
      errorCode: 'SINGLE_ASSET_LIMIT_EXCEEDED',
      details,
    });
    this.details = details;
  }
}
