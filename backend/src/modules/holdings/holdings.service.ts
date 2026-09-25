import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from '../../types/request';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { MarketService } from '../market/market.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { ConcentrationHolding, ConcentrationSnapshot, RiskService } from '../risk/risk.service';

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
    private readonly riskService: RiskService,
  ) {}

  listByPortfolio(portfolioId: number, user: CurrentUser) {
    this.portfoliosService.findOwned(portfolioId, user);
    return this.portfolioHoldings(portfolioId);
  }

  findOwned(id: number, user: CurrentUser) {
    const holding = this.holdings.find((item) => item.id === id);
    if (!holding) throw new NotFoundException('holding not found');
    this.portfoliosService.findOwned(holding.portfolioId, user);
    return this.revalue(holding);
  }

  create(portfolioId: number, dto: CreateHoldingDto, user: CurrentUser) {
    const portfolio = this.portfoliosService.findOwned(portfolioId, user);
    const symbol = dto.symbol.toUpperCase();
    const currentPrice = this.marketService.currentPrice(symbol);

    // 入账前检查：模拟新增持仓完成后的持仓结构，超限时在此处失败，不写入任何数据
    const projected = this.toConcentrationHoldings(this.portfolioHoldings(portfolioId));
    projected.push({ symbol, quantity: dto.quantity, price: currentPrice });
    this.riskService.assertTradeAllowed(projected, portfolio.riskLevel);

    const holding: HoldingRecord = {
      id: this.nextId++,
      portfolioId,
      symbol,
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

  /** 组合当前持仓结构的集中度回读结果（风险上限、是否超限、各资产占比） */
  concentrationSnapshot(portfolioId: number, user: CurrentUser): ConcentrationSnapshot {
    const portfolio = this.portfoliosService.findOwned(portfolioId, user);
    return this.riskService.evaluate(this.toConcentrationHoldings(this.portfolioHoldings(portfolioId)), portfolio.riskLevel);
  }

  /**
   * 买入入账前的集中度校验：模拟这笔买入完成后的持仓结构。
   * 既有持仓数量按最新市值计价，本次新买入的数量按成交价计价；
   * 校验失败会抛出 ConcentrationLimitException，调用方不得继续入账。
   */
  assertBuyConcentration(holdingId: number, quantity: number, price: number, user: CurrentUser): ConcentrationSnapshot {
    const holding = this.findOwned(holdingId, user);
    const portfolio = this.portfoliosService.findOwned(holding.portfolioId, user);
    const projected = this.toConcentrationHoldings(this.portfolioHoldings(holding.portfolioId));
    projected.push({ symbol: holding.symbol, quantity, price });
    return this.riskService.assertTradeAllowed(projected, portfolio.riskLevel);
  }

  private portfolioHoldings(portfolioId: number): HoldingRecord[] {
    return this.revalueAll(this.holdings.filter((item) => item.portfolioId === portfolioId));
  }

  private toConcentrationHoldings(holdings: HoldingRecord[]): ConcentrationHolding[] {
    return holdings.map((item) => ({ symbol: item.symbol, quantity: item.quantity, price: item.currentPrice }));
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
    const total = this.portfolioHoldings(portfolioId)
      .reduce((sum, item) => sum + item.currentPrice * item.quantity, 0);
    this.portfoliosService.setTotalValue(portfolioId, total);
  }
}
