import type { PloopAgentUIMessage } from '@/agent/ploop-agent';

type ToolPart = Extract<
  PloopAgentUIMessage['parts'][number],
  { type: `tool-${string}` }
>;

export const LABELS: Record<string, string> = {
  remember: 'Remembering',
  recall: 'Checking memory',
  forget: 'Forgetting',
  searchWeb: 'Searching the web',
  readPage: 'Reading a page',
  createPlan: 'Making a plan',
  updateStep: 'Updating the plan',
  listPlans: 'Checking plans',
  runCommand: 'Running a command',
  readFile: 'Reading a file',
  writeFile: 'Writing a file',
  listFiles: 'Listing files',
  browse: 'Browsing',
  listLogins: 'Checking the vault',
  loginToSite: 'Signing in',
  readSitePage: 'Reading a signed-in page',
  draftEmail: 'Drafting an email',
  sendEmail: 'Sending an email',
};

export default function ToolView({
  part,
  onApproval,
}: {
  part: ToolPart;
  onApproval: (id: string, approved: boolean) => void;
}) {
  const name = part.type.slice('tool-'.length);
  const label = LABELS[name] ?? name;

  if (part.state === 'output-error') {
    return (
      <div className="text-sm text-red-700">
        {label} failed: {part.errorText}
      </div>
    );
  }

  if (part.state === 'output-denied') {
    return <div className="text-sm text-gray-500">{label}: you declined.</div>;
  }

  switch (part.type) {
    case 'tool-draftEmail':
    case 'tool-sendEmail': {
      if (!part.input) {
        return <div className="text-sm text-gray-500">{label}…</div>;
      }
      const email = part.input;
      return (
        <div className="p-3 my-2 text-sm bg-white border border-gray-300 border-l-4 border-l-lagoon rounded-xl">
          <div className="mb-1 font-medium">
            {part.type === 'tool-draftEmail' ? 'Draft email' : 'Email'}
          </div>
          <div>
            <span className="text-gray-500">To:</span> {email.to?.join(', ')}
          </div>
          <div>
            <span className="text-gray-500">Subject:</span> {email.subject}
          </div>
          <div className="mt-2 whitespace-pre-wrap">{email.body}</div>

          {part.state === 'approval-requested' && (
            <div className="flex gap-2 mt-3">
              <button
                className="px-4 py-1 font-medium text-white rounded-full bg-ink hover:bg-lagoon-deep"
                onClick={() => onApproval(part.approval.id, true)}
              >
                Approve and send
              </button>
              <button
                className="px-4 py-1 bg-white border border-gray-400 rounded-full hover:bg-blush-deep"
                onClick={() => onApproval(part.approval.id, false)}
              >
                Don’t send
              </button>
            </div>
          )}
          {part.state === 'approval-responded' && (
            <div className="mt-2 text-gray-500">
              {part.approval.approved ? 'Approved, sending…' : 'Declined.'}
            </div>
          )}
          {part.type === 'tool-sendEmail' &&
            part.state === 'output-available' && (
              <div className="mt-2 text-green-700">Sent.</div>
            )}
        </div>
      );
    }

    case 'tool-runCommand': {
      if (!part.input) {
        return <div className="text-sm text-gray-500">{label}…</div>;
      }
      return (
        <div className="p-3 my-2 text-sm bg-white border border-gray-300 border-l-4 border-l-lagoon rounded-xl">
          <div className="mb-1 text-gray-500">{part.input.why}</div>
          <pre className="p-2 overflow-x-auto bg-gray-100 rounded">
            $ {part.input.command}
          </pre>

          {part.state === 'approval-requested' && (
            <div className="flex gap-2 mt-3">
              <button
                className="px-4 py-1 font-medium text-white rounded-full bg-ink hover:bg-lagoon-deep"
                onClick={() => onApproval(part.approval.id, true)}
              >
                Run it
              </button>
              <button
                className="px-4 py-1 bg-white border border-gray-400 rounded-full hover:bg-blush-deep"
                onClick={() => onApproval(part.approval.id, false)}
              >
                Don’t run
              </button>
            </div>
          )}
          {part.state === 'approval-responded' && (
            <div className="mt-2 text-gray-500">
              {part.approval.approved ? 'Approved, running…' : 'Declined.'}
            </div>
          )}
          {part.state === 'output-available' && (
            <details className="mt-2">
              <summary className="text-gray-500">
                Exit code {part.output.exitCode}
              </summary>
              <pre className="p-2 overflow-x-auto bg-gray-100 rounded whitespace-pre-wrap">
                {part.output.stdout || part.output.stderr || '(no output)'}
              </pre>
            </details>
          )}
        </div>
      );
    }

    case 'tool-loginToSite': {
      if (!part.input) {
        return <div className="text-sm text-gray-500">{label}…</div>;
      }
      return (
        <div className="p-3 my-2 text-sm bg-white border border-gray-300 border-l-4 border-l-lagoon rounded-xl">
          <div className="mb-1 font-medium">Sign in to {part.input.site}</div>
          <div>
            <span className="text-gray-500">As:</span> {part.input.username}
          </div>
          {part.input.why && (
            <div className="mt-1 text-gray-500">{part.input.why}</div>
          )}

          {part.state === 'approval-requested' && (
            <div className="flex gap-2 mt-3">
              <button
                className="px-4 py-1 font-medium text-white rounded-full bg-ink hover:bg-lagoon-deep"
                onClick={() => onApproval(part.approval.id, true)}
              >
                Sign in
              </button>
              <button
                className="px-4 py-1 bg-white border border-gray-400 rounded-full hover:bg-blush-deep"
                onClick={() => onApproval(part.approval.id, false)}
              >
                Don’t sign in
              </button>
            </div>
          )}
          {part.state === 'approval-responded' && (
            <div className="mt-2 text-gray-500">
              {part.approval.approved ? 'Approved, signing in…' : 'Declined.'}
            </div>
          )}
          {part.state === 'output-available' && (
            <div
              className={
                part.output.status === 'needs-attention' ||
                part.output.status === 'failed'
                  ? 'mt-2 text-amber-800'
                  : 'mt-2 text-green-700'
              }
            >
              {part.output.note}
            </div>
          )}
        </div>
      );
    }

    case 'tool-readSitePage':
      if (part.state === 'output-available') {
        return (
          <div className="my-1 text-sm text-gray-500">
            Read signed-in page{' '}
            <a
              className="underline"
              href={part.output.url}
              target="_blank"
              rel="noreferrer"
            >
              {part.output.title || part.output.url}
            </a>
          </div>
        );
      }
      break;

    case 'tool-browse':
      if (part.state === 'output-available') {
        return (
          <div className="my-1 text-sm text-gray-500">
            Browsed{' '}
            <a
              className="underline"
              href={part.output.url}
              target="_blank"
              rel="noreferrer"
            >
              {part.output.title || part.output.url}
            </a>
          </div>
        );
      }
      break;

    case 'tool-searchWeb':
      if (part.state === 'output-available') {
        return (
          <details className="my-1 text-sm text-gray-500">
            <summary>
              Searched “{part.input.query}” ({part.output.results.length}{' '}
              results)
            </summary>
            <ul className="pl-4 list-disc">
              {part.output.results.map(result => (
                <li key={result.url}>
                  <a
                    className="underline"
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {result.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        );
      }
      break;

    case 'tool-readPage':
      if (part.state === 'output-available') {
        return (
          <div className="my-1 text-sm text-gray-500">
            Read{' '}
            <a
              className="underline"
              href={part.output.url}
              target="_blank"
              rel="noreferrer"
            >
              {part.output.title || part.output.url}
            </a>
          </div>
        );
      }
      break;

    case 'tool-remember':
      if (part.state === 'output-available') {
        return (
          <div className="my-1 text-sm text-gray-500">
            Remembered: {part.output.fact}
          </div>
        );
      }
      break;
  }

  return (
    <div className="my-1 text-sm text-gray-500">
      {label}
      {part.state === 'output-available' ? '' : '…'}
    </div>
  );
}
