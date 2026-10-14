'use client';

import BrandHeader from '@/component/brand-header';
import ComputerSection from '@/component/vault/computer-section';
import KeysSection from '@/component/vault/keys-section';
import LoginsSection from '@/component/vault/logins-section';
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
      <BrandHeader
        title="Vault"
        action={{ href: '/', label: 'Back to chat' }}
      />

      {api === undefined && <p className="text-sm text-gray-600">Loading…</p>}

      {api === null && (
        <div className="p-4 text-sm bg-white border border-gray-300 rounded-xl">
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
          <ComputerSection api={api} />

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
              className="px-4 py-1 mt-3 bg-white border border-gray-400 rounded-full hover:bg-blush-deep"
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
