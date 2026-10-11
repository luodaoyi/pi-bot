import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary, PageErrorBoundary } from './components/ErrorBoundary';
import { BotsView } from './views/BotsView';
import { MemoryView } from './views/MemoryView';
import { TasksView } from './views/TasksView';
import { SettingsView } from './views/SettingsView';
import { GroupsView } from './views/GroupsView';
import { SecretsView } from './views/SecretsView';
import { UsageView } from './views/UsageView';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/bots" replace />} />
            <Route path="/bots" element={<PageErrorBoundary pageName="机器人"><BotsView /></PageErrorBoundary>} />
            <Route path="/groups" element={<PageErrorBoundary pageName="群组"><GroupsView /></PageErrorBoundary>} />
            <Route path="/memory" element={<PageErrorBoundary pageName="记忆"><MemoryView /></PageErrorBoundary>} />
            <Route path="/tasks" element={<PageErrorBoundary pageName="任务"><TasksView /></PageErrorBoundary>} />
            <Route path="/secrets" element={<PageErrorBoundary pageName="密钥"><SecretsView /></PageErrorBoundary>} />
            <Route path="/usage" element={<PageErrorBoundary pageName="用量"><UsageView /></PageErrorBoundary>} />
            <Route path="/settings" element={<PageErrorBoundary pageName="设置"><SettingsView /></PageErrorBoundary>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
