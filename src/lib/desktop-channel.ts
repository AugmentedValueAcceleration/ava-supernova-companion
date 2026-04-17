// Supabase Realtime adapter for the desktop automation pairing channel.
// Fulfils the ChannelTransport interface from @ava/core/remote so the
// companion can drive a RemoteClient without core depending on supabase-js.

import { createClient } from './supabase';

// Minimal local copy of the types — the companion doesn't bundle @ava/core
// so we inline what we need. If the schema drifts, both sides need updating.
type Surface = 'desktop' | 'companion';

interface BaseRemoteMessage {
  type: string;
  from: Surface;
  ts: string;
  [key: string]: unknown;
}

export interface ChannelTransport {
  broadcast(message: BaseRemoteMessage): Promise<void>;
  subscribe(handler: (message: BaseRemoteMessage) => void): () => void;
  isConnected(): boolean;
}

export function channelName(userId: string): string {
  return `ava:remote:${userId}`;
}

/**
 * Create a transport backed by a Supabase Realtime broadcast channel.
 * The channel is `ava:remote:{userId}` — RLS enforces JWT subject matches.
 */
export function createDesktopChannel(userId: string): ChannelTransport & { teardown: () => void } {
  const supabase = createClient();
  const channel = supabase.channel(channelName(userId), {
    config: { broadcast: { self: false } },
  });

  let connected = false;
  const handlers = new Set<(msg: BaseRemoteMessage) => void>();

  channel
    .on('broadcast', { event: 'ava' }, ({ payload }) => {
      for (const h of handlers) {
        try { h(payload as BaseRemoteMessage); } catch { /* swallow */ }
      }
    })
    .subscribe((status) => {
      connected = status === 'SUBSCRIBED';
    });

  return {
    async broadcast(message) {
      if (!connected) throw new Error('channel not connected');
      await channel.send({ type: 'broadcast', event: 'ava', payload: message });
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => { handlers.delete(handler); };
    },
    isConnected() { return connected; },
    teardown() {
      handlers.clear();
      supabase.removeChannel(channel);
    },
  };
}
