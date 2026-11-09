import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApprovalsPtrn } from '../messagepattern';
import { ApprovalsService } from './approvals.service';

@Controller()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @MessagePattern({ cmd: ApprovalsPtrn })
  getApprovals() {
    return this.approvalsService.getApprovals();
  }
}
