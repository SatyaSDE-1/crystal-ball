import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LocaleRequest } from '../contracts/schemas';
import { SessionThrottlerGuard } from '../rate-limit/session-throttler.guard';
import { GreetingService } from './greeting.service';

@Controller('greeting')
@UseGuards(SessionThrottlerGuard)
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  // POST creates nothing here, so answer 200 instead of Nest's default 201.
  @Post()
  @HttpCode(HttpStatus.OK)
  getGreeting(@Body(new ZodValidationPipe(LocaleRequest)) body: LocaleRequest) {
    return this.greetingService.getGreeting(body);
  }
}
