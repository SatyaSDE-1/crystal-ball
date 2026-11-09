import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { AI_ASSISTANT_CLIENT } from '../ai-client/ai-client.constants';
import { ChatRequest } from '../contracts/schemas';
import { ChatPtrn } from '../messagepattern';
import { ChatEvent } from './chat-event';

@Injectable()
export class ChatService {
  constructor(
    @Inject(AI_ASSISTANT_CLIENT) private readonly assistantClient: ClientProxy,
  ) {}

  /** The AI service emits one value per event; they arrive as they are produced. */
  chat(request: ChatRequest): Observable<ChatEvent> {
    const pattern = { cmd: ChatPtrn };
    return this.assistantClient.send<ChatEvent>(pattern, request);
  }
}
