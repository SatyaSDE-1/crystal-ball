import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ChatRequest } from '../contracts/schemas';
import { SessionThrottlerGuard } from '../rate-limit/session-throttler.guard';
import { FRIENDLY_ERROR_MESSAGE } from './chat-event';
import { ChatService } from './chat.service';
import { formatSseEvent } from './sse';

@Controller('chat')
@UseGuards(SessionThrottlerGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST + Server-Sent Events (the body carries the conversation, so the
   * browser's GET-only EventSource cannot be used; clients read the stream
   * with fetch). Validation runs first, so a bad request is a normal 400
   * JSON response and no stream is opened.
   */
  @Post()
  chat(
    @Body(new ZodValidationPipe(ChatRequest)) body: ChatRequest,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // stop proxies from buffering the stream
    res.flushHeaders();

    const subscription = this.chatService.chat(body).subscribe({
      next: (event) => res.write(formatSseEvent(event)),
      // The AI service is unreachable or dropped the connection: tell the
      // client in-band and close, never a 500 or a hanging stream.
      error: () => {
        if (!res.writableEnded) {
          res.write(
            formatSseEvent({ type: 'error', message: FRIENDLY_ERROR_MESSAGE }),
          );
          res.end();
        }
      },
      complete: () => res.end(),
    });

    // Client went away: stop listening.
    req.on('close', () => subscription.unsubscribe());
  }
}
