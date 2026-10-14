// Three bouncing dots while ploop works on a reply. They sit still for people
// who ask their system to reduce motion; the words carry the meaning anyway.
export default function TypingIndicator({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 mb-6 text-sm text-lagoon-deep"
    >
      <span aria-hidden="true" className="flex items-center gap-1">
        {[0, 1, 2].map(dot => (
          <span
            key={dot}
            className="block w-2 h-2 rounded-full bg-lagoon-deep motion-safe:animate-bounce"
            style={{ animationDelay: `${dot * 150}ms` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
