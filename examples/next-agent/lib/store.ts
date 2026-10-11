import { safeParseJSON } from '@ai-sdk/provider-utils';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

// Ploop keeps its memory and plans in JSON files on the server.
// Set PLOOP_DATA_DIR to move them (for example to /tmp on serverless hosts).
const dataDir =
  process.env.PLOOP_DATA_DIR ?? path.join(process.cwd(), '.ploop');

export const memorySchema = z.object({
  id: z.string(),
  fact: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
});

export type Memory = z.infer<typeof memorySchema>;

export const stepStatusSchema = z.enum([
  'pending',
  'in-progress',
  'done',
  'blocked',
  'skipped',
]);

export const planSchema = z.object({
  id: z.string(),
  goal: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  steps: z.array(
    z.object({
      title: z.string(),
      status: stepStatusSchema,
      note: z.string().optional(),
    }),
  ),
});

export type Plan = z.infer<typeof planSchema>;

const memoriesSchema = z.array(memorySchema);
const plansSchema = z.array(planSchema);

async function readCollection<T>(
  name: string,
  schema: z.ZodType<T[]>,
): Promise<T[]> {
  let text: string;
  try {
    text = await readFile(path.join(dataDir, `${name}.json`), 'utf8');
  } catch {
    return [];
  }

  const result = await safeParseJSON({ text, schema });
  return result.success ? result.value : [];
}

async function writeCollection<T>(name: string, items: T[]) {
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, `${name}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(items, null, 2));
  await rename(tmp, file);
}

// Serialize writes so two tool calls in one step don't overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

export const memories = {
  list: () => readCollection('memories', memoriesSchema),
  update: <R>(fn: (items: Memory[]) => { items: Memory[]; result: R }) =>
    serialized(async () => {
      const { items, result } = fn(
        await readCollection('memories', memoriesSchema),
      );
      await writeCollection('memories', items);
      return result;
    }),
};

export const plans = {
  list: () => readCollection('plans', plansSchema),
  update: <R>(fn: (items: Plan[]) => { items: Plan[]; result: R }) =>
    serialized(async () => {
      const { items, result } = fn(await readCollection('plans', plansSchema));
      await writeCollection('plans', items);
      return result;
    }),
};

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
