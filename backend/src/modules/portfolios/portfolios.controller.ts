import { Body, Controller, Delete, forwardRef, Get, Inject, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../types/request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HoldingsService } from '../holdings/holdings.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { PortfoliosService } from './portfolios.service';

@ApiTags('portfolios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolios')
export class PortfoliosController {
  constructor(
    private readonly portfoliosService: PortfoliosService,
    @Inject(forwardRef(() => HoldingsService))
    private readonly holdingsService: HoldingsService,
  ) {}

  @Get()
  list(@CurrentUserDecorator() user: CurrentUser) {
    return this.portfoliosService.list(user);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() user: CurrentUser) {
    const portfolio = this.portfoliosService.findOwned(id, user);
    const concentration = this.holdingsService.concentrationSnapshot(id, user);
    return {
      ...portfolio,
      singleAssetLimit: concentration.singleAssetLimit,
      overLimit: concentration.overLimit,
      concentration,
    };
  }

  @Post()
  create(@Body() dto: CreatePortfolioDto, @CurrentUserDecorator() user: CurrentUser) {
    return this.portfoliosService.create(dto, user);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePortfolioDto, @CurrentUserDecorator() user: CurrentUser) {
    return this.portfoliosService.update(id, dto, user);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() user: CurrentUser) {
    return this.portfoliosService.delete(id, user);
  }

  @Get(':id/performance')
  performance(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() user: CurrentUser) {
    return this.portfoliosService.performance(id, user);
  }
}
