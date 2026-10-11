# ploop

An open-source personal AI agent, in the spirit of Meta's Muse and ChatGPT Dots. Ploop remembers what matters to you, researches and plans toward your goals, and takes actions for you only after you approve them.

## What it can do

| Tool                                      | What it does                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `remember` / `recall` / `forget`          | Long-term memory of your preferences, people and goals, kept between chats.                      |
| `searchWeb` / `readPage`                  | Web research with sources (Tavily search, plus reading public pages).                            |
| `createPlan` / `updateStep` / `listPlans` | Breaks a goal into steps and tracks progress in the side panel.                                  |
| `draftEmail` / `sendEmail`                | Drafts email for review; every send needs your **Approve and send** click (sent through Resend). |

The agent lives in `agent/ploop-agent.ts`, its tools in `tool/`, and storage in `lib/store.ts`.

## Run it

From the repository root:

```bash
pnpm install
pnpm build
```

Then in `examples/next-agent`:

```bash
cp .env.local.example .env.local   # fill in your keys
pnpm dev
```

Only `OPENROUTER_API_KEY` is required. Without `TAVILY_API_KEY` web search reports that it isn't set up, and without `RESEND_API_KEY` and `PLOOP_FROM_EMAIL` sending email does the same.

## Storage

Memory and plans are JSON files in `.ploop/` (or `PLOOP_DATA_DIR`). That's fine on your own machine. On serverless hosts such as Vercel the filesystem isn't persistent, so a database is the next step before deploying.

## Not yet

Background runs on a schedule, connecting your own apps (Gmail, Calendar and more) through MCP, and browser control.
