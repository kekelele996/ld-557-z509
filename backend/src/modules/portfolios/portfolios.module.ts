import { Module, forwardRef } from '@nestjs/common';
import { HoldingsModule } from '../holdings/holdings.module';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';

@Module({
  imports: [forwardRef(() => HoldingsModule)],
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  exports: [PortfoliosService],
})
export class PortfoliosModule {}

