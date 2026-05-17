'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useSyncExternalStore, useTransition } from 'react';

import { cn } from '@/lib/utils';

const COOLDOWN_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'fragment:lastSyncAt';

type Listener = () => void;

// Module-level pub/sub so `writeLastSync` updates every mounted SyncButton in
// the tab, not just the one that triggered the write. The native `storage`
// event only fires in *other* tabs, so without our own notifier the click
// handler's own SyncButton wouldn't re-render off its useSyncExternalStore.
const lastSyncListeners = new Set<Listener>();

function subscribeLastSync(cb: Listener) {
  lastSyncListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    lastSyncListeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

function getLastSyncClient(): number {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function getLastSyncServer(): number {
  return 0;
}

function writeLastSync(ts: number) {
  window.localStorage.setItem(STORAGE_KEY, String(ts));
  for (const l of lastSyncListeners) l();
}

// Tick once per second so the cooldown countdown re-renders. Driven by
// useSyncExternalStore so we never call setState inside an effect body.
function subscribeTick(cb: Listener) {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
}

function nowClient(): number {
  return Date.now();
}

function nowServer(): number {
  return 0;
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SyncButtonProps {
  className?: string;
}

export function SyncButton({ className }: SyncButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lastSync = useSyncExternalStore(subscribeLastSync, getLastSyncClient, getLastSyncServer);
  const now = useSyncExternalStore(subscribeTick, nowClient, nowServer);

  // On the server, `now` is 0 and `lastSync` is 0, so remaining is 0 and we
  // render the active "Sync" state. That matches the post-hydration state
  // for any user without a recent sync, so no hydration flash.
  const remaining = now === 0 ? 0 : Math.max(0, lastSync + COOLDOWN_MS - now);
  const cooling = remaining > 0;
  const disabled = cooling || isPending;

  const onClick = useCallback(() => {
    if (disabled) return;
    writeLastSync(Date.now());
    startTransition(() => {
      router.refresh();
    });
  }, [disabled, router]);

  const label = cooling
    ? `Wait ${formatRemaining(remaining)}`
    : isPending
      ? 'Syncing…'
      : 'Sync';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={cooling ? `Sync available in ${formatRemaining(remaining)}` : 'Sync jobs'}
      title={
        cooling
          ? `New sync available in ${formatRemaining(remaining)}`
          : 'Fetch the latest detected roles'
      }
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
