import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { EncryptedJsonFile, type SecretBox } from './encrypted-file';

// The keys and addresses ploop needs. Stored encrypted next to the vault, and
// handed to ploop's local server as environment variables when it starts.
const settingsSchema = z.object({
  openrouterApiKey: z.string().optional(),
  tavilyApiKey: z.string().optional(),
  resendApiKey: z.string().optional(),
  fromEmail: z.string().optional(),
  // A computer ploop can use over SSH. None of this is secret: the key itself
  // stays in a file the user already has, and only its path is kept.
  sshHost: z.string().optional(),
  sshUser: z.string().optional(),
  sshPort: z.string().optional(),
  sshKeyPath: z.string().optional(),
  // Signs approval requests so a web page can't forge a click on "Approve".
  approvalSecret: z.string().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const settingKeys = [
  'openrouterApiKey',
  'tavilyApiKey',
  'resendApiKey',
  'fromEmail',
  'sshHost',
  'sshUser',
  'sshPort',
  'sshKeyPath',
] as const;

export type SettingKey = (typeof settingKeys)[number];
export type SettingsPatch = Partial<Record<SettingKey, string>>;

// Never includes a secret: just which ones are set.
export type SettingsStatus = {
  openrouterApiKey: boolean;
  tavilyApiKey: boolean;
  resendApiKey: boolean;
  fromEmail: string;
  sshHost: string;
  sshUser: string;
  sshPort: string;
  sshKeyPath: string;
};

export class SettingsStore {
  private readonly file: EncryptedJsonFile<Settings>;

  constructor(options: { file: string; box: SecretBox }) {
    this.file = new EncryptedJsonFile({
      file: options.file,
      box: options.box,
      schema: settingsSchema,
      empty: () => ({}),
    });
  }

  async status(): Promise<SettingsStatus> {
    const settings = await this.file.read();
    return {
      openrouterApiKey: Boolean(settings.openrouterApiKey),
      tavilyApiKey: Boolean(settings.tavilyApiKey),
      resendApiKey: Boolean(settings.resendApiKey),
      fromEmail: settings.fromEmail ?? '',
      sshHost: settings.sshHost ?? '',
      sshUser: settings.sshUser ?? '',
      sshPort: settings.sshPort ?? '',
      sshKeyPath: settings.sshKeyPath ?? '',
    };
  }

  // A missing field is left alone; an empty string clears it.
  async save(patch: SettingsPatch): Promise<void> {
    await this.file.update(settings => {
      const next: Settings = { ...settings };
      for (const key of settingKeys) {
        const value = patch[key]?.trim();
        if (value === undefined) continue;
        if (value === '') delete next[key];
        else next[key] = value;
      }
      return { value: next, result: undefined };
    });
  }

  async approvalSecret(): Promise<string> {
    return this.file.update(settings => {
      if (settings.approvalSecret) {
        return { value: settings, result: settings.approvalSecret };
      }
      const approvalSecret = randomBytes(32).toString('hex');
      return { value: { ...settings, approvalSecret }, result: approvalSecret };
    });
  }

  // The environment ploop's server runs with.
  async toEnv(): Promise<Record<string, string>> {
    const settings = await this.file.read();
    const env: Record<string, string> = {};
    if (settings.openrouterApiKey)
      env.OPENROUTER_API_KEY = settings.openrouterApiKey;
    if (settings.tavilyApiKey) env.TAVILY_API_KEY = settings.tavilyApiKey;
    if (settings.resendApiKey) env.RESEND_API_KEY = settings.resendApiKey;
    if (settings.fromEmail) env.PLOOP_FROM_EMAIL = settings.fromEmail;
    if (settings.sshHost) {
      env.PLOOP_SSH_HOST = settings.sshHost;
      if (settings.sshUser) env.PLOOP_SSH_USER = settings.sshUser;
      if (settings.sshPort) env.PLOOP_SSH_PORT = settings.sshPort;
      if (settings.sshKeyPath) env.PLOOP_SSH_KEY_PATH = settings.sshKeyPath;
    }
    return env;
  }
}
