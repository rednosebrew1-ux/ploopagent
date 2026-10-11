import { safeParseJSON } from '@ai-sdk/provider-utils';
import { tool } from 'ai';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';

const tavilyResponseSchema = z.object({
  answer: z.string().nullish(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string().nullish(),
    }),
  ),
});

export const searchWebTool = tool({
  description:
    'Search the web for current information. Returns titles, URLs and snippets. Use readPage to read a result in full before relying on details.',
  inputSchema: z.object({
    query: z.string().describe('A focused search query.'),
    maxResults: z.number().int().min(1).max(10).optional(),
  }),
  async execute({ query, maxResults }, { abortSignal }) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('Web search is not set up: TAVILY_API_KEY is missing.');
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults ?? 5,
        include_answer: true,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Web search failed with status ${response.status}.`);
    }

    const parsed = await safeParseJSON({
      text: await response.text(),
      schema: tavilyResponseSchema,
    });
    if (!parsed.success) {
      throw new Error('Web search returned an unexpected response.');
    }

    return {
      answer: parsed.value.answer ?? undefined,
      results: parsed.value.results.map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.content?.slice(0, 500) ?? '',
      })),
    };
  },
});

const MAX_PAGE_CHARS = 12_000;
const MAX_REDIRECTS = 3;

export const readPageTool = tool({
  description:
    'Read the text of a public web page. Use it to check facts and gather details from search results.',
  inputSchema: z.object({
    url: z.string().url().describe('An http or https URL.'),
  }),
  async execute({ url }, { abortSignal }) {
    let current = new URL(url);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(current);

      const response = await fetch(current, {
        redirect: 'manual',
        headers: { 'user-agent': 'ploop-agent/0.1' },
        signal: abortSignal,
      });

      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) {
        throw new Error(`The page returned status ${response.status}.`);
      }

      const contentType = response.headers.get('content-type') ?? '';
      const body = await response.text();
      const text = contentType.includes('html') ? htmlToText(body) : body;

      return {
        url: current.toString(),
        title: body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim(),
        text: text.slice(0, MAX_PAGE_CHARS),
        truncated: text.length > MAX_PAGE_CHARS,
      };
    }

    throw new Error('The page redirected too many times.');
  },
});

// The server fetches the page, so refuse anything that points back into
// the server's own network (localhost, private ranges, cloud metadata).
async function assertPublicUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs can be read.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map(entry => entry.address);

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error('That address is not a public web page.');
  }
}

function isPrivateAddress(address: string) {
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address;

  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  const v6 = address.toLowerCase();
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe80')
  );
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}
