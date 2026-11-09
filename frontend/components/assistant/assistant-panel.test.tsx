import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, type Mock } from 'vitest'
import { approvalFixtures } from '@/fixtures/approvals'
import type { ChatEvent, HelpResponse, SummaryResponse } from '@/lib/contracts'
import { ApiError } from '@/lib/errors'
import type { AssistantService } from '@/services/assistant-service'
import { createChannel } from '@/test-utils/channel'
import { AssistantProvider } from './assistant-provider'
import { AssistantPanel } from './assistant-panel'

const summary: SummaryResponse = {
  headline: '4 approvals pending review; 1 high priority.',
  items: [
    { id: 'apr-3', urgency: 'high', reason: 'Safety specs block the demo.' },
    { id: 'apr-1', urgency: 'medium', reason: 'Onboarding needed soon.' },
    { id: 'apr-4', urgency: 'medium', reason: 'Layout affects patrols.' },
    { id: 'apr-2', urgency: 'low', reason: 'Demo video, not blocking.' },
  ],
  source: 'ai',
}

const helpAnswer: HelpResponse = {
  answer: 'Reject items when the file is corrupt or outdated.',
  citations: ['rejection-criteria', 'escalation'],
  source: 'ai',
}

/** Every method of the service, as a mock the tests can inspect and re-script. */
type FakeMethods = { [K in keyof AssistantService]: Mock }

function fakeService(overrides: Partial<FakeMethods> = {}) {
  const service: FakeMethods = {
    getGreeting: vi.fn().mockResolvedValue({ text: 'Good morning! 4 approvals await.', source: 'ai' }),
    getSummary: vi.fn().mockResolvedValue(summary),
    askHelp: vi.fn().mockResolvedValue(helpAnswer),
    streamChat: vi.fn(),
    ...overrides,
  }
  return service as AssistantService & FakeMethods
}

/** Makes streamChat return a stream the test drives token by token. */
function liveStream(service: ReturnType<typeof fakeService>) {
  const channel = createChannel<ChatEvent>()
  service.streamChat.mockImplementation((_request: unknown, signal?: AbortSignal) => {
    signal?.addEventListener('abort', () => channel.fail(new DOMException('Aborted', 'AbortError')))
    return channel.iterable
  })
  return channel
}

function renderPanel(service = fakeService(), onClose = vi.fn()) {
  const user = userEvent.setup()
  render(
    <AssistantProvider service={service} approvals={approvalFixtures}>
      <AssistantPanel onClose={onClose} />
    </AssistantProvider>,
  )
  return { user, service, onClose }
}

async function openChat(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole('button', { name }))
}

async function send(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole('textbox', { name: /message/i }), `${text}{Enter}`)
}

