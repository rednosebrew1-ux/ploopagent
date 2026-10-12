import Link from 'next/link';

export default function BrandHeader({
  title,
  action,
}: {
  title?: string;
  action: { href: string; label: string };
}) {
  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ploop-logo.svg"
          alt=""
          width={40}
          height={40}
          className="rounded-xl"
        />
        <h1 className="text-xl font-bold tracking-tight">{title ?? 'ploop'}</h1>
      </div>
      <Link
        className="px-3 py-1 text-sm font-medium rounded-full bg-lagoon hover:bg-ink hover:text-white focus:outline-none focus:ring-2 focus:ring-ink"
        href={action.href}
      >
        {action.label}
      </Link>
    </header>
  );
}
