'use client';

import { useState } from 'react';

type Values = {
  label: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  agentAccess: boolean;
};

const inputClass =
  'w-full p-2 border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-black';

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1 font-medium">{label}</span>
      {children}
      {help && <span className="block mt-1 text-gray-600">{help}</span>}
    </label>
  );
}

// Adds a login, or edits one when `login` is given. The password goes straight
// from this form to the desktop app; this page never stores it.
export default function LoginForm({
  login,
  onSave,
  onCancel,
}: {
  login?: PloopLogin;
  onSave: (values: Values) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>({
    label: login?.label ?? '',
    url: login?.url ?? '',
    username: login?.username ?? '',
    password: '',
    notes: login?.notes ?? '',
    agentAccess: login?.agentAccess ?? true,
  });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues(current => ({ ...current, [key]: value }));

  return (
    <form
      className="p-4 mb-6 space-y-4 text-sm border border-gray-300 rounded"
      onSubmit={async event => {
        event.preventDefault();
        setSaving(true);
        setError(undefined);
        try {
          await onSave(values);
        } catch (caught) {
          setError(
            caught instanceof Error ? caught.message : 'Could not save.',
          );
          setSaving(false);
        }
      }}
    >
      <h3 className="text-base font-semibold">
        {login ? `Edit ${login.label}` : 'Add a login'}
      </h3>

      <Field
        label="Sign-in page"
        help="The page with the sign-in form. It must start with https://."
      >
        <input
          className={inputClass}
          type="url"
          required
          autoComplete="off"
          placeholder="https://github.com/login"
          value={values.url}
          onChange={event => set('url', event.target.value)}
        />
      </Field>

      <Field label="Username or email">
        <input
          className={inputClass}
          type="text"
          required
          autoComplete="off"
          value={values.username}
          onChange={event => set('username', event.target.value)}
        />
      </Field>

      <Field
        label="Password"
        help={login ? 'Leave blank to keep the saved password.' : undefined}
      >
        <input
          className={inputClass}
          type="password"
          required={!login}
          autoComplete="new-password"
          value={values.password}
          onChange={event => set('password', event.target.value)}
        />
      </Field>

      <Field label="Name" help="Optional. Defaults to the site’s address.">
        <input
          className={inputClass}
          type="text"
          autoComplete="off"
          value={values.label}
          onChange={event => set('label', event.target.value)}
        />
      </Field>

      <Field label="Notes">
        <textarea
          className={inputClass}
          rows={2}
          value={values.notes}
          onChange={event => set('notes', event.target.value)}
        />
      </Field>

      <label className="flex items-start gap-2">
        <input
          className="mt-1"
          type="checkbox"
          checked={values.agentAccess}
          onChange={event => set('agentAccess', event.target.checked)}
        />
        <span>
          Let ploop sign in with this login
          <span className="block text-gray-600">
            ploop never sees the password, and you approve each sign-in.
          </span>
        </span>
      </label>

      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1 text-white bg-black rounded disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 border border-gray-400 rounded"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
