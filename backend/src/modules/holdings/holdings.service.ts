import { Injectable, NotFoundException } from '@nestjs/common';
import { ConcentrationLimitException } from '../../common/exceptions/concentration-limit.exception';
import { CONCENTRATION_EPSILON, RISK_CONCENTRATION_LIMITS } from '../../constants/risk-limits';
import { CurrentUser } from '../../types/request';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { MarketService } from '../market/market.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

export interface HoldingRecord {
  id: number;
  portfolioId: number;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
}

@Injectable()
export class HoldingsService {
  private readonly holdings: HoldingRecord[] = [
    { id: 1, portfolioId: 1, symbol: 'AAPL', quantity: 10, avgCost: 180, currentPrice: 195.2, pnl: 152 },
  ];
  private nextId = 2;

  constructor(
    private readonly marketService: MarketService,
    private readonly portfoliosService: PortfoliosService,
  ) {}

  listByPortfolio(portfolioId: number, user: CurrentUser) {
    this.portfoliosService.findOwned(portfolioId, user);
    return this.revalueAll(this.holdings.filter((item) => item.portfolioId === portfolioId));
  }

  findOwned(id: number, user: CurrentUser) {
    const holding = this.holdings.find((item) => item.id === id);
    if (!holding) throw new NotFoundException('holding not found');
    this.portfoliosService.findOwned(holding.portfolioId, user);
    return this.revalue(holding);
  }

  create(portfolioId: number, dto: CreateHoldingDto, user: CurrentUser) {
    this.portfoliosService.findOwned(portfolioId, user);
    this.assertBuyWithinConcentrationLimit(portfolioId, dto.symbol, dto.quantity, user);
    const currentPrice = this.marketService.currentPrice(dto.symbol);
    const holding: HoldingRecord = {
      id: this.nextId++,
      portfolioId,
      symbol: dto.symbol.toUpperCase(),
      quantity: dto.quantity,
      avgCost: dto.avgCost,
      currentPrice,
      pnl: (currentPrice - dto.avgCost) * dto.quantity,
    };
    this.holdings.push(holding);
    this.recomputePortfolioValue(portfolioId);
    return holding;
  }

  delete(id: number, user: CurrentUser) {
    const holding = this.findOwned(id, user);
    const index = this.holdings.findIndex((item) => item.id === id);
    this.holdings.splice(index, 1);
    this.recomputePortfolioValue(holding.portfolioId);
    return { deleted: true, id };
  }

  applyTransaction(holdingId: number, quantity: number, price: number, type: 'BUY' | 'SELL' | 'DIVIDEND', user: CurrentUser) {
    const holding = this.findOwned(holdingId, user);
    if (type === 'BUY') {
      const newQuantity = holding.quantity + quantity;
      holding.avgCost = ((holding.avgCost * holding.quantity) + (price * quantity)) / newQuantity;
      holding.quantity = newQuantity;
    }
    if (type === 'SELL') {
      holding.quantity = Math.max(0, holding.quantity - quantity);
    }
    this.revalue(holding);
    this.recomputePortfolioValue(holding.portfolioId);
    return holding;
  }

  /**
   * 买入/新增持仓入账前的集中度检查：按组合风险等级上限（保守30%/稳健50%/激进80%）
   * 校验交易完成后的持仓结构。买入某资产只会推高该资产自身的占比（分母变大，
   * 其他资产占比只会下降），因此只需断言被买入资产交易后的权重；
   * 已超限的其他资产不拦截，组合仍可卖出、减仓或买入其他资产再平衡。
   * 本方法在任何写入之前调用，抛异常时持仓与组合市值保持原样。
   */
  assertBuyWithinConcentrationLimit(portfolioId: number, symbol: string, addedQuantity: number, user: CurrentUser) {
    const portfolio = this.portfoliosService.findOwned(portfolioId, user);
    const limit = RISK_CONCENTRATION_LIMITS[portfolio.riskLevel];
    const target = symbol.toUpperCase();
    const addedPrice = this.marketService.currentPrice(target);

    let totalAfter = addedQuantity * addedPrice;
    let targetValueAfter = addedQuantity * addedPrice;
    for (const holding of this.holdings.filter((item) => item.portfolioId === portfolioId)) {
      const value = holding.quantity * this.marketService.currentPrice(holding.symbol);
      totalAfter += value;
      if (holding.symbol === target) targetValueAfter += value;
    }

    const weightAfter = totalAfter === 0 ? 0 : targetValueAfter / totalAfter;
    if (weightAfter > limit + CONCENTRATION_EPSILON) {
      throw new ConcentrationLimitException(target, weightAfter, limit, portfolio.riskLevel);
    }
  }

  /**
   * 组合集中度回读：当前风险等级对应的单一资产上限、各资产市值权重、
   * 是否超限以及超限资产列表。供组合详情展示。
   */
  concentrationStatus(portfolioId: number, user: CurrentUser) {
    const portfolio = this.portfoliosService.findOwned(portfolioId, user);
    const limit = RISK_CONCENTRATION_LIMITS[portfolio.riskLevel];

    const valueBySymbol = new Map<string, number>();
    let totalValue = 0;
    for (const holding of this.holdings.filter((item) => item.portfolioId === portfolioId)) {
      const value = holding.quantity * this.marketService.currentPrice(holding.symbol);
      valueBySymbol.set(holding.symbol, (valueBySymbol.get(holding.symbol) ?? 0) + value);
      totalValue += value;
    }

    const weights = [...valueBySymbol.entries()].map(([symbol, value]) => {
      const weight = totalValue === 0 ? 0 : value / totalValue;
      return {
        symbol,
        value: Number(value.toFixed(2)),
        weight: Number(weight.toFixed(4)),
        exceeded: weight > limit + CONCENTRATION_EPSILON,
      };
    });

    return {
      riskLevel: portfolio.riskLevel,
      maxSingleAssetWeight: limit,
      exceeded: weights.some((item) => item.exceeded),
      totalValue: Number(totalValue.toFixed(2)),
      weights,
      breaches: weights.filter((item) => item.exceeded),
    };
  }

  private revalueAll(items: HoldingRecord[]) {
    return items.map((item) => this.revalue(item));
  }

  private revalue(holding: HoldingRecord) {
    holding.currentPrice = this.marketService.currentPrice(holding.symbol);
    holding.pnl = Number(((holding.currentPrice - holding.avgCost) * holding.quantity).toFixed(2));
    return holding;
  }

  private recomputePortfolioValue(portfolioId: number) {
    const total = this.revalueAll(this.holdings.filter((item) => item.portfolioId === portfolioId))
      .reduce((sum, item) => sum + item.currentPrice * item.quantity, 0);
    this.portfoliosService.setTotalValue(portfolioId, total);
  }
}

