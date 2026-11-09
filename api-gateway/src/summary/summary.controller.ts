import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionThrottlerGuard } from '../rate-limit/session-throttler.guard';
import { SummaryService } from './summary.service';

@Controller('summary')
@UseGuards(SessionThrottlerGuard)
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  // POST creates nothing here, so answer 200 instead of Nest's default 201.
  @Post()
  @HttpCode(HttpStatus.OK)
  getSummary() {
    return this.summaryService.getSummary();
  }
}
