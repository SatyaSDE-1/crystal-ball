import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AI_ASSISTANT_CLIENT } from '../ai-client/ai-client.constants';
import { ApprovalsPtrn } from '../messagepattern';

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(AI_ASSISTANT_CLIENT) private readonly assistantClient: ClientProxy,
  ) {}

  getApprovals(queryData: unknown = {}) {
    const pattern = { cmd: ApprovalsPtrn };
    return this.assistantClient.send(pattern, queryData);
  }
}
