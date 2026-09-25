import { Module, forwardRef } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [MarketModule, forwardRef(() => PortfoliosModule)],
  controllers: [HoldingsController],
  providers: [HoldingsService],
  exports: [HoldingsService],
})
export class HoldingsModule {}

