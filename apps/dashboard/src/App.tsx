import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { setApiSession } from './api';
import { Layout } from './components/Layout';
import { useLiveUpdates } from './live';
import { ApiKeys } from './pages/ApiKeys';
import { Applications } from './pages/Applications';
import { Dashboard } from './pages/Dashboard';
import { Deliveries } from './pages/Deliveries';
import { Endpoints } from './pages/Endpoints';
import { EventTypes } from './pages/EventTypes';
import { Messages } from './pages/Messages';
import { Organization } from './pages/Organization';
import { SignIn } from './pages/SignIn';
import { loadSession, saveSession, Session } from './session';

const initial = loadSession();
setApiSession(initial);

export function App() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(initial);
  const live = useLiveUpdates(session);

  const update = (next: Session | null) => {
    saveSession(next);
    setApiSession(next);
    queryClient.clear();
    setSession(next);
  };

  if (!session) return <SignIn onSignIn={update} />;

  return (
    <Routes>
      <Route element={<Layout live={live} onSignOut={() => update(null)} />}>
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<Applications />} />
        <Route path="endpoints" element={<Endpoints />} />
        <Route path="messages" element={<Messages />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="event-types" element={<EventTypes />} />
        <Route path="settings/organization" element={<Organization />} />
        <Route path="settings/api-keys" element={<ApiKeys />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
