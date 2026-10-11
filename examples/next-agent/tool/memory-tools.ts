import { memories, newId } from '@/lib/store';
import { tool } from 'ai';
import { z } from 'zod';

export const rememberTool = tool({
  description:
    'Save a durable fact about the user (a preference, a person, a goal, a constraint) so it is available in future conversations. Save one fact per call.',
  inputSchema: z.object({
    fact: z
      .string()
      .describe('The fact, written so it makes sense on its own later.'),
    tags: z
      .array(z.string())
      .optional()
      .describe('A few short lowercase tags, e.g. ["food", "family"].'),
  }),
  async execute({ fact, tags }) {
    const memory = {
      id: newId('mem'),
      fact,
      tags: tags ?? [],
      createdAt: new Date().toISOString(),
    };
    await memories.update(items => ({
      items: [...items, memory],
      result: undefined,
    }));
    return memory;
  },
});

export const recallTool = tool({
  description:
    'Look up saved facts about the user. Call this at the start of any request where their preferences, people or past plans could matter. Leave query empty to list everything.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe('Keywords to match against saved facts and tags.'),
  }),
  async execute({ query }) {
    const all = await memories.list();
    const words = (query ?? '')
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2);

    if (words.length === 0) {
      return { memories: all };
    }

    const matches = all.filter(memory => {
      const haystack = `${memory.fact} ${memory.tags.join(' ')}`.toLowerCase();
      return words.some(word => haystack.includes(word));
    });

    return { memories: matches };
  },
});

export const forgetTool = tool({
  description:
    'Delete a saved fact when the user asks you to forget it or it is no longer true.',
  inputSchema: z.object({
    id: z.string().describe('The id of the memory, from recall.'),
  }),
  async execute({ id }) {
    const removed = await memories.update(items => ({
      items: items.filter(memory => memory.id !== id),
      result: items.some(memory => memory.id === id),
    }));
    return { removed };
  },
});
