import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, post } from '../api';
import { Drawer, Empty, ErrorText, Json, Modal, PageHead, StatusBadge } from '../components/ui';
import { dateTime, shortId, timeAgo } from '../format';
import { Application, Delivery, EventType, Message, Page } from '../types';

export function Messages() {
  const [params, setParams] = useSearchParams();
  const applicationId = params.get('applicationId') ?? '';
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/v1/applications') });

  const messages = useInfiniteQuery({
    queryKey: ['messages', applicationId],
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: '25' });
      if (applicationId) q.set('applicationId', applicationId);
      if (pageParam) q.set('cursor', pageParam);
      return api<Page<Message>>(`/v1/messages?${q}`);
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = messages.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      <PageHead
        title="Messages"
        subtitle="Events published by your applications"
        actions={
          <>
            <select
              className="select"
              style={{ width: 200 }}
              value={applicationId}
              onChange={(e) => setParams(e.target.value ? { applicationId: e.target.value } : {})}
            >
              <option value="">All applications</option>
              {apps.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button className="btn primary" onClick={() => setSending(true)} disabled={!apps.data?.length}>
              <Send size={14} /> Send message
            </button>
          </>
        }
      />
      <ErrorText error={messages.error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Message</th>
              <th>Event type</th>
              <th>Application</th>
              <th>Deliveries</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const ok = m.deliveries.filter((d) => d.status === 'SUCCEEDED').length;
              const failed = m.deliveries.filter((d) => d.status === 'FAILED').length;
              return (
                <tr key={m.id} className="clickable" onClick={() => setSelected(m.id)}>
                  <td className="mono muted">{shortId(m.id)}</td>
                  <td className="mono">{m.eventType}</td>
                  <td>{m.application.name}</td>
                  <td className="num">
                    {m.deliveries.length === 0 ? (
                      <span className="muted">No subscribers</span>
                    ) : (
                      <>
                        <span style={{ color: 'var(--green)' }}>{ok}</span>/{m.deliveries.length} delivered
                        {failed > 0 && <span style={{ color: 'var(--red)' }}> · {failed} failed</span>}
                      </>
                    )}
                  </td>
                  <td className="muted">{timeAgo(m.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!messages.isLoading && rows.length === 0 && <Empty title="No messages yet">Send one to see it fan out.</Empty>}
      </div>
      {messages.hasNextPage && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn" onClick={() => messages.fetchNextPage()}>Load more</button>
        </div>
      )}
      {sending && <SendMessage apps={apps.data ?? []} defaultApp={applicationId} onClose={() => setSending(false)} />}
      {selected && <MessageDetail id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function SendMessage({ apps, defaultApp, onClose }: { apps: Application[]; defaultApp: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const eventTypes = useQuery({ queryKey: ['event-types'], queryFn: () => api<EventType[]>('/v1/event-types') });
  const [app, setApp] = useState(defaultApp || apps[0]?.id || '');
  const [eventType, setEventType] = useState('order.created');
  const [payload, setPayload] = useState('{\n  "orderId": "ord_1001",\n  "amount": 2499,\n  "currency": "INR"\n}');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      post(`/v1/applications/${app}/messages`, {
        eventType,
        payload: JSON.parse(payload),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(payload);
      setParseError(null);
      send.mutate();
    } catch {
      setParseError('Payload must be valid JSON');
    }
  };

  return (
    <Modal title="Send message" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="msg-app">Application</label>
          <select id="msg-app" className="select" value={app} onChange={(e) => setApp(e.target.value)}>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="msg-type">Event type</label>
          <input id="msg-type" className="input mono" list="event-type-names" value={eventType} onChange={(e) => setEventType(e.target.value)} />
          <datalist id="event-type-names">
            {eventTypes.data?.map((t) => <option key={t.id} value={t.name} />)}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="msg-payload">Payload (JSON)</label>
          <textarea id="msg-payload" className="textarea" value={payload} onChange={(e) => setPayload(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="msg-key">Idempotency key (optional)</label>
          <input id="msg-key" className="input mono" value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} />
          <span className="hint">Sending the same key twice returns the first message instead of a duplicate.</span>
        </div>
        {parseError && <p className="error-text">{parseError}</p>}
        <ErrorText error={send.error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!app || !eventType || send.isPending}>Send</button>
        </div>
      </form>
    </Modal>
  );
}

function MessageDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const message = useQuery({
    queryKey: ['message', id],
    queryFn: () => api<Omit<Message, 'deliveries'> & { deliveries: Delivery[] }>(`/v1/messages/${id}`),
  });
  const m = message.data;
  return (
    <Drawer onClose={onClose}>
      {!m ? (
        <ErrorText error={message.error} />
      ) : (
        <div className="stack">
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }} className="mono">{m.eventType}</h2>
            <p className="muted" style={{ margin: 0 }}>{m.application.name} · {dateTime(m.createdAt)}</p>
          </div>
          <dl className="kv">
            <dt>Message ID</dt><dd className="mono">{m.id}</dd>
            <dt>Idempotency key</dt><dd className="mono">{m.idempotencyKey ?? '—'}</dd>
          </dl>
          <Json value={m.payload} />
          <h3 style={{ fontSize: 14, margin: 0 }}>Deliveries</h3>
          {m.deliveries.length === 0 && <p className="muted">No endpoint was subscribed to this event type.</p>}
          {m.deliveries.map((d) => (
            <div className="attempt" key={d.id}>
              <div className="spread">
                <span className="mono truncate">{d.endpoint.url}</span>
                <StatusBadge status={d.status} />
              </div>
              <span className="muted">{d.attemptCount} attempt(s) · <Link to={`/deliveries?messageId=${m.id}`}>open in logs</Link></span>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
