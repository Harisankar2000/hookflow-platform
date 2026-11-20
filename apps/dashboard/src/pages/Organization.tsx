import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { api, patch } from '../api';
import { ErrorText, PageHead } from '../components/ui';
import { dateTime } from '../format';
import { Organization as Org } from '../types';

export function Organization() {
  const queryClient = useQueryClient();
  const org = useQuery({ queryKey: ['organization'], queryFn: () => api<Org>('/v1/organization') });
  const [name, setName] = useState('');
  useEffect(() => setName(org.data?.name ?? ''), [org.data?.name]);
  const save = useMutation({
    mutationFn: () => patch<Org>('/v1/organization', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organization'] }),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <>
      <PageHead title="Organization" subtitle="Settings for your workspace" />
      <form className="card stack" style={{ maxWidth: 560 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="org-name">Name</label>
          <input id="org-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {org.data && (
          <dl className="kv">
            <dt>Organization ID</dt><dd className="mono">{org.data.id}</dd>
            <dt>Created</dt><dd>{dateTime(org.data.createdAt)}</dd>
          </dl>
        )}
        <ErrorText error={org.error ?? save.error} />
        <div className="row">
          <button className="btn primary" disabled={!name || save.isPending}>Save</button>
          {save.isSuccess && <span className="muted">Saved</span>}
        </div>
      </form>
    </>
  );
}
