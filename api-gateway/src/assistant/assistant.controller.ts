import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AssistantService } from './assistant.service.js';

const assistantRouteToMethod: { [key: string]: keyof AssistantService } = {
  hi: 'getHi',
};

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('/:endpoint')
  async handleMappedRoutes(
    @Param('endpoint') endpoint: string,
    @Query() query: Record<string, any>,
  ) {
    const methodName = assistantRouteToMethod[endpoint];
    if (
      !methodName ||
      typeof this.assistantService[methodName] !== 'function'
    ) {
      throw new NotFoundException(`No handler for /assistant/${endpoint}`);
    }
    return this.assistantService[methodName](query);
  }
}
