import { newId, plans, stepStatusSchema } from '@/lib/store';
import { tool } from 'ai';
import { z } from 'zod';

export const createPlanTool = tool({
  description:
    'Turn a goal that takes more than a couple of actions into a step-by-step plan. The plan is shown to the user in the side panel and kept between conversations.',
  inputSchema: z.object({
    goal: z.string().describe('The outcome the user wants, in their words.'),
    steps: z
      .array(z.string())
      .min(1)
      .max(12)
      .describe('Concrete steps in order, each a short imperative.'),
  }),
  async execute({ goal, steps }) {
    const now = new Date().toISOString();
    const plan = {
      id: newId('plan'),
      goal,
      createdAt: now,
      updatedAt: now,
      steps: steps.map(title => ({ title, status: 'pending' as const })),
    };
    await plans.update(items => ({
      items: [...items, plan],
      result: undefined,
    }));
    return plan;
  },
});

export const updateStepTool = tool({
  description:
    'Record progress on a plan step: mark it in-progress when you start it, done when finished, blocked when it needs the user, or skipped.',
  inputSchema: z.object({
    planId: z.string(),
    stepIndex: z.number().int().min(0).describe('Zero-based step index.'),
    status: stepStatusSchema,
    note: z
      .string()
      .optional()
      .describe('What happened, or what is needed from the user.'),
  }),
  async execute({ planId, stepIndex, status, note }) {
    return plans.update(items => {
      const plan = items.find(item => item.id === planId);
      const step = plan?.steps[stepIndex];
      if (!plan || !step) {
        throw new Error(`No step ${stepIndex} in plan ${planId}.`);
      }
      step.status = status;
      if (note !== undefined) step.note = note;
      plan.updatedAt = new Date().toISOString();
      return { items, result: plan };
    });
  },
});

export const listPlansTool = tool({
  description:
    'List the user’s plans and their progress. Use it to pick up earlier work.',
  inputSchema: z.object({
    includeFinished: z.boolean().optional(),
  }),
  async execute({ includeFinished }) {
    const all = await plans.list();
    return {
      plans: includeFinished
        ? all
        : all.filter(plan =>
            plan.steps.some(
              step => step.status !== 'done' && step.status !== 'skipped',
            ),
          ),
    };
  },
});
