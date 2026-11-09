import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AI_ASSISTANT_CLIENT } from '../ai-client/ai-client.constants';
import { HelpPtrn } from '../messagepattern';

@Injectable()
export class HelpService {
  constructor(
    @Inject(AI_ASSISTANT_CLIENT) private readonly assistantClient: ClientProxy,
  ) {}

  getHelp(queryData: unknown) {
    const pattern = { cmd: HelpPtrn };
    return this.assistantClient.send(pattern, queryData);
  }
}
