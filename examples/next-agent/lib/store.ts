import { safeParseJSON } from '@ai-sdk/provider-utils';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { getVm, hasVercelVm, type PloopVm } from './vm';

// Ploop keeps its memory and plans as JSON files: on its VM's disk when it
// has a Vercel VM, otherwise in PLOOP_DATA_DIR (default ./.ploop).
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
  const text = await readData(`${name}.json`);
  if (text == null) return [];

  const result = await safeParseJSON({ text, schema });
  return result.success ? result.value : [];
}

async function writeCollection<T>(name: string, items: T[]) {
  await writeData(`${name}.json`, JSON.stringify(items, null, 2));
}

// When ploop has its Vercel VM, its data lives on the VM's persistent disk.
// Otherwise (local development) it lives in PLOOP_DATA_DIR on this machine.
async function readData(file: string): Promise<string | null> {
  if (hasVercelVm()) {
    const vm = await getVm();
    return vm.session.readTextFile({ path: vmDataPath(vm, file) });
  }

  try {
    return await readFile(path.join(dataDir, file), 'utf8');
  } catch {
    return null;
  }
}

async function writeData(file: string, content: string) {
  if (hasVercelVm()) {
    const vm = await getVm();
    await vm.session.writeTextFile({ path: vmDataPath(vm, file), content });
    return;
  }

  await mkdir(dataDir, { recursive: true });
  const target = path.join(dataDir, file);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, target);
}

function vmDataPath(vm: PloopVm, file: string) {
  return path.posix.join(vm.workspace, '.ploop', file);
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
