import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { Approval } from '../contracts/schemas';

const ApprovalList = z.array(Approval);

@Injectable()
export class ApprovalsService {
  private readonly approvals: Approval[] = ApprovalList.parse(
    JSON.parse(
      readFileSync(join(__dirname, '../data/approvals.json'), 'utf-8'),
    ),
  );

  getApprovals(): Approval[] {
    return structuredClone(this.approvals);
  }
}
