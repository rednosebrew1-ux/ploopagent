import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import { createJustBashNetworkSandboxSession } from '@ai-sdk/sandbox-just-bash';
import { createSshSession, sshTargetFromEnv } from '@/lib/ssh-vm';
import {
  createVercelNetworkSandboxSession,
  resumeVercelNetworkSandboxSession,
} from '@ai-sdk/sandbox-vercel';

// Ploop's own computer. In order of preference:
// - a Linux machine the user links over SSH (Settings > Computer), which can be
//   any free one, such as an always-free cloud VM or a spare computer;
// - a persistent Vercel Sandbox microVM (one per deployment, named by
//   PLOOP_VM_NAME) whose disk is restored between sessions;
// - an in-memory just-bash sandbox, which is free but forgets everything on
//   restart.
export type PloopVm = {
  kind: 'ssh' | 'vercel' | 'local';
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

export function hasSshVm() {
  return Boolean(process.env.PLOOP_SSH_HOST?.trim());
}

async function startVm(): Promise<PloopVm> {
  const ssh = sshTargetFromEnv();
  if (ssh) {
    const session = createSshSession(ssh);
    // Fail now, with a readable reason, instead of on the first command.
    const probe = await session.run({
      command: 'mkdir -p "$HOME/ploop" && echo "$HOME/ploop"',
    });
    if (probe.exitCode !== 0) {
      throw new Error(
        `The linked VM answered but could not make a workspace: ${probe.stderr.trim()}`,
      );
    }
    return { kind: 'ssh', session, workspace: probe.stdout.trim() };
  }

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
