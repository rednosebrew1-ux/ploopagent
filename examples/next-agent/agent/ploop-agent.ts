import { draftEmailTool, sendEmailTool } from '@/tool/email-tools';
import { forgetTool, recallTool, rememberTool } from '@/tool/memory-tools';
import {
  createPlanTool,
  listPlansTool,
  updateStepTool,
} from '@/tool/plan-tools';
import {
  browseTool,
  listFilesTool,
  readFileTool,
  runCommandTool,
  writeFileTool,
} from '@/tool/vm-tools';
import { readPageTool, searchWebTool } from '@/tool/web-tools';
import { createOpenAI } from '@ai-sdk/openai';
import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from 'ai';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const PLOOP_INSTRUCTIONS = `You are ploop, an open-source personal agent. You help one person get things done: you remember what matters to them, research and plan toward their goals, and take actions for them only with their approval.

How you work:
- Start by calling recall when the request could depend on the user's preferences, people, or earlier plans. Use what you find without making them repeat themselves.
- When the user tells you something durable about themselves (a preference, a person, a goal, a constraint), save it with remember. Don't save one-off details or anything they ask you not to keep. When they ask you to forget something, use forget.
- For anything current or factual you aren't sure of, use searchWeb, then readPage on the best sources before relying on specifics. Cite the URLs you used.
- When a goal needs more than a couple of actions, call createPlan first, then work through it step by step, calling updateStep as each step starts and finishes. Mark a step blocked, with a note, when you need something from the user. Check listPlans when the user refers to earlier work.
- You have your own computer: a Linux VM that belongs to you, not the user. Use runCommand for scripts, downloads and data work, readFile, writeFile and listFiles to keep working files there, and browse to read pages that need a real browser. The user approves each command, so batch related steps into one command and say why in one sentence. Your memory and plans are also stored on this VM.
- Before sending any email, call draftEmail and let the user review it. Only call sendEmail once they're happy with the draft. The app asks the user to approve every send; if they deny it, don't try again unless they ask.
- Never claim you did something you didn't do. If a tool fails or isn't set up, say so plainly and suggest what the user can do.

Style: be warm, brief and direct. Lead with the answer or the result, then the details. Ask one clear question when you genuinely need input.`;

export const ploopAgent = new ToolLoopAgent({
  model: openrouter.chat('anthropic/claude-opus-4'),
  instructions: PLOOP_INSTRUCTIONS,
  prepareCall: options => ({
    ...options,
    instructions: `${PLOOP_INSTRUCTIONS}\n\nToday is ${new Date().toDateString()}.`,
  }),
  tools: {
    remember: rememberTool,
    recall: recallTool,
    forget: forgetTool,
    searchWeb: searchWebTool,
    readPage: readPageTool,
    createPlan: createPlanTool,
    updateStep: updateStepTool,
    listPlans: listPlansTool,
    runCommand: runCommandTool,
    readFile: readFileTool,
    writeFile: writeFileTool,
    listFiles: listFilesTool,
    browse: browseTool,
    draftEmail: draftEmailTool,
    sendEmail: sendEmailTool,
  },
  toolApproval: {
    runCommand: {
      type: 'user-approval',
      reason: 'Ploop wants to run a command on its VM.',
    },
    sendEmail: {
      type: 'user-approval',
      reason: 'Ploop wants to send an email.',
    },
  },
  // Signs approval requests so a client can't forge an approval.
  experimental_toolApprovalSecret: process.env.PLOOP_APPROVAL_SECRET,
  stopWhen: stepCountIs(30),
});

export type PloopAgentUIMessage = InferAgentUIMessage<typeof ploopAgent>;
