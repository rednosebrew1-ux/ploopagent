// The part of the ploop desktop app's API that the Vault page uses. The
// source of truth is examples/ploop-desktop/src/api.ts; keep them in step.
// `window.ploop` only exists inside the desktop app.

type PloopLogin = {
  id: string;
  label: string;
  url: string;
  username: string;
  notes: string;
  agentAccess: boolean;
  createdAt: string;
  updatedAt: string;
};

type PloopLoginInput = {
  label?: string;
  url: string;
  username: string;
  password: string;
  notes?: string;
  agentAccess?: boolean;
};

type PloopSignInResult = {
  status: 'signed-in' | 'already-signed-in' | 'needs-attention' | 'failed';
  url: string;
  title: string;
  note: string;
};

type PloopSettingsStatus = {
  openrouterApiKey: boolean;
  tavilyApiKey: boolean;
  resendApiKey: boolean;
  fromEmail: string;
  sshHost: string;
  sshUser: string;
  sshPort: string;
  sshKeyPath: string;
};

type PloopSettingsPatch = Partial<
  Record<
    | 'openrouterApiKey'
    | 'tavilyApiKey'
    | 'resendApiKey'
    | 'fromEmail'
    | 'sshHost'
    | 'sshUser'
    | 'sshPort'
    | 'sshKeyPath',
    string
  >
>;

interface PloopDesktopApi {
  vault: {
    list(): Promise<PloopLogin[]>;
    add(input: PloopLoginInput): Promise<PloopLogin>;
    update(id: string, patch: Partial<PloopLoginInput>): Promise<PloopLogin>;
    remove(id: string): Promise<boolean>;
    reveal(id: string): Promise<string>;
    copyPassword(id: string): Promise<void>;
    signIn(id: string): Promise<PloopSignInResult>;
  };
  settings: {
    status(): Promise<PloopSettingsStatus>;
    save(patch: PloopSettingsPatch): Promise<void>;
  };
  app: {
    info(): Promise<{ version: string; signed: boolean }>;
    checkForUpdates(): Promise<void>;
  };
}

interface Window {
  ploop?: PloopDesktopApi;
}
