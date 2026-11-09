import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AI_ASSISTANT_CLIENT } from '../ai-client/ai-client.constants';
import { SummaryPtrn } from '../messagepattern';

@Injectable()
export class SummaryService {
  constructor(
    @Inject(AI_ASSISTANT_CLIENT) private readonly assistantClient: ClientProxy,
  ) {}

  getSummary(queryData: unknown = {}) {
    const pattern = { cmd: SummaryPtrn };
    return this.assistantClient.send(pattern, queryData);
  }
}
