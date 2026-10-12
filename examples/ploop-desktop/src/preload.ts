import { contextBridge, ipcRenderer } from 'electron';
import type { PloopDesktopApi } from './api';

type Reply<T> = { ok: true; value: T } | { ok: false; error: string };

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const reply: Reply<T> = await ipcRenderer.invoke(channel, ...args);
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}

const api: PloopDesktopApi = {
  vault: {
    list: () => call('vault:list'),
    add: input => call('vault:add', input),
    update: (id, patch) => call('vault:update', id, patch),
    remove: id => call('vault:remove', id),
    reveal: id => call('vault:reveal', id),
    copyPassword: id => call('vault:copy-password', id),
    signIn: id => call('vault:sign-in', id),
  },
  settings: {
    status: () => call('settings:status'),
    save: patch => call('settings:save', patch),
  },
  app: {
    info: () => call('app:info'),
    checkForUpdates: () => call('app:check-for-updates'),
  },
};

contextBridge.exposeInMainWorld('ploop', api);
