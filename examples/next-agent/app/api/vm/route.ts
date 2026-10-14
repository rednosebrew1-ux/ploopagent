import { getVm, hasSshVm } from '@/lib/vm';

export const dynamic = 'force-dynamic';

// Lets the Vault page check that the linked computer answers.
export async function POST() {
  try {
    const vm = await getVm();
    const result = await vm.session.run({
      command: 'echo "$(whoami)@$(hostname)"; uname -sr',
      workingDirectory: vm.workspace,
    });
    if (result.exitCode !== 0) {
      return Response.json(
        { ok: false, error: result.stderr.trim() || 'The command failed.' },
        { status: 502 },
      );
    }
    return Response.json({
      ok: true,
      kind: vm.kind,
      linked: hasSshVm(),
      details: result.stdout.trim(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not connect.',
      },
      { status: 502 },
    );
  }
}
