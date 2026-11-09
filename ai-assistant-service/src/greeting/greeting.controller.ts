import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { LocaleRequest } from '../contracts/schemas';
import { GreetingPtrn } from '../messagepattern';
import { GreetingService } from './greeting.service';

@Controller()
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @MessagePattern({ cmd: GreetingPtrn })
  async getGreeting(@Payload() payload: unknown) {
    const parsed = LocaleRequest.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid greeting request',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return this.greetingService.getGreeting(parsed.data);
  }
}
