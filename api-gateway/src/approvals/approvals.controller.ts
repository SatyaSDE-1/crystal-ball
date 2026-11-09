import { Controller, Get } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  getApprovals() {
    return this.approvalsService.getApprovals();
  }
}
