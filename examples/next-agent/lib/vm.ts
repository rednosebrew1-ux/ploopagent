import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import { createJustBashNetworkSandboxSession } from '@ai-sdk/sandbox-just-bash';
import {
  createVercelNetworkSandboxSession,
  resumeVercelNetworkSandboxSession,
} from '@ai-sdk/sandbox-vercel';

// Ploop's own computer. With Vercel credentials it is a persistent Vercel
// Sandbox microVM (one per deployment, named by PLOOP_VM_NAME) whose disk is
// restored between sessions. Without them it is an in-memory just-bash
// sandbox for local development, which forgets everything on restart.
export type PloopVm = {
  kind: 'vercel' | 'local';
  session: SandboxSession;
  workspace: string;
};

const VM_NAME = process.env.PLOOP_VM_NAME ?? 'ploop-vm';
const VM_TIMEOUT_MS = 30 * 60 * 1000;

let vmPromise: Promise<PloopVm> | undefined;

export function getVm(): Promise<PloopVm> {
  vmPromise ??= startVm().catch(error => {
    vmPromise = undefined;
    throw error;
  });
  return vmPromise;
}

export function hasVercelVm() {
  const mode = process.env.PLOOP_VM;
  if (mode === 'local') return false;
  if (mode === 'vercel') return true;
  // Linked locally (`vercel env pull`) or running on Vercel.
  return process.env.VERCEL_OIDC_TOKEN != null || process.env.VERCEL === '1';
}

async function startVm(): Promise<PloopVm> {
  if (!hasVercelVm()) {
    const network = await createJustBashNetworkSandboxSession({
      cwd: '/home/ploop',
    });
    return {
      kind: 'local',
      session: network.restricted(),
      workspace: network.defaultWorkingDirectory,
    };
  }

  let network;
  try {
    network = await resumeVercelNetworkSandboxSession({ sandboxId: VM_NAME });
  } catch {
    network = await createVercelNetworkSandboxSession({
      sandboxId: VM_NAME,
      runtime: 'node24',
      persistent: true,
      timeout: VM_TIMEOUT_MS,
    });
  }

  return {
    kind: 'vercel',
    session: network.restricted(),
    workspace: network.defaultWorkingDirectory,
  };
}
