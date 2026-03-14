import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-mission-control-bg text-mission-control-text">
      <SearchX size={48} className="text-mission-control-text-dim" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-mission-control-text-dim">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-mission-control-accent text-white hover:opacity-90 transition-opacity text-sm"
      >
        Go back to Dashboard
      </Link>
    </div>
  );
}
