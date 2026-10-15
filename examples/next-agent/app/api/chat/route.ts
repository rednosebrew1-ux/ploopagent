import { ploopAgent } from '@/agent/ploop-agent';
import { APICallError, createAgentUIStreamResponse } from 'ai';

export const dynamic = 'force-dynamic';

// Turns a failure into a sentence the person can act on. The text goes to the
// chat window, so it never includes the key or the raw provider response.
export function describeChatError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === 401 || status === 403) {
      return 'OpenRouter didn’t accept the API key. Check it under Vault > Keys.';
    }
    if (status === 402) {
      return 'OpenRouter says the account is out of credits. Add credits at openrouter.ai, or pick a free model.';
    }
    if (status === 404) {
      return 'OpenRouter doesn’t have that model, or it isn’t available to your account.';
    }
    if (status === 429) {
      return 'OpenRouter is rate limiting this key. Wait a moment and try again.';
    }
    if (status != null && status >= 500) {
      return 'OpenRouter had a problem on its side. Try again in a moment.';
    }
    return `OpenRouter returned an error${status ? ` (${status})` : ''}.`;
  }
  if (
    error instanceof Error &&
    /ECONNREFUSED|ENOTFOUND|fetch failed/i.test(error.message)
  ) {
    return 'ploop couldn’t reach OpenRouter. Check your internet connection.';
  }
  return error instanceof Error && error.message
    ? error.message
    : 'Something went wrong.';
}

export async function POST(request: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      {
        error:
          'ploop needs an OpenRouter API key before it can think. Add one under Vault > Keys.',
      },
      { status: 400 },
    );
  }

  const { messages } = await request.json();

  return createAgentUIStreamResponse({
    agent: ploopAgent,
    uiMessages: messages,
    onError: describeChatError,
  });
}
