import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { HelpRequest } from '../contracts/schemas';
import { HelpPtrn } from '../messagepattern';
import { HelpService } from './help.service';

@Controller()
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @MessagePattern({ cmd: HelpPtrn })
  async getHelp(@Payload() payload: unknown) {
    const parsed = HelpRequest.safeParse(payload);
    if (!parsed.success) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid help request',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return this.helpService.getHelp(parsed.data);
  }
}
