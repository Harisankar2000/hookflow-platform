import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, post } from '../api';
import { CodeBadge, Drawer, Empty, ErrorText, Json, PageHead, StatusBadge } from '../components/ui';
import { dateTime, shortId, timeAgo } from '../format';
import { Delivery, DeliveryStatus, Page } from '../types';

const STATUSES: (DeliveryStatus | '')[] = ['', 'SUCCEEDED', 'RETRYING', 'PENDING', 'FAILED'];

export function Deliveries() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as DeliveryStatus | '';
  const endpointId = params.get('endpointId') ?? '';
  const messageId = params.get('messageId') ?? '';
  const [eventType, setEventType] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const filters = new URLSearchParams();
  if (status) filters.set('status', status);
  if (endpointId) filters.set('endpointId', endpointId);
  if (messageId) filters.set('messageId', messageId);
  if (eventType) filters.set('eventType', eventType);

  const deliveries = useInfiniteQuery({
    queryKey: ['deliveries', filters.toString()],
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams(filters);
      q.set('limit', '25');
      if (pageParam) q.set('cursor', pageParam);
      return api<Page<Delivery>>(`/v1/deliveries?${q}`);
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const replayFailed = useMutation({
    mutationFn: () => post<{ replayed: number }>('/v1/deliveries/replay-failed', endpointId ? { endpointId } : {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliveries'] }),
  });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const rows = deliveries.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      <PageHead
        title="Delivery logs"
        subtitle="Every message sent to every endpoint, with each attempt recorded"
        actions={
          <button className="btn" onClick={() => replayFailed.mutate()} disabled={replayFailed.isPending}>
            <RotateCcw size={14} />
            {replayFailed.data ? `Replayed ${replayFailed.data.replayed}` : 'Replay all failed'}
          </button>
        }
      />
      <div className="row" style={{ marginBottom: 12 }}>
        <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setFilter('status', e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All statuses'}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="Filter by event type"
          value={eventType}
          onChange={(e) => setEventType(e.target.value.trim())}
        />
        {(endpointId || messageId) && (
          <button className="btn sm" onClick={() => setParams({}, { replace: true })}>
            Clear {endpointId ? 'endpoint' : 'message'} filter
          </button>
        )}
      </div>
      <ErrorText error={deliveries.error ?? replayFailed.error} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Event type</th>
              <th>Application</th>
              <th>Endpoint</th>
              <th>Code</th>
              <th>Attempts</th>
              <th>Latency</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr
                key={d.id}
                className={`clickable ${selected === d.id ? 'selected' : ''}`}
                onClick={() => setSelected(d.id)}
              >
                <td><StatusBadge status={d.status} /></td>
                <td className="mono">{d.message.eventType}</td>
                <td>{d.message.application.name}</td>
                <td className="truncate muted" title={d.endpoint.url}>{d.endpoint.url}</td>
                <td><CodeBadge code={d.lastStatusCode} /></td>
                <td className="num">{d.attemptCount}</td>
                <td className="num muted">{d.latencyMs === null ? '—' : `${d.latencyMs}ms`}</td>
                <td className="muted num">{timeAgo(d.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!deliveries.isLoading && rows.length === 0 && (
          <Empty title="No deliveries match">Try another filter, or publish a message.</Empty>
        )}
      </div>
      {deliveries.hasNextPage && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn" onClick={() => deliveries.fetchNextPage()} disabled={deliveries.isFetchingNextPage}>
            Load more
          </button>
        </div>
      )}
      {selected && <DeliveryDetail id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function DeliveryDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState(false);
  const delivery = useQuery({ queryKey: ['delivery', id], queryFn: () => api<Delivery>(`/v1/deliveries/${id}`) });
  const replay = useMutation({
    mutationFn: () => post(`/v1/deliveries/${id}/replay`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delivery', id] }),
  });
  const d = delivery.data;

  return (
    <Drawer onClose={onClose}>
      {!d ? (
        <ErrorText error={delivery.error} />
      ) : (
        <div className="stack">
          <div className="spread">
            <div className="row">
              <StatusBadge status={d.status} />
              <span className="mono muted">{shortId(d.id)}</span>
            </div>
            <div className="row">
              <label className="row muted" style={{ gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} /> Raw JSON
              </label>
              <button
                className="btn sm"
                onClick={() => replay.mutate()}
                disabled={replay.isPending || d.status === 'PENDING' || d.status === 'RETRYING'}
              >
                <RotateCcw size={13} /> Replay
              </button>
            </div>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Delivery details</h2>
            <p className="sub muted" style={{ margin: 0 }}>{d.message.eventType} to {d.endpoint.url}</p>
          </div>
          <ErrorText error={replay.error} />

          {raw ? (
            <Json value={d} />
          ) : (
            <>
              <dl className="kv">
                <dt>Delivery ID</dt><dd className="mono">{d.id}</dd>
                <dt>Message ID</dt><dd className="mono">{d.messageId}</dd>
                <dt>Application</dt><dd>{d.message.application.name}</dd>
                <dt>Endpoint</dt><dd className="mono">{d.endpoint.url}</dd>
                <dt>Attempts</dt><dd>{d.attemptCount}</dd>
                <dt>Next attempt</dt><dd>{d.nextAttemptAt ? timeAgo(d.nextAttemptAt) : '—'}</dd>
                <dt>Created</dt><dd>{dateTime(d.createdAt)}</dd>
                {d.lastError && (<><dt>Last error</dt><dd className="error-text">{d.lastError}</dd></>)}
              </dl>
              <div>
                <h3 style={{ fontSize: 14, margin: '4px 0 8px' }}>Payload</h3>
                <Json value={d.message.payload} />
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <h3 style={{ fontSize: 14, margin: '4px 0 0' }}>Attempts</h3>
                {d.attempts?.length === 0 && <p className="muted">Waiting for the first attempt.</p>}
                {d.attempts?.map((a) => (
                  <div className="attempt" key={a.id}>
                    <div className="spread">
                      <div className="row">
                        <strong>#{a.attempt}</strong>
                        <CodeBadge code={a.statusCode} />
                        <span className="muted num">{a.durationMs}ms</span>
                      </div>
                      <span className="muted">{dateTime(a.createdAt)}</span>
                    </div>
                    {a.error && <span className="error-text">{a.error}</span>}
                    {a.responseBody && <pre className="json" style={{ maxHeight: 120 }}>{a.responseBody}</pre>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
