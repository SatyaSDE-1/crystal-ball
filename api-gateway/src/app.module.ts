import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApprovalsModule } from './approvals/approvals.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ApprovalsModule],
})
export class AppModule {}
