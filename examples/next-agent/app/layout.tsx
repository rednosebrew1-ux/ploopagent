import './globals.css';

export const metadata = {
  title: 'ploop',
  description: 'An open-source personal AI agent.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div aria-hidden className="h-1.5 bg-rainbow" />
        {children}
      </body>
    </html>
  );
}
