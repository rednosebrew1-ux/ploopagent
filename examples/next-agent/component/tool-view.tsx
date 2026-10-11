import type { PloopAgentUIMessage } from '@/agent/ploop-agent';

type ToolPart = Extract<
  PloopAgentUIMessage['parts'][number],
  { type: `tool-${string}` }
>;

const LABELS: Record<string, string> = {
  remember: 'Remembering',
  recall: 'Checking memory',
  forget: 'Forgetting',
  searchWeb: 'Searching the web',
  readPage: 'Reading a page',
  createPlan: 'Making a plan',
  updateStep: 'Updating the plan',
  listPlans: 'Checking plans',
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
      <div className="text-sm text-red-600">
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
        <div className="p-3 my-2 text-sm border border-gray-300 rounded">
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
                className="px-3 py-1 text-white bg-black rounded"
                onClick={() => onApproval(part.approval.id, true)}
              >
                Approve and send
              </button>
              <button
                className="px-3 py-1 border border-gray-300 rounded"
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
