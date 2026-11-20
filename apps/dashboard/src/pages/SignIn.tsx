import { Webhook } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { createOrganization } from '../api';
import { ErrorText } from '../components/ui';
import { DEFAULT_API_URL, Session } from '../session';

export function SignIn({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const [mode, setMode] = useState<'key' | 'create'>('key');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [apiKey, setApiKey] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [orgName, setOrgName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'key') {
      setBusy(true);
      try {
        const res = await fetch(apiUrl.replace(/\/$/, '') + '/v1/organization', {
          headers: { authorization: `Bearer ${apiKey.trim()}` },
        });
        if (!res.ok) throw new Error(res.status === 401 ? 'That API key was not accepted' : res.statusText);
        onSignIn({ apiUrl, apiKey: apiKey.trim() });
      } catch (err) {
        setError(err instanceof TypeError ? new Error(`Cannot reach ${apiUrl}`) : err);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const { apiKey: key } = await createOrganization(apiUrl, adminToken, orgName);
      setCreated(key);
      setApiKey(key);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="card stack" onSubmit={submit}>
        <div className="row">
          <span className="brand-mark">
            <Webhook size={16} color="#fff" />
          </span>
          <strong style={{ fontSize: 18 }}>HookFlow</strong>
        </div>
        <div className="segmented" role="tablist">
          <button type="button" className={mode === 'key' ? 'on' : ''} onClick={() => setMode('key')}>
            Use an API key
          </button>
          <button type="button" className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>
            New organization
          </button>
        </div>
        <div className="field">
          <label htmlFor="api-url">API URL</label>
          <input id="api-url" className="input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
        </div>

        {mode === 'key' || created ? (
          <>
            {created && (
              <div className="notice">
                Organization created. This key is shown only once, so copy it now. It has been filled in below.
              </div>
            )}
            <div className="field">
              <label htmlFor="api-key">API key</label>
              <input
                id="api-key"
                className="input mono"
                placeholder="hf_live_…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <span className="hint">Run `npm run demo` for a demo organization and key.</span>
            </div>
            <button
              className="btn primary"
              disabled={busy || !apiKey}
              type={created ? 'button' : 'submit'}
              onClick={created ? () => onSignIn({ apiUrl, apiKey }) : undefined}
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="org-name">Organization name</label>
              <input id="org-name" className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="admin-token">Admin token</label>
              <input
                id="admin-token"
                className="input"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
              />
              <span className="hint">ADMIN_TOKEN from apps/api/.env</span>
            </div>
            <button className="btn primary" disabled={busy || !orgName || !adminToken} type="submit">
              Create organization
            </button>
          </>
        )}
        <ErrorText error={error} />
      </form>
    </div>
  );
}
