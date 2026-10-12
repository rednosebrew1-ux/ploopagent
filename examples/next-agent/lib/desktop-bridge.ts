import { safeParseJSON } from '@ai-sdk/provider-utils';
import http from 'node:http';
import { z } from 'zod';

// In the ploop desktop app, this server runs next to the vault. The app hands
// it a private Unix socket and a token, and that socket is the only way to the
// vault: it can list logins (no passwords), sign in, and read pages after
// signing in. Passwords never cross it. Outside the app there is no socket.
export function hasDesktopBridge() {
  return Boolean(
    process.env.PLOOP_BRIDGE_SOCKET && process.env.PLOOP_BRIDGE_TOKEN,
  );
}

const errorSchema = z.object({ error: z.string() });

export async function bridgeRequest<T>({
  method,
  path,
  body,
  schema,
  abortSignal,
}: {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  schema: z.ZodType<T>;
  abortSignal?: AbortSignal;
}): Promise<T> {
  const socketPath = process.env.PLOOP_BRIDGE_SOCKET;
  const token = process.env.PLOOP_BRIDGE_TOKEN;
  if (!socketPath || !token) {
    throw new Error(
      'The vault is only available in the ploop desktop app. Ask the user to open ploop there.',
    );
  }

  const { status, text } = await new Promise<{ status: number; text: string }>(
    (resolve, reject) => {
      const request = http.request(
        {
          socketPath,
          path,
          method,
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          signal: abortSignal,
          // Signing in can wait on a slow page or on the user.
          timeout: 120_000,
        },
        response => {
          let received = '';
          response.setEncoding('utf8');
          response.on('data', chunk => (received += chunk));
          response.on('end', () =>
            resolve({ status: response.statusCode ?? 0, text: received }),
          );
        },
      );
      request.on('timeout', () =>
        request.destroy(new Error('The vault took too long to answer.')),
      );
      request.on('error', reject);
      request.end(body === undefined ? undefined : JSON.stringify(body));
    },
  );

  if (status >= 400) {
    const failure = await safeParseJSON({ text, schema: errorSchema });
    throw new Error(
      failure.success ? failure.value.error : 'The vault could not do that.',
    );
  }

  const parsed = await safeParseJSON({ text, schema });
  if (!parsed.success) {
    throw new Error('The vault sent an unexpected answer.');
  }
  return parsed.value;
}
