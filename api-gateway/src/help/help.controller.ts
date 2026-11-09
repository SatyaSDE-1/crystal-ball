import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionThrottlerGuard } from '../rate-limit/session-throttler.guard';
import { HelpService } from './help.service';

@Controller('help')
@UseGuards(SessionThrottlerGuard)
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  // POST creates nothing here, so answer 200 instead of Nest's default 201.
  @Post()
  @HttpCode(HttpStatus.OK)
  getHelp(@Body() body: unknown) {
    return this.helpService.getHelp(body);
  }
}
