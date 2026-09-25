import { forwardRef, Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { RiskModule } from '../risk/risk.module';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [MarketModule, RiskModule, forwardRef(() => PortfoliosModule)],
  controllers: [HoldingsController],
  providers: [HoldingsService],
  exports: [HoldingsService],
})
export class HoldingsModule {}
