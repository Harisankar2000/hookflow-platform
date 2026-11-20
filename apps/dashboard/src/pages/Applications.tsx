import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, del, post } from '../api';
import { Empty, ErrorText, Modal, PageHead } from '../components/ui';
import { timeAgo } from '../format';
import { Application } from '../types';

export function Applications() {
  const queryClient = useQueryClient();
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/v1/applications') });
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: (id: string) => del(`/v1/applications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  return (
    <>
      <PageHead
        title="Applications"
        subtitle="Systems that publish events, each with its own endpoints"
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={14} /> New application
          </button>
        }
      />
      <ErrorText error={apps.error ?? remove.error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>UID</th>
              <th>Endpoints</th>
              <th>Messages</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {apps.data?.map((app) => (
              <tr key={app.id}>
                <td><strong>{app.name}</strong></td>
                <td className="mono muted">{app.uid}</td>
                <td className="num">
                  <Link to={`/endpoints?applicationId=${app.id}`} className="muted">{app.endpointCount}</Link>
                </td>
                <td className="num">
                  <Link to={`/messages?applicationId=${app.id}`} className="muted">{app.messageCount}</Link>
                </td>
                <td className="muted">{timeAgo(app.createdAt)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn ghost sm danger"
                    aria-label={`Delete ${app.name}`}
                    onClick={() => {
                      if (confirm(`Delete ${app.name}, its endpoints and its message history?`)) remove.mutate(app.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {apps.data?.length === 0 && <Empty title="No applications yet">Create one to start sending events.</Empty>}
      </div>
      {open && <CreateApplication onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateApplication({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [uid, setUid] = useState('');
  const create = useMutation({
    mutationFn: () => post<Application>('/v1/applications', { name, ...(uid ? { uid } : {}) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      onClose();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <Modal title="New application" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="app-name">Name</label>
          <input id="app-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="app-uid">UID (optional)</label>
          <input id="app-uid" className="input mono" placeholder="payments" value={uid} onChange={(e) => setUid(e.target.value)} />
          <span className="hint">A stable name you can use in API URLs instead of the generated id.</span>
        </div>
        <ErrorText error={create.error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name || create.isPending}>Create</button>
        </div>
      </form>
    </Modal>
  );
}
