import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { from, Observable } from 'rxjs';
import { ChatRequest } from '../contracts/schemas';
import { ChatPtrn } from '../messagepattern';
import { ChatEvent } from './chat.events';
import { ChatService } from './chat.service';

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}


  @MessagePattern({ cmd: ChatPtrn })
  chat(@Payload() payload: unknown): Observable<ChatEvent> {
    const parsed = ChatRequest.safeParse(payload);
    if (!parsed.success) {
      throw new RpcException({
        statusCode: 400,
        message: 'Invalid chat request',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return from(this.chatService.chat(parsed.data));
  }
}
