import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { SummaryPtrn } from '../messagepattern';
import { SummaryService } from './summary.service';

@Controller()
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @MessagePattern({ cmd: SummaryPtrn })
  async getSummary() {
    return this.summaryService.getSummary();
  }
}
