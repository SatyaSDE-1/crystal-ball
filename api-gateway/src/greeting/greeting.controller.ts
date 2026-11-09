import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionThrottlerGuard } from '../rate-limit/session-throttler.guard';
import { GreetingService } from './greeting.service';

@Controller('greeting')
@UseGuards(SessionThrottlerGuard)
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  // POST creates nothing here, so answer 200 instead of Nest's default 201.
  @Post()
  @HttpCode(HttpStatus.OK)
  getGreeting() {
    return this.greetingService.getGreeting();
  }
}
