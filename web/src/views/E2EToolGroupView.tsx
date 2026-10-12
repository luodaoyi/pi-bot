import React, { useState } from 'react';
import { ToolCallGroup } from '@/components/chat/ToolCallGroup';
import type { PiToolCall, ToolDisplayMode } from '@/api/types';

const fixtureTools: PiToolCall[] = [
  {
    id: 't1',
    name: 'bash',
    arguments: { command: 'curl -s https://wttr.in' },
    result: JSON.stringify({
      content: [{ type: 'text', text: 'Sunny, 22°C' }],
      structuredContent: { exit_code: 0 },
      truncated: false,
    }),
    status: 'success',
    durationMs: 1200,
  },
  {
    id: 't2',
    name: 'bash',
    arguments: { command: 'ls' },
    result: 'a.txt\nb.txt',
    status: 'success',
    durationMs: 80,
  },
  {
    id: 't3',
    name: 'pibot_create_session',
    arguments: { name: '天气调研', initialPrompt: '查一下今天天气' },
    result: '已创建会话 天气调研（sessionId=sess-weather，bot=Researcher）。',
    status: 'success',
    durationMs: 40,
  },
];

export const E2EToolGroupView: React.FC = () => {
  const [display] = useState<ToolDisplayMode>('collapsed');
  const [opened, setOpened] = useState<string>('');
  return (
    <div className="p-6 max-w-2xl" data-testid="e2e-tool-group-page">
      <h1 className="text-lg font-semibold mb-4">Tool group fixture</h1>
      <ToolCallGroup
        tools={fixtureTools}
        display={display}
        onOpenSession={(sessionId) => setOpened(sessionId)}
      />
      {opened && <div data-testid="opened-session">{opened}</div>}
    </div>
  );
};
