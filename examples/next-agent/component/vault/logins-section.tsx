'use client';

import { useCallback, useEffect, useState } from 'react';
import LoginForm from './login-form';

const REVEAL_MS = 15_000;

function host(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const linkButton =
  'underline underline-offset-2 hover:text-lagoon-deep disabled:opacity-60';

export default function LoginsSection({ api }: { api: PloopDesktopApi }) {
  const [logins, setLogins] = useState<PloopLogin[]>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<string | 'new'>();
  const [confirmingDelete, setConfirmingDelete] = useState<string>();
  const [revealed, setRevealed] = useState<{ id: string; password: string }>();
  const [notice, setNotice] = useState<{ id: string; text: string }>();
  const [busy, setBusy] = useState<string>();

  const reload = useCallback(async () => {
    try {
      setLogins(await api.vault.list());
      setError(undefined);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not open the vault.',
      );
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A shown password hides itself.
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(undefined), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealed]);

  async function run(id: string, action: () => Promise<string | void>) {
    setBusy(id);
    setNotice(undefined);
    try {
      const text = await action();
      if (text) setNotice({ id, text });
    } catch (caught) {
      const text =
        caught instanceof Error ? caught.message : 'Something went wrong.';
      if (text !== 'Cancelled.') setNotice({ id, text });
    } finally {
      setBusy(undefined);
    }
  }

  const editingLogin = logins?.find(login => login.id === editing);

  return (
    <section aria-labelledby="logins-heading">
      <div className="flex items-baseline justify-between mb-3">
        <h2 id="logins-heading" className="text-lg font-semibold">
          Logins
        </h2>
        {editing === undefined && (
          <button
            className="px-4 py-1 text-sm font-medium text-white rounded-full bg-ink hover:bg-lagoon-deep"
            onClick={() => setEditing('new')}
          >
            Add a login
          </button>
        )}
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Passwords are encrypted with a key kept in your Mac’s Keychain and never
        leave this computer. Ploop can use a login you allow, but only the app
        ever handles the password.
      </p>

      {editing === 'new' && (
        <LoginForm
          onCancel={() => setEditing(undefined)}
          onSave={async values => {
            await api.vault.add(values);
            setEditing(undefined);
            await reload();
          }}
        />
      )}

      {editingLogin && (
        <LoginForm
          key={editingLogin.id}
          login={editingLogin}
          onCancel={() => setEditing(undefined)}
          onSave={async values => {
            await api.vault.update(editingLogin.id, values);
            setEditing(undefined);
            await reload();
          }}
        />
      )}

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {logins === undefined && !error && (
        <p className="text-sm text-gray-600">Opening the vault…</p>
      )}

      {logins?.length === 0 && editing !== 'new' && (
        <div className="p-4 text-sm bg-white border border-gray-300 border-dashed rounded-xl">
          <p className="font-medium">No logins yet</p>
          <p className="mt-1 text-gray-600">
            Add the sign-in page, username and password for a site. Then ask
            ploop to sign in to it, and approve the request in the chat.
          </p>
        </div>
      )}

      <ul className="divide-y divide-gray-200">
        {logins?.map(login => (
          <li key={login.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium">{login.label}</span>{' '}
                <span className="text-gray-600">{host(login.url)}</span>
                <div className="text-gray-700 break-all">{login.username}</div>
              </div>
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  checked={login.agentAccess}
                  onChange={event =>
                    void run(login.id, async () => {
                      await api.vault.update(login.id, {
                        agentAccess: event.target.checked,
                      });
                      await reload();
                    })
                  }
                />
                Ploop can use this
              </label>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-gray-700">
              <button
                className={linkButton}
                disabled={busy === login.id}
                onClick={() =>
                  void run(login.id, async () => {
                    const result = await api.vault.signIn(login.id);
                    return result.note;
                  })
                }
              >
                Sign in
              </button>
              <button
                className={linkButton}
                disabled={busy === login.id}
                onClick={() =>
                  revealed?.id === login.id
                    ? setRevealed(undefined)
                    : void run(login.id, async () => {
                        setRevealed({
                          id: login.id,
                          password: await api.vault.reveal(login.id),
                        });
                      })
                }
              >
                {revealed?.id === login.id ? 'Hide password' : 'Show password'}
              </button>
              <button
                className={linkButton}
                disabled={busy === login.id}
                onClick={() =>
                  void run(login.id, async () => {
                    await api.vault.copyPassword(login.id);
                    return 'Copied. It clears from the clipboard in 30 seconds.';
                  })
                }
              >
                Copy password
              </button>
              <button
                className={linkButton}
                onClick={() => setEditing(login.id)}
              >
                Edit
              </button>
              {confirmingDelete === login.id ? (
                <span>
                  Delete this login?{' '}
                  <button
                    className={linkButton}
                    onClick={() =>
                      void run(login.id, async () => {
                        await api.vault.remove(login.id);
                        setConfirmingDelete(undefined);
                        await reload();
                      })
                    }
                  >
                    Yes, delete
                  </button>{' '}
                  <button
                    className={linkButton}
                    onClick={() => setConfirmingDelete(undefined)}
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  className={linkButton}
                  onClick={() => setConfirmingDelete(login.id)}
                >
                  Delete
                </button>
              )}
            </div>

            {revealed?.id === login.id && (
              <code className="block p-2 mt-2 break-all bg-gray-100 rounded">
                {revealed.password}
              </code>
            )}
            {notice?.id === login.id && (
              <p role="status" className="mt-2 text-gray-700">
                {notice.text}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
