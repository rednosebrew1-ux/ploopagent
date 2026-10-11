import { plans } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const all = await plans.list();
  return Response.json({
    plans: all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  });
}
