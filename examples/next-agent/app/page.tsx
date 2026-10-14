'use client';

import type { PloopAgentUIMessage } from '@/agent/ploop-agent';
import BrandHeader from '@/component/brand-header';
import ChatInput from '@/component/chat-input';
import PlanPanel from '@/component/plan-panel';
import ToolView, { LABELS } from '@/component/tool-view';
import TypingIndicator from '@/component/typing-indicator';
import { useChat } from '@ai-sdk/react';
import {
  isStaticToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

// A failed request carries the server's JSON body as the error text.
function readableError(error: Error) {
  try {
    const body = JSON.parse(error.message);
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // Not JSON: use the message as it is.
  }
  return error.message || 'Something went wrong.';
}

// What ploop is doing right now, in words, or undefined when it is idle.
function workingLabel(
  status: string,
  messages: PloopAgentUIMessage[],
): string | undefined {
  if (status !== 'submitted' && status !== 'streaming') return undefined;

  const last = messages.at(-1);
  if (last?.role !== 'assistant') return 'ploop is thinking…';

  const tail = last.parts.at(-1);
  if (tail && isStaticToolUIPart(tail)) {
    const running =
      tail.state === 'input-streaming' || tail.state === 'input-available';
    if (running) {
      const name = tail.type.slice('tool-'.length);
      return `${LABELS[name] ?? 'Working'}…`;
    }
    return 'ploop is thinking…';
  }
  // Words are already appearing, so the text itself shows progress.
  return tail?.type === 'text' && tail.text !== ''
    ? undefined
    : 'ploop is thinking…';
}

export default function Chat() {
  const {
    status,
    sendMessage,
    messages,
    addToolApprovalResponse,
    stop,
    error,
    clearError,
    regenerate,
  } = useChat<PloopAgentUIMessage>({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  return (
    <div className="flex flex-col gap-8 px-4 py-12 mx-auto max-w-5xl md:flex-row">
      <main className="flex-1 pb-32 min-w-0">
        <BrandHeader action={{ href: '/vault', label: 'Vault' }} />

        {messages.length === 0 && (
          <p className="text-gray-500">
            Tell ploop about yourself, ask it to research something, or give it
            a goal to plan.
          </p>
        )}

        {messages.map(message => (
          <div key={message.id} className="mb-6">
            <strong
              className={
                message.role === 'user' ? 'text-ink' : 'text-lagoon-deep'
              }
            >
              {message.role === 'user' ? 'You' : 'ploop'}
            </strong>
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <div key={index} className="space-y-2">
                    <ReactMarkdown>{part.text}</ReactMarkdown>
                  </div>
                );
              }

              if (isStaticToolUIPart(part)) {
                return (
                  <ToolView
                    key={index}
                    part={part}
                    onApproval={(id, approved) =>
                      addToolApprovalResponse({ id, approved })
                    }
                  />
                );
              }

              return null;
            })}
          </div>
        ))}

        {(() => {
          const label = workingLabel(status, messages);
          return label ? <TypingIndicator label={label} /> : null;
        })()}

        {error && (
          <div
            role="alert"
            className="p-3 mb-6 text-sm text-red-800 bg-white border border-red-300 rounded-xl"
          >
            <p>{readableError(error)}</p>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
              >
                Try again
              </button>
              <Link
                href="/vault#keys"
                className="font-medium underline underline-offset-2"
              >
                Open Vault
              </Link>
            </div>
          </div>
        )}

        <ChatInput
          status={status}
          stop={stop}
          onSubmit={text => sendMessage({ text })}
        />
      </main>

      <PlanPanel refreshKey={`${messages.length}:${status}`} />
    </div>
  );
}
