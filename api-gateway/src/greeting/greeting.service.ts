import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AI_ASSISTANT_CLIENT } from '../ai-client/ai-client.constants';
import { GreetingPtrn } from '../messagepattern';

@Injectable()
export class GreetingService {
  constructor(
    @Inject(AI_ASSISTANT_CLIENT) private readonly assistantClient: ClientProxy,
  ) {}

  getGreeting(queryData: unknown = {}) {
    const pattern = { cmd: GreetingPtrn };
    return this.assistantClient.send(pattern, queryData);
  }
}
