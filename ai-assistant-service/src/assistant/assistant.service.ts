import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class AssistantService {
  async getHiMessage(query: any) {
    console.log('hello');
    try {
      return 'hi from assistant service';
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        statusCode: 500,
        message:
          error instanceof Error ? error.message : 'Something went wrong!',
      });
    }
  }
}
