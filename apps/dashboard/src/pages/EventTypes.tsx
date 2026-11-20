import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, patch, post } from '../api';
import { Empty, ErrorText, Json, Modal, PageHead } from '../components/ui';
import { EventType } from '../types';

export function EventTypes() {
  const queryClient = useQueryClient();
  const types = useQuery({ queryKey: ['event-types'], queryFn: () => api<EventType[]>('/v1/event-types') });
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<EventType | null>(null);
  const archive = useMutation({
    mutationFn: (t: EventType) => patch(`/v1/event-types/${t.id}`, { archived: !t.archived }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-types'] }),
  });

  return (
    <>
      <PageHead
        title="Event types"
        subtitle="The catalogue of events your endpoints can subscribe to"
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={14} /> New event type
          </button>
        }
      />
      <ErrorText error={types.error ?? archive.error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Example</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {types.data?.map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.name}</td>
                <td className="muted">{t.description ?? '—'}</td>
                <td>
                  {t.schemaExample ? (
                    <button className="btn ghost sm" onClick={() => setPreview(t)}>View</button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td><span className={`badge ${t.archived ? 'neutral' : 'ok'}`}>{t.archived ? 'Archived' : 'Active'}</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn ghost sm" onClick={() => archive.mutate(t)}>
                    <Archive size={14} /> {t.archived ? 'Restore' : 'Archive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {types.data?.length === 0 && <Empty title="No event types">Add the events your system emits, like payment.succeeded.</Empty>}
      </div>
      {open && <CreateEventType onClose={() => setOpen(false)} />}
      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)}>
          <Json value={preview.schemaExample} />
        </Modal>
      )}
    </>
  );
}

function CreateEventType({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [example, setExample] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (schemaExample?: unknown) => post('/v1/event-types', { name, description: description || undefined, schemaExample }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event-types'] });
      onClose();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const parsed = example.trim() ? JSON.parse(example) : undefined;
      setParseError(null);
      create.mutate(parsed);
    } catch {
      setParseError('Example must be valid JSON');
    }
  };
  return (
    <Modal title="New event type" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="et-name">Name</label>
          <input id="et-name" className="input mono" placeholder="payment.succeeded" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="et-desc">Description</label>
          <input id="et-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="et-example">Example payload (JSON, optional)</label>
          <textarea id="et-example" className="textarea" value={example} onChange={(e) => setExample(e.target.value)} />
        </div>
        {parseError && <p className="error-text">{parseError}</p>}
        <ErrorText error={create.error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name || create.isPending}>Create</button>
        </div>
      </form>
    </Modal>
  );
}
