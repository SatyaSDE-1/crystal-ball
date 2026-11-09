import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { LocaleRequest } from '../contracts/schemas';
import { SummaryPtrn } from '../messagepattern';
import { SummaryService } from './summary.service';

@Controller()
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @MessagePattern({ cmd: SummaryPtrn })
  async getSummary(@Payload() payload: unknown) {
    const parsed = LocaleRequest.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid summary request',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return this.summaryService.getSummary(parsed.data);
  }
}
