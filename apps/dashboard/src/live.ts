import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Session } from './session';

/** Connects to the API's /live namespace and refreshes affected queries as deliveries change. */
export function useLiveUpdates(session: Session | null): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!session) return;
    const socket = io(session.apiUrl.replace(/\/$/, '') + '/live', {
      auth: { apiKey: session.apiKey },
      transports: ['websocket'],
    });

    let pending: number | undefined;
    // Many deliveries can finish within a second; refetch at most every 800 ms.
    const refresh = () => {
      if (pending) return;
      pending = window.setTimeout(() => {
        pending = undefined;
        for (const key of ['deliveries', 'delivery', 'stats', 'messages', 'message', 'endpoints']) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      }, 800);
    };

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('delivery.updated', refresh);
    socket.on('message.created', refresh);
    return () => {
      window.clearTimeout(pending);
      socket.disconnect();
    };
  }, [session, queryClient]);

  return connected;
}
