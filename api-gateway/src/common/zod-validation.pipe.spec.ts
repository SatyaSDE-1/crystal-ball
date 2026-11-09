import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ChatRequest } from '../contracts/schemas';
import { ZodValidationPipe } from './zod-validation.pipe';

const validChat = {
  sessionId: 'test-1',
  mode: 'talk',
  messages: [{ role: 'user', content: 'Which approval is first?' }],
};

function errorsOf(pipe: ZodValidationPipe, value: unknown) {
  try {
    pipe.transform(value);
  } catch (error) {
    return (error as BadRequestException).getResponse() as {
      statusCode: number;
      error: string;
      message: string;
      errors: { field: string; message: string }[];
    };
  }
  throw new Error('expected the pipe to throw');
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(ChatRequest);

  it('returns the parsed value when the input is valid', () => {
    expect(pipe.transform(validChat)).toEqual(validChat);
  });

  it('drops keys the schema does not know about', () => {
    expect(pipe.transform({ ...validChat, isAdmin: true })).toEqual(validChat);
  });

  it('throws a 400 BadRequestException for invalid input', () => {
    expect(() => pipe.transform({ ...validChat, mode: 'banana' })).toThrow(
      BadRequestException,
    );
  });

  it('reports one error per invalid field', () => {
    const body = errorsOf(pipe, { mode: 'banana', messages: [] });

    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(body.errors.map((e) => e.field).sort()).toEqual([
      'messages',
      'mode',
      'sessionId',
    ]);
    for (const error of body.errors) {
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('uses dotted paths for nested fields', () => {
    const body = errorsOf(pipe, {
      ...validChat,
      messages: [{ role: 'robot', content: 'hi' }],
    });

    expect(body.errors.map((e) => e.field)).toContain('messages.0.role');
  });

  it('rejects a missing body', () => {
    expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
  });

  it('works with any Zod schema', () => {
    const simple = new ZodValidationPipe(
      z.object({ question: z.string().min(3) }),
    );

    expect(simple.transform({ question: 'abc' })).toEqual({ question: 'abc' });
    expect(() => simple.transform({ question: 'hi' })).toThrow(
      BadRequestException,
    );
  });
});
