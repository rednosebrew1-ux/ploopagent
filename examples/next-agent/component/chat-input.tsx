import { useState } from 'react';

export default function ChatInput({
  status,
  onSubmit,
  stop,
}: {
  status: string;
  onSubmit: (text: string) => void;
  stop?: () => void;
}) {
  const [text, setText] = useState('');

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if (text.trim() === '') return;
        onSubmit(text);
        setText('');
      }}
    >
      <input
        className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded-full shadow-xl bg-white focus:outline-none focus:ring-2 focus:ring-ink"
        placeholder="Say something..."
        disabled={status !== 'ready'}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      {stop && (status === 'streaming' || status === 'submitted') && (
        <button
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded-full shadow-xl bg-white focus:outline-none focus:ring-2 focus:ring-ink"
          type="submit"
          onClick={stop}
        >
          Stop
        </button>
      )}
    </form>
  );
}
