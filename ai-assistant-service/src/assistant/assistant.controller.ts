import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { HI_MESSAGE_PATTERN } from '../messagepattern/index.js';
import { AssistantService } from './assistant.service.js';

@Controller()
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @MessagePattern({ cmd: HI_MESSAGE_PATTERN })
  async getHiMessage(@Payload() query: any) {
    return this.assistantService.getHiMessage(query);
  }
}
