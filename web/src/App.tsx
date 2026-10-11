import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { BotsView } from './views/BotsView';
import { MemoryView } from './views/MemoryView';
import { TasksView } from './views/TasksView';
import { SettingsView } from './views/SettingsView';
import { GroupsView } from './views/GroupsView';
import { SecretsView } from './views/SecretsView';
import { UsageView } from './views/UsageView';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/bots" replace />} />
          <Route path="/bots" element={<BotsView />} />
          <Route path="/groups" element={<GroupsView />} />
          <Route path="/memory" element={<MemoryView />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/secrets" element={<SecretsView />} />
          <Route path="/usage" element={<UsageView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
