'use client';

import { useCallback, useEffect, useState } from 'react';

type KeyName = 'openrouterApiKey' | 'tavilyApiKey' | 'resendApiKey';

const KEYS: Array<{ name: KeyName; label: string; help: string }> = [
  {
    name: 'openrouterApiKey',
    label: 'OpenRouter API key',
    help: 'Required. ploop thinks through OpenRouter.',
  },
  {
    name: 'tavilyApiKey',
    label: 'Tavily API key',
    help: 'Optional. Lets ploop search the web.',
  },
  {
    name: 'resendApiKey',
    label: 'Resend API key',
    help: 'Optional. Lets ploop send email after you approve it.',
  },
];

const inputClass =
  'w-full p-2 bg-white border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink';

export default function KeysSection({ api }: { api: PloopDesktopApi }) {
  const [status, setStatus] = useState<PloopSettingsStatus>();
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [fromEmail, setFromEmail] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api.settings.status();
      setStatus(next);
      setFromEmail(next.fromEmail);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not read the settings.',
      );
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: PloopSettingsPatch) {
    setSaving(true);
    setError(undefined);
    try {
      await api.settings.save(patch);
      setTyped({});
      setMessage('Saved. ploop is restarting to use it.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <section id="keys" aria-labelledby="keys-heading" className="scroll-mt-8">
      <h2 id="keys-heading" className="mb-3 text-lg font-semibold">
        Keys
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Stored encrypted on this Mac, next to the vault.
      </p>

      {status === undefined && !error && (
        <p className="text-sm text-gray-600">Loading…</p>
      )}

      {status && (
        <form
          className="space-y-4 text-sm"
          onSubmit={event => {
            event.preventDefault();
            const patch: PloopSettingsPatch = {};
            for (const { name } of KEYS) {
              if (typed[name]?.trim()) patch[name] = typed[name];
            }
            if (fromEmail !== status.fromEmail) patch.fromEmail = fromEmail;
            if (Object.keys(patch).length === 0) {
              setMessage('Nothing to save yet.');
              return;
            }
            void save(patch);
          }}
        >
          {KEYS.map(({ name, label, help }) => (
            <div key={name}>
              <label className="block">
                <span className="block mb-1 font-medium">
                  {label}{' '}
                  <span className="font-normal text-gray-600">
                    {status[name] ? '(saved)' : '(not set)'}
                  </span>
                </span>
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="new-password"
                  placeholder={
                    status[name]
                      ? 'Paste a new key to replace it'
                      : 'Paste your key'
                  }
                  value={typed[name] ?? ''}
                  onChange={event =>
                    setTyped(current => ({
                      ...current,
                      [name]: event.target.value,
                    }))
                  }
                />
              </label>
              <span className="block mt-1 text-gray-600">
                {help}
                {status[name] && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      disabled={saving}
                      onClick={() => void save({ [name]: '' })}
                    >
                      Remove
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}

          <label className="block">
            <span className="block mb-1 font-medium">
              Sender address for email
            </span>
            <input
              className={inputClass}
              type="email"
              autoComplete="off"
              placeholder="ploop@yourdomain.com"
              value={fromEmail}
              onChange={event => setFromEmail(event.target.value)}
            />
            <span className="block mt-1 text-gray-600">
              Optional. Must be on a domain you verified with Resend.
            </span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1 font-medium text-white rounded-full bg-ink hover:bg-lagoon-deep disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save keys'}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-gray-700">
          {message}
        </p>
      )}
    </section>
  );
}
