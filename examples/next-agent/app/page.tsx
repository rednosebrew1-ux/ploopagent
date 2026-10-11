'use client';

import type { PloopAgentUIMessage } from '@/agent/ploop-agent';
import ChatInput from '@/component/chat-input';
import PlanPanel from '@/component/plan-panel';
import ToolView from '@/component/tool-view';
import { useChat } from '@ai-sdk/react';
import {
  isStaticToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import ReactMarkdown from 'react-markdown';

export default function Chat() {
  const { status, sendMessage, messages, addToolApprovalResponse, stop } =
    useChat<PloopAgentUIMessage>({
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  return (
    <div className="flex flex-col gap-8 px-4 py-12 mx-auto max-w-5xl md:flex-row">
      <main className="flex-1 pb-32 min-w-0">
        <h1 className="mb-6 text-xl font-semibold">ploop</h1>

        {messages.length === 0 && (
          <p className="text-gray-500">
            Tell ploop about yourself, ask it to research something, or give it
            a goal to plan.
          </p>
        )}

        {messages.map(message => (
          <div key={message.id} className="mb-6">
            <strong>{message.role === 'user' ? 'You' : 'ploop'}</strong>
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
