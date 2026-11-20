import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, del, post } from '../api';
import { CopyButton, ErrorText, Modal, PageHead } from '../components/ui';
import { timeAgo } from '../format';
import { ApiKey } from '../types';

export function ApiKeys() {
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: ['api-keys'], queryFn: () => api<ApiKey[]>('/v1/api-keys') });
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/v1/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <>
      <PageHead
        title="API keys"
        subtitle="Keys authenticate your services and this dashboard. Only a hash is stored."
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={14} /> New key
          </button>
        }
      />
      <ErrorText error={keys.error ?? revoke.error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Last used</th>
              <th>Created</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.data?.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td className="mono muted">{k.prefix}…</td>
                <td className="muted">{timeAgo(k.lastUsedAt)}</td>
                <td className="muted">{timeAgo(k.createdAt)}</td>
                <td><span className={`badge ${k.revokedAt ? 'neutral' : 'ok'}`}>{k.revokedAt ? 'Revoked' : 'Active'}</span></td>
                <td style={{ textAlign: 'right' }}>
                  {!k.revokedAt && (
                    <button className="btn ghost sm danger" onClick={() => confirm(`Revoke "${k.name}"? Services using it stop working.`) && revoke.mutate(k.id)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <CreateKey
          onClose={() => setOpen(false)}
          onCreated={(key) => {
            setOpen(false);
            setCreated(key);
            void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
          }}
        />
      )}
      {created && (
        <Modal title="Copy your new API key" onClose={() => setCreated(null)}>
          <div className="stack">
            <div className="secret-box">
              <span style={{ flex: 1 }}>{created}</span>
              <CopyButton value={created} />
            </div>
            <p className="hint">This is the only time the full key is shown.</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setCreated(null)}>Done</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function CreateKey({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => void }) {
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => post<ApiKey>('/v1/api-keys', { name }),
    onSuccess: (k) => onCreated(k.key ?? ''),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <Modal title="New API key" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="key-name">Name</label>
          <input id="key-name" className="input" placeholder="Orders service" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <ErrorText error={create.error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name || create.isPending}>Create key</button>
        </div>
      </form>
    </Modal>
  );
}
