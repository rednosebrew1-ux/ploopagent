# ploop

An open-source personal AI agent, in the spirit of Meta's Muse and ChatGPT Dots. Ploop remembers what matters to you, researches and plans toward your goals, and takes actions for you only after you approve them.

## What it can do

| Tool                                                  | What it does                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `remember` / `recall` / `forget`                      | Long-term memory of your preferences, people and goals, kept between chats.                      |
| `searchWeb` / `readPage`                              | Web research with sources (Tavily search, plus reading public pages).                            |
| `createPlan` / `updateStep` / `listPlans`             | Breaks a goal into steps and tracks progress in the side panel.                                  |
| `runCommand` / `readFile` / `writeFile` / `listFiles` | Works on ploop's own VM. Every command needs your **Run it** click.                              |
| `browse`                                              | Reads pages in a headless Chromium on the VM (set up on first use).                              |
| `draftEmail` / `sendEmail`                            | Drafts email for review; every send needs your **Approve and send** click (sent through Resend). |

The agent lives in `agent/ploop-agent.ts`, its tools in `tool/`, its VM in `lib/vm.ts`, and storage in `lib/store.ts`.

## Ploop's VM

Like Muse and Dots, ploop has its own computer. With Vercel credentials it gets a persistent [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) microVM named `PLOOP_VM_NAME` (default `ploop-vm`). The VM stops when idle, and its disk is restored when ploop next uses it, so files, memory and plans survive between sessions.

To use it locally, link the app to a Vercel project and pull its credentials:

```bash
vercel link
vercel env pull   # writes VERCEL_OIDC_TOKEN to .env.local
```

Without Vercel credentials, ploop falls back to an in-memory `just-bash` sandbox. That sandbox has no browser and is lost on restart, so memory and plans stay in `.ploop/` on your machine instead.

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

Memory and plans are JSON files. They live on the VM's disk when ploop has its Vercel VM, and in `.ploop/` (or `PLOOP_DATA_DIR`) otherwise.

## Not yet

Background runs on a schedule, connecting your own apps (Gmail, Calendar and more) through MCP, and clicking or typing in the browser.
