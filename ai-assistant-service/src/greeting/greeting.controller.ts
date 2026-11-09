import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { GreetingPtrn } from '../messagepattern';
import { GreetingService } from './greeting.service';

@Controller()
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  @MessagePattern({ cmd: GreetingPtrn })
  async getGreeting() {
    return this.greetingService.getGreeting();
  }
}
