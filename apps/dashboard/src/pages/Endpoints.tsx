import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ListChecks, Plus, Send, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, del, patch, post } from '../api';
import { CopyButton, Empty, ErrorText, Modal, PageHead } from '../components/ui';
import { Application, Endpoint, EventType } from '../types';

export function Endpoints() {
  const [params, setParams] = useSearchParams();
  const applicationId = params.get('applicationId') ?? '';
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);

  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/v1/applications') });
  const endpoints = useQuery({
    queryKey: ['endpoints', applicationId],
    queryFn: () => api<Endpoint[]>(`/v1/endpoints${applicationId ? `?applicationId=${applicationId}` : ''}`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['endpoints'] });

  const toggle = useMutation({
    mutationFn: (e: Endpoint) => patch(`/v1/endpoints/${e.id}`, { disabled: !e.disabled }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/v1/endpoints/${id}`), onSuccess: refresh });
  const test = useMutation({ mutationFn: (id: string) => post(`/v1/endpoints/${id}/test`) });
  const reveal = useMutation({
    mutationFn: (e: Endpoint) => api<{ secret: string }>(`/v1/endpoints/${e.id}/secret`),
    onSuccess: (r, e) => setSecret({ title: `Signing secret for ${e.url}`, value: r.secret }),
  });
  const rotate = useMutation({
    mutationFn: (e: Endpoint) => post<{ secret: string }>(`/v1/endpoints/${e.id}/rotate-secret`),
    onSuccess: (r) => setSecret({ title: 'New signing secret', value: r.secret }),
  });

  return (
    <>
      <PageHead
        title="Endpoints"
        subtitle="URLs that receive signed webhooks"
        actions={
          <>
            <select
              className="select"
              style={{ width: 200 }}
              value={applicationId}
              onChange={(e) => setParams(e.target.value ? { applicationId: e.target.value } : {})}
            >
              <option value="">All applications</option>
              {apps.data?.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button className="btn primary" onClick={() => setCreating(true)} disabled={!apps.data?.length}>
              <Plus size={14} /> Add endpoint
            </button>
          </>
        }
      />
      <ErrorText error={endpoints.error ?? toggle.error ?? remove.error ?? test.error ?? rotate.error} />
      {test.isSuccess && <p className="notice" style={{ marginBottom: 12 }}>Test event queued. Watch it in the delivery logs.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Application</th>
              <th>Subscribed to</th>
              <th>Last 24h</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {endpoints.data?.map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="mono truncate" title={e.url}>{e.url}</div>
                  {e.description && <div className="muted" style={{ fontSize: 12.5 }}>{e.description}</div>}
                </td>
                <td>{e.application.name}</td>
                <td>
                  {e.filterTypes.length === 0 ? (
                    <span className="muted">All events</span>
                  ) : (
                    e.filterTypes.map((t) => <span className="tag" key={t}>{t}</span>)
                  )}
                </td>
                <td className="num">
                  <span style={{ color: 'var(--green)' }}>{e.last24h?.succeeded ?? 0}</span>
                  <span className="muted"> / </span>
                  <span style={{ color: 'var(--red)' }}>{e.last24h?.failed ?? 0}</span>
                  {(e.last24h?.inFlight ?? 0) > 0 && <span className="muted"> · {e.last24h?.inFlight} in flight</span>}
                </td>
                <td>
                  <button className={`badge ${e.disabled ? 'neutral' : 'ok'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle.mutate(e)}>
                    {e.disabled ? 'Disabled' : 'Active'}
                  </button>
                </td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                    <button className="btn ghost sm" title="Send test event" onClick={() => test.mutate(e.id)}><Send size={14} /></button>
                    <Link className="btn ghost sm" title="Delivery logs" to={`/deliveries?endpointId=${e.id}`}><ListChecks size={14} /></Link>
                    <button className="btn ghost sm" title="Show signing secret" onClick={() => reveal.mutate(e)}><KeyRound size={14} /></button>
                    <button className="btn ghost sm" title="Rotate secret" onClick={() => confirm('Rotate the signing secret? The old one stops working now.') && rotate.mutate(e)}>Rotate</button>
                    <button className="btn ghost sm danger" title="Delete" onClick={() => confirm(`Delete ${e.url}?`) && remove.mutate(e.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {endpoints.data?.length === 0 && (
          <Empty title="No endpoints">{apps.data?.length ? 'Add one to start receiving events.' : 'Create an application first.'}</Empty>
        )}
      </div>
      {creating && (
        <CreateEndpoint
          apps={apps.data ?? []}
          defaultApp={applicationId}
          onClose={() => setCreating(false)}
          onCreated={(e) => {
            setCreating(false);
            void refresh();
            if (e.secret) setSecret({ title: 'Endpoint created. Save its signing secret', value: e.secret });
          }}
        />
      )}
      {secret && (
        <Modal title={secret.title} onClose={() => setSecret(null)}>
          <div className="stack">
            <div className="secret-box">
              <span style={{ flex: 1 }}>{secret.value}</span>
              <CopyButton value={secret.value} />
            </div>
            <p className="hint">Use it to verify the webhook-signature header. See apps/receiver/verify.mjs.</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setSecret(null)}>Done</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function CreateEndpoint({
  apps,
  defaultApp,
  onClose,
  onCreated,
}: {
  apps: Application[];
  defaultApp: string;
  onClose: () => void;
  onCreated: (e: Endpoint) => void;
}) {
  const eventTypes = useQuery({ queryKey: ['event-types'], queryFn: () => api<EventType[]>('/v1/event-types') });
  const [applicationId, setApplicationId] = useState(defaultApp || apps[0]?.id || '');
  const [url, setUrl] = useState('http://localhost:4200/ok');
  const [description, setDescription] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: () => post<Endpoint>('/v1/endpoints', { applicationId, url, description: description || undefined, filterTypes }),
    onSuccess: onCreated,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Modal title="Add endpoint" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="ep-app">Application</label>
          <select id="ep-app" className="select" value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ep-url">URL</label>
          <input id="ep-url" className="input mono" value={url} onChange={(e) => setUrl(e.target.value)} />
          <span className="hint">The demo receiver offers /ok, /slow, /flaky, /down and /status/:code.</span>
        </div>
        <div className="field">
          <label htmlFor="ep-desc">Description</label>
          <input id="ep-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label>Event types</label>
          {eventTypes.data?.filter((t) => !t.archived).length ? (
            <div className="row" style={{ gap: 6 }}>
              {eventTypes.data.filter((t) => !t.archived).map((t) => (
                <label key={t.id} className="tag" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filterTypes.includes(t.name)}
                    onChange={(e) =>
                      setFilterTypes((cur) => (e.target.checked ? [...cur, t.name] : cur.filter((x) => x !== t.name)))
                    }
                  />{' '}
                  {t.name}
                </label>
              ))}
            </div>
          ) : null}
          <span className="hint">Leave all unchecked to receive every event.</span>
        </div>
        <ErrorText error={create.error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!url || !applicationId || create.isPending}>Add endpoint</button>
        </div>
      </form>
    </Modal>
  );
}
