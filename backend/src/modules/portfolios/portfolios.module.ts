import { forwardRef, Module } from '@nestjs/common';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';
import { HoldingsModule } from '../holdings/holdings.module';

@Module({
  imports: [forwardRef(() => HoldingsModule)],
  controllers: [PortfoliosController],
  providers: [PortfoliosService],
  exports: [PortfoliosService],
})
export class PortfoliosModule {}
