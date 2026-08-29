import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/')({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: '/dashboard' });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0e12] text-neutral-400 text-xs font-mono">
      Redirecting to Maintainer Dashboard...
    </div>
  );
}
