import { Injectable } from '@nestjs/common';
import { RiskLevel } from '../../constants/enums';
import { getSingleAssetLimit } from '../../constants/risk-limits';
import { ConcentrationLimitException } from './exceptions/concentration-limit.exception';

/** 集中度计算用的持仓投影：交易后的数量与计价 */
export interface ConcentrationHolding {
  symbol: string;
  quantity: number;
  /** 该持仓用于估值的价格（既有持仓取最新市价，新买入数量按成交价计价） */
  price: number;
}

export interface AssetConcentration {
  symbol: string;
  marketValue: number;
  weight: number;
  overLimit: boolean;
}

export interface ConcentrationSnapshot {
  riskLevel: RiskLevel;
  singleAssetLimit: number;
  totalValue: number;
  overLimit: boolean;
  assets: AssetConcentration[];
}

const WEIGHT_EPSILON = 1e-9;

@Injectable()
export class RiskService {
  /**
   * 汇总给定持仓结构下各资产的市值占比，并标记是否已超出该风险等级的单一资产上限。
   * 同一资产代码（可能存在多行持仓）按代码合并计算。
   */
  evaluate(holdings: ConcentrationHolding[], riskLevel: RiskLevel): ConcentrationSnapshot {
    const limit = getSingleAssetLimit(riskLevel);
    const marketValues = new Map<string, number>();
    for (const holding of holdings) {
      if (holding.quantity <= 0) continue;
      const symbol = holding.symbol.toUpperCase();
      marketValues.set(symbol, (marketValues.get(symbol) ?? 0) + holding.price * holding.quantity);
    }

    const totalValue = [...marketValues.values()].reduce((sum, value) => sum + value, 0);
    const assets: AssetConcentration[] = [...marketValues.entries()]
      .map(([symbol, marketValue]) => {
        const weight = totalValue > 0 ? marketValue / totalValue : 0;
        return {
          symbol,
          marketValue: Number(marketValue.toFixed(2)),
          weight: Number(weight.toFixed(6)),
          overLimit: weight > limit + WEIGHT_EPSILON,
        };
      })
      .sort((a, b) => b.weight - a.weight);

    return {
      riskLevel,
      singleAssetLimit: limit,
      totalValue: Number(totalValue.toFixed(2)),
      overLimit: assets.some((asset) => asset.overLimit),
      assets,
    };
  }

  /**
   * 校验交易完成后的持仓结构是否满足单一资产集中度要求，超限时抛出
   * ConcentrationLimitException（调用方需在写入交易/持仓之前调用）。
   */
  assertTradeAllowed(holdings: ConcentrationHolding[], riskLevel: RiskLevel): ConcentrationSnapshot {
    const snapshot = this.evaluate(holdings, riskLevel);
    const violation = snapshot.assets.find((asset) => asset.overLimit);
    if (violation) {
      throw new ConcentrationLimitException({
        symbol: violation.symbol,
        riskLevel,
        limit: snapshot.singleAssetLimit,
        weight: violation.weight,
        marketValue: violation.marketValue,
        totalValue: snapshot.totalValue,
      });
    }
    return snapshot;
  }
}
