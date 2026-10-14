'use client';

import { useCallback, useEffect, useState } from 'react';

const inputClass =
  'w-full p-2 bg-white border border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink';

export default function ComputerSection({ api }: { api: PloopDesktopApi }) {
  const [status, setStatus] = useState<PloopSettingsStatus>();
  const [host, setHost] = useState('');
  const [user, setUser] = useState('');
  const [port, setPort] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api.settings.status();
      setStatus(next);
      setHost(next.sshHost);
      setUser(next.sshUser);
      setPort(next.sshPort);
      setKeyPath(next.sshKeyPath);
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

  async function save(patch: PloopSettingsPatch, done: string) {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await api.settings.save(patch);
      setMessage(done);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(undefined);
    setMessage('Connecting…');
    try {
      const response = await fetch('/api/vm', { method: 'POST' });
      const body = (await response.json()) as {
        ok: boolean;
        error?: string;
        details?: string;
      };
      if (body.ok) {
        setMessage(`Connected: ${body.details?.replace('\n', ', ')}`);
      } else {
        setMessage(undefined);
        setError(body.error ?? 'Could not connect.');
      }
    } catch {
      setMessage(undefined);
      setError('Could not run the test.');
    } finally {
      setBusy(false);
    }
  }

  const linked = Boolean(status?.sshHost);

  return (
    <section
      id="computer"
      aria-labelledby="computer-heading"
      className="scroll-mt-8"
    >
      <h2 id="computer-heading" className="mb-3 text-lg font-semibold">
        Computer
      </h2>
      <p className="mb-2 text-sm text-gray-600">
        Give ploop a Linux computer of its own to run commands and keep files
        on. Any machine you can log in to with SSH works, so it can cost
        nothing: an always-free cloud VM (Oracle Cloud and Google Cloud both
        offer one), a spare computer, or a virtual machine on this Mac.
      </p>
      <p className="mb-4 text-sm text-gray-600">
        {linked
          ? 'ploop uses the computer below.'
          : 'Until you link one, ploop uses a small built-in sandbox that is free but forgets everything when the app closes.'}{' '}
        You still approve every command before it runs. ploop uses the key file
        you name and never copies it.
      </p>

      {status && (
        <form
          className="space-y-4 text-sm"
          onSubmit={event => {
            event.preventDefault();
            void save(
              {
                sshHost: host,
                sshUser: user,
                sshPort: port,
                sshKeyPath: keyPath,
              },
              'Saved. ploop is restarting to use it.',
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <label className="block">
              <span className="block mb-1 font-medium">Address</span>
              <input
                className={inputClass}
                autoComplete="off"
                placeholder="203.0.113.7 or vm.example.com"
                value={host}
                onChange={event => setHost(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="block mb-1 font-medium">Port</span>
              <input
                className={inputClass}
                inputMode="numeric"
                autoComplete="off"
                placeholder="22"
                value={port}
                onChange={event => setPort(event.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className="block mb-1 font-medium">Username</span>
            <input
              className={inputClass}
              autoComplete="off"
              placeholder="ubuntu"
              value={user}
              onChange={event => setUser(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="block mb-1 font-medium">Key file</span>
            <input
              className={inputClass}
              autoComplete="off"
              placeholder="/Users/you/.ssh/id_ed25519"
              value={keyPath}
              onChange={event => setKeyPath(event.target.value)}
            />
            <span className="block mt-1 text-gray-600">
              The full path of the private key you use to log in. Leave it empty
              to use your usual SSH setup.
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-1 font-medium text-white rounded-full bg-ink hover:bg-lagoon-deep disabled:opacity-60"
            >
              Save computer
            </button>
            {linked && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void test()}
                  className="px-4 py-1 bg-white border border-gray-400 rounded-full hover:bg-blush-deep disabled:opacity-60"
                >
                  Test connection
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void save(
                      { sshHost: '', sshUser: '', sshPort: '', sshKeyPath: '' },
                      'Unlinked. ploop is restarting.',
                    )
                  }
                  className="px-4 py-1 underline underline-offset-2 disabled:opacity-60"
                >
                  Unlink
                </button>
              </>
            )}
          </div>
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
