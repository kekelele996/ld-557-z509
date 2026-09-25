import { UnprocessableEntityException } from '@nestjs/common';
import { RiskLevel } from '../../constants/enums';

/**
 * 交易入账前的集中度检查失败：加仓后某资产占比将超过组合风险等级允许的上限。
 * payload 携带具体资产代码，便于调用方定位是哪笔资产超限。
 */
export class ConcentrationLimitException extends UnprocessableEntityException {
  constructor(symbol: string, weightAfter: number, limit: number, riskLevel: RiskLevel) {
    super({
      message: `asset ${symbol} would reach ${(weightAfter * 100).toFixed(2)}% of portfolio value, exceeding the ${riskLevel} single-asset limit of ${(limit * 100).toFixed(0)}%`,
      symbol,
      weightAfter: Number(weightAfter.toFixed(4)),
      limit,
      riskLevel,
    });
  }
}
