'use client';

import KeysSection from '@/component/vault/keys-section';
import LoginsSection from '@/component/vault/logins-section';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function VaultPage() {
  // `window.ploop` is added by the desktop app. null means this page is open
  // in an ordinary browser.
  const [api, setApi] = useState<PloopDesktopApi | null>();
  const [info, setInfo] = useState<{ version: string; signed: boolean }>();
  const [updateMessage, setUpdateMessage] = useState<string>();

  useEffect(() => {
    const desktop = window.ploop ?? null;
    setApi(desktop);
    desktop?.app
      .info()
      .then(setInfo)
      .catch(() => {});
  }, []);

  return (
    <div className="px-4 py-12 mx-auto space-y-10 max-w-3xl">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Vault</h1>
        <Link className="text-sm underline underline-offset-2" href="/">
          Back to chat
        </Link>
      </header>

      {api === undefined && <p className="text-sm text-gray-600">Loading…</p>}

      {api === null && (
        <div className="p-4 text-sm border border-gray-300 rounded">
          <p className="font-medium">
            The vault lives in the ploop desktop app
          </p>
          <p className="mt-1 text-gray-600">
            Passwords are kept in your Mac’s Keychain by the app, so they can’t
            be stored from a web page. Open this in the ploop app to add logins
            and keys.
          </p>
        </div>
      )}

      {api && (
        <>
          <LoginsSection api={api} />
          <KeysSection api={api} />

          <section aria-labelledby="about-heading" className="text-sm">
            <h2 id="about-heading" className="mb-3 text-lg font-semibold">
              About
            </h2>
            <p className="text-gray-700">
              ploop {info?.version ?? ''}.{' '}
              {info?.signed
                ? 'Updates download and install after you agree.'
                : 'This build tells you when a new version is out and opens the download page.'}
            </p>
            <button
              className="px-3 py-1 mt-3 border border-gray-400 rounded"
              onClick={() => {
                setUpdateMessage('Checking…');
                api.app
                  .checkForUpdates()
                  .then(() => setUpdateMessage(undefined))
                  .catch(() =>
                    setUpdateMessage('Could not check for updates.'),
                  );
              }}
            >
              Check for updates
            </button>
            {updateMessage && (
              <p role="status" className="mt-2 text-gray-700">
                {updateMessage}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
