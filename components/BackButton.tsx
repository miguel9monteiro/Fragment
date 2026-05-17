'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';

import { cn } from '@/lib/utils';

interface BackButtonProps {
  // Where to go when the user has no in-app history (e.g. opened the page
  // directly via a shared link). Without this we'd send them off-site.
  fallbackHref: string;
  label?: string;
  className?: string;
}

const subscribeNoop = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;

export function BackButton({ fallbackHref, label = 'Back', className }: BackButtonProps) {
  const router = useRouter();
  const isClient = useSyncExternalStore(subscribeNoop, clientTrue, serverFalse);
  const canGoBack = isClient && typeof window !== 'undefined' && window.history.length > 1;

  const styles = cn(
    'inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
    className,
  );

  if (!canGoBack) {
    return (
      <Link href={fallbackHref} className={styles} aria-label={label}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={styles}
      aria-label={label}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
