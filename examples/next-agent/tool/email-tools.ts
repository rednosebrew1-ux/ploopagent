import { tool } from 'ai';
import { z } from 'zod';

const emailSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string(),
  body: z.string().describe('Plain-text email body.'),
});

export const draftEmailTool = tool({
  description:
    'Show the user an email draft to review. Always draft first and let the user ask for changes before calling sendEmail.',
  inputSchema: emailSchema,
  async execute(email) {
    return { ...email, status: 'draft' as const };
  },
});

// Ploop's agent config requires user approval before this tool runs.
export const sendEmailTool = tool({
  description:
    'Send an email from the user’s ploop address. The user must approve every send; if they deny it, do not retry unless they ask.',
  inputSchema: emailSchema,
  async execute({ to, subject, body }, { abortSignal }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.PLOOP_FROM_EMAIL;
    if (!apiKey || !from) {
      throw new Error(
        'Email is not set up: RESEND_API_KEY and PLOOP_FROM_EMAIL are required.',
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, text: body }),
      signal: abortSignal,
    });

    if (!response.ok) {
      throw new Error(`Sending failed with status ${response.status}.`);
    }

    return { status: 'sent' as const, to, subject };
  },
});
