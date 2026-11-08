import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { HI_MESSAGE_PATTERN } from '../messagepattern/index.js';
import { AI_ASSISTANT_CLIENT } from './assistant.constants.js';

@Injectable()
export class AssistantService {
  constructor(
    @Inject(AI_ASSISTANT_CLIENT) private readonly assistantClient: ClientProxy,
  ) {}

  async getHi(queryData: any) {
    const pattern = { cmd: HI_MESSAGE_PATTERN };
    return this.assistantClient.send(pattern, queryData);
  }
}