describe('AssistantPanel', () => {
  describe('home view', () => {
    it('matches the reference: header, four action cards and Replay Greeting', async () => {
      renderPanel()

      expect(screen.getByRole('region', { name: /assistant/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /approvals/i })).toBeInTheDocument()
      for (const name of [/present me summary/i, /talk to me/i, /help me/i, /teach me/i]) {
        expect(screen.getByRole('button', { name })).toBeInTheDocument()
      }
      expect(screen.getByRole('button', { name: /replay greeting/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /close assistant/i })).toBeInTheDocument()
      expect(await screen.findByText(/good morning/i)).toBeInTheDocument()
    })

    it('shows the number of approvals in the footer', async () => {
      renderPanel()

      expect(screen.getByText(/4 items/i)).toBeInTheDocument()
      await screen.findByText(/good morning/i)
    })

    it('shows a loading state while the greeting is being generated', async () => {
      let resolve: (value: { text: string; source: 'ai' }) => void = () => {}
      const service = fakeService({ getGreeting: vi.fn(() => new Promise(r => (resolve = r))) })
      renderPanel(service)

      expect(screen.getByRole('status', { name: /loading greeting/i })).toBeInTheDocument()

      resolve({ text: 'Welcome back! 4 approvals await.', source: 'ai' })
      expect(await screen.findByText(/welcome back/i)).toBeInTheDocument()
      expect(screen.queryByRole('status', { name: /loading greeting/i })).not.toBeInTheDocument()
    })

    it('says when the greeting is a basic one because the AI is unavailable', async () => {
      const service = fakeService({ getGreeting: vi.fn().mockResolvedValue({ text: 'You have 4 approvals pending.', source: 'fallback' }) })
      renderPanel(service)

      expect(await screen.findByText('You have 4 approvals pending.')).toBeInTheDocument()
      expect(screen.getByText(/basic greeting/i)).toBeInTheDocument()
    })

    it('still greets the operator when the API cannot be reached', async () => {
      const service = fakeService({ getGreeting: vi.fn().mockRejectedValue(new ApiError('network')) })
      renderPanel(service)

      expect(await screen.findByText('Hello, Operator! You have 4 approvals pending.')).toBeInTheDocument()
    })

    it('Replay Greeting generates a fresh greeting', async () => {
      const service = fakeService({
        getGreeting: vi
          .fn()
          .mockResolvedValueOnce({ text: 'First hello! 4 pending.', source: 'ai' })
          .mockResolvedValueOnce({ text: 'Second hello! 4 pending.', source: 'ai' }),
      })
      const { user } = renderPanel(service)
      await screen.findByText(/first hello/i)

      await user.click(screen.getByRole('button', { name: /replay greeting/i }))

      expect(await screen.findByText(/second hello/i)).toBeInTheDocument()
      expect(service.getGreeting).toHaveBeenCalledTimes(2)
    })

    it('calls onClose from the close button', async () => {
      const { user, onClose } = renderPanel()
      await screen.findByText(/good morning/i)

      await user.click(screen.getByRole('button', { name: /close assistant/i }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('can be minimised and restored', async () => {
      const { user } = renderPanel()
      await screen.findByText(/good morning/i)

      await user.click(screen.getByRole('button', { name: /minimi[sz]e assistant/i }))
      expect(screen.queryByRole('region', { name: /assistant/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /crystal ball assistant/i }))
      expect(screen.getByRole('region', { name: /assistant/i })).toBeInTheDocument()
    })
  })

  describe('Present me Summary', () => {
    it('shows a loading state, then the prioritised approvals', async () => {
      let resolve: (value: SummaryResponse) => void = () => {}
      const service = fakeService({ getSummary: vi.fn(() => new Promise(r => (resolve = r))) })
      const { user } = renderPanel(service)

      await openChat(user, /present me summary/i)
      expect(screen.getByRole('status', { name: /loading summary/i })).toBeInTheDocument()

      resolve(summary)
      expect(await screen.findByText(summary.headline)).toBeInTheDocument()
      expect(screen.queryByRole('status', { name: /loading summary/i })).not.toBeInTheDocument()
    })

    it('lists every item with its title, urgency and reason, most urgent first', async () => {
      const { user } = renderPanel()

      await openChat(user, /present me summary/i)
      await screen.findByText(summary.headline)

      const rows = screen.getAllByRole('listitem')
      expect(rows).toHaveLength(4)
      expect(within(rows[0]).getByText('Safety Equipment & Sensor Specs')).toBeInTheDocument()
      expect(within(rows[0]).getByText(/high/i)).toBeInTheDocument()
      expect(within(rows[0]).getByText('Safety specs block the demo.')).toBeInTheDocument()
      expect(within(rows[3]).getByText(/low/i)).toBeInTheDocument()
    })

    it('labels an AI summary as AI', async () => {
      const { user } = renderPanel()

      await openChat(user, /present me summary/i)
      await screen.findByText(summary.headline)

      expect(screen.getByText(/ai summary/i)).toBeInTheDocument()
    })

    it('explains when the AI was unavailable and a basic ranking is shown', async () => {
      const service = fakeService({ getSummary: vi.fn().mockResolvedValue({ ...summary, source: 'fallback' }) })
      const { user } = renderPanel(service)

      await openChat(user, /present me summary/i)

      expect(await screen.findByText(/ai is unavailable/i)).toBeInTheDocument()
    })

    it('shows a friendly error with Try again, and recovers', async () => {
      const service = fakeService({
        getSummary: vi.fn().mockRejectedValueOnce(new ApiError('unavailable')).mockResolvedValueOnce(summary),
      })
      const { user } = renderPanel(service)

      await openChat(user, /present me summary/i)
      expect(await screen.findByRole('alert')).toHaveTextContent(/temporarily unavailable/i)

      await user.click(screen.getByRole('button', { name: /try again/i }))

      expect(await screen.findByText(summary.headline)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('goes back to the action cards', async () => {
      const { user } = renderPanel()
      await openChat(user, /present me summary/i)
      await screen.findByText(summary.headline)

      await user.click(screen.getByRole('button', { name: /back/i }))

      expect(screen.getByRole('button', { name: /talk to me/i })).toBeInTheDocument()
    })
  })

  describe('Help me', () => {
    it('answers a question from the policy, with readable citations', async () => {
      const { user, service } = renderPanel()
      await openChat(user, /help me/i)

      await user.type(screen.getByRole('textbox', { name: /your question/i }), 'What are the rejection criteria?')
      await user.click(screen.getByRole('button', { name: /^ask$/i }))

      expect(await screen.findByText(helpAnswer.answer)).toBeInTheDocument()
      expect(screen.getByText('Rejection criteria')).toBeInTheDocument()
      expect(screen.getByText('Escalation')).toBeInTheDocument()
      expect(service.askHelp).toHaveBeenCalledWith('What are the rejection criteria?', expect.anything())
    })

    it('writes short source names as acronyms ("sla" becomes "SLA")', async () => {
      const service = fakeService({
        askHelp: vi.fn().mockResolvedValue({ answer: 'Two business days.', citations: ['sla', 'file-type-rules'], source: 'ai' }),
      })
      const { user } = renderPanel(service)
      await openChat(user, /help me/i)

      await user.type(screen.getByRole('textbox', { name: /your question/i }), 'How fast are reviews?{Enter}')

      expect(await screen.findByText('SLA')).toBeInTheDocument()
      expect(screen.getByText('File type rules')).toBeInTheDocument()
    })

    it('shows a loading state while the answer is on its way', async () => {
      let resolve: (value: HelpResponse) => void = () => {}
      const service = fakeService({ askHelp: vi.fn(() => new Promise(r => (resolve = r))) })
      const { user } = renderPanel(service)
      await openChat(user, /help me/i)

      await user.type(screen.getByRole('textbox', { name: /your question/i }), 'What is the SLA?{Enter}')

      expect(screen.getByRole('status', { name: /looking up/i })).toBeInTheDocument()
      resolve(helpAnswer)
      expect(await screen.findByText(helpAnswer.answer)).toBeInTheDocument()
    })

    it('presents "not covered" plainly, without citations', async () => {
      const service = fakeService({
        askHelp: vi.fn().mockResolvedValue({ answer: 'Not covered in the policy note', citations: [], source: 'fallback' }),
      })
      const { user } = renderPanel(service)
      await openChat(user, /help me/i)

      await user.type(screen.getByRole('textbox', { name: /your question/i }), 'What is the capital of France?{Enter}')

      expect(await screen.findByText(/not covered in the policy note/i)).toBeInTheDocument()
      expect(screen.queryByText(/sources/i)).not.toBeInTheDocument()
    })

    it('tells the user when the policy text is shown instead of an AI answer', async () => {
      const service = fakeService({
        askHelp: vi.fn().mockResolvedValue({ answer: 'Reject an item when the file is corrupt.', citations: ['rejection-criteria'], source: 'fallback' }),
      })
      const { user } = renderPanel(service)
      await openChat(user, /help me/i)

      await user.type(screen.getByRole('textbox', { name: /your question/i }), 'Rejection criteria?{Enter}')

      expect(await screen.findByText(/ai is unavailable/i)).toBeInTheDocument()
    })

    it('shows an error with Try again when the request fails', async () => {
      const service = fakeService({
        askHelp: vi.fn().mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(helpAnswer),
      })
      const { user } = renderPanel(service)
      await openChat(user, /help me/i)

      await user.type(screen.getByRole('textbox', { name: /your question/i }), 'What is the SLA?{Enter}')
      expect(await screen.findByRole('alert')).toHaveTextContent(/reach the server/i)

      await user.click(screen.getByRole('button', { name: /try again/i }))

      expect(await screen.findByText(helpAnswer.answer)).toBeInTheDocument()
    })

    it('will not send a question shorter than 3 characters', async () => {
      const { user, service } = renderPanel()
      await openChat(user, /help me/i)

      await user.type(screen.getByRole('textbox', { name: /your question/i }), 'hi')

      expect(screen.getByRole('button', { name: /^ask$/i })).toBeDisabled()
      expect(service.askHelp).not.toHaveBeenCalled()
    })

    it('offers example questions that can be tapped', async () => {
      const { user, service } = renderPanel()
      await openChat(user, /help me/i)

      await user.click(screen.getByRole('button', { name: /what are the rejection criteria/i }))

      await waitFor(() => expect(service.askHelp).toHaveBeenCalledWith('What are the rejection criteria?', expect.anything()))
    })
  })

  describe('Talk to me: chat states', () => {
    it('LOADING: shows the user message, a typing indicator and a disabled input before the first token', async () => {
      const service = fakeService()
      liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)

      await send(user, 'Which approval needs my attention first?')

      expect(screen.getByText('Which approval needs my attention first?')).toBeInTheDocument()
      expect(screen.getByRole('status', { name: /assistant is typing/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /message/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /stop generating/i })).toBeInTheDocument()
    })

    it('STREAMING: shows the answer growing token by token, before the stream ends', async () => {
      const service = fakeService()
      const channel = liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)
      await send(user, 'Which approval is first?')

      channel.push({ type: 'token', text: 'Safety' })
      expect(await screen.findByText('Safety')).toBeInTheDocument()
      expect(screen.queryByRole('status', { name: /assistant is typing/i })).not.toBeInTheDocument()

      channel.push({ type: 'token', text: ' specs first' })
      expect(await screen.findByText('Safety specs first')).toBeInTheDocument()
      // still streaming: the stream has not been closed yet
      expect(screen.getByRole('button', { name: /stop generating/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /message/i })).toBeDisabled()

      channel.push({ type: 'done' })
      await waitFor(() => expect(screen.getByRole('textbox', { name: /message/i })).toBeEnabled())
      expect(screen.queryByRole('button', { name: /stop generating/i })).not.toBeInTheDocument()
      expect(screen.getByText('Safety specs first')).toBeInTheDocument()
    })

    it('ERROR: a server error event shows a friendly alert and keeps the partial answer', async () => {
      const service = fakeService()
      const channel = liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)
      await send(user, 'Hi')

      channel.push({ type: 'token', text: 'Partial answer' })
      channel.push({ type: 'error', message: "Sorry, I couldn't get a response right now. Please try again in a moment." })

      expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't get a response/i)
      expect(screen.getByText('Partial answer')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /message/i })).toBeEnabled()
    })

    it('ERROR: an unreachable server shows a friendly alert, never a raw error', async () => {
      const service = fakeService()
      service.streamChat.mockImplementation(() => {
        throw new ApiError('network', { detail: 'ECONNREFUSED 127.0.0.1:4000' })
      })
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)

      await send(user, 'Hi')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/reach the server/i)
      expect(alert).not.toHaveTextContent(/ECONNREFUSED|127\.0\.0\.1/)
    })

    it('ERROR: a rate limit tells the user how long to wait', async () => {
      const service = fakeService()
      service.streamChat.mockImplementation(() => {
        throw new ApiError('rate_limited', { retryAfterSeconds: 42 })
      })
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)

      await send(user, 'Hi')

      expect(await screen.findByRole('alert')).toHaveTextContent(/42 seconds/i)
    })

    it('RETRY: Try again asks the same question and recovers', async () => {
      const service = fakeService()
      const failing = liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)
      await send(user, 'Which is first?')
      failing.push({ type: 'error', message: 'Something went wrong.' })
      await screen.findByRole('alert')

      const working = liveStream(service)
      await user.click(screen.getByRole('button', { name: /try again/i }))
      working.push({ type: 'token', text: 'Safety specs.' })
      working.push({ type: 'done' })

      expect(await screen.findByText('Safety specs.')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getAllByText('Which is first?')).toHaveLength(1) // not duplicated
    })

    it('STOP: stops the answer and keeps what arrived, without an error', async () => {
      const service = fakeService()
      const channel = liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)
      await send(user, 'Hi')
      channel.push({ type: 'token', text: 'Half an' })
      await screen.findByText('Half an')

      await user.click(screen.getByRole('button', { name: /stop generating/i }))

      await waitFor(() => expect(screen.getByRole('textbox', { name: /message/i })).toBeEnabled())
      expect(screen.getByText('Half an')).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not send an empty message', async () => {
      const service = fakeService()
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)

      await user.type(screen.getByRole('textbox', { name: /message/i }), '   {Enter}')

      expect(service.streamChat).not.toHaveBeenCalled()
    })

    it('offers a starter question', async () => {
      const service = fakeService()
      liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)

      await user.click(screen.getByRole('button', { name: /which approval needs my attention first/i }))

      await waitFor(() => expect(service.streamChat).toHaveBeenCalledTimes(1))
    })

    it('renders model text safely: bold is formatted, HTML is shown as plain text', async () => {
      const service = fakeService()
      const channel = liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /talk to me/i)
      await send(user, 'Hi')

      channel.push({ type: 'token', text: 'Start with **Safety Specs** <img src=x onerror=alert(1)>' })
      channel.push({ type: 'done' })

      const strong = await screen.findByText('Safety Specs')
      expect(strong.tagName).toBe('STRONG')
      expect(document.querySelector('img')).toBeNull()
      expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument()
    })
  })

  describe('Teach me', () => {
    it('keeps the conversation, so a follow-up can adapt', async () => {
      const service = fakeService()
      const first = liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /teach me/i)

      await send(user, 'How do I review a PDF?')
      first.push({ type: 'token', text: '1. Open it. 2. Check the pages.' })
      first.push({ type: 'done' })
      await screen.findByText(/check the pages/i)

      const second = liveStream(service)
      await send(user, 'Explain step 2 simpler')
      second.push({ type: 'done' })

      await waitFor(() => expect(service.streamChat).toHaveBeenCalledTimes(2))
      const [request] = service.streamChat.mock.calls[1] as [{ mode: string; messages: unknown[] }]
      expect(request.mode).toBe('teach')
      expect(request.messages).toEqual([
        { role: 'user', content: 'How do I review a PDF?' },
        { role: 'assistant', content: '1. Open it. 2. Check the pages.' },
        { role: 'user', content: 'Explain step 2 simpler' },
      ])
    })

    it('keeps Teach and Talk conversations separate', async () => {
      const service = fakeService()
      const channel = liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /teach me/i)
      await send(user, 'Teaching question')
      channel.push({ type: 'done' })
      await screen.findByText('Teaching question')

      await user.click(screen.getByRole('button', { name: /back/i }))
      await openChat(user, /talk to me/i)

      expect(screen.queryByText('Teaching question')).not.toBeInTheDocument()
    })

    it('starts a new conversation on request', async () => {
      const service = fakeService()
      const channel = liveStream(service)
      const { user } = renderPanel(service)
      await openChat(user, /teach me/i)
      await send(user, 'Old question')
      channel.push({ type: 'done' })
      await screen.findByText('Old question')

      await user.click(screen.getByRole('button', { name: /new conversation/i }))

      expect(screen.queryByText('Old question')).not.toBeInTheDocument()
    })
  })
})
