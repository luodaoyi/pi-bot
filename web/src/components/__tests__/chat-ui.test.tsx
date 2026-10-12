import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThinkingBlock } from '../chat/ThinkingBlock';
import { ToolCallCard } from '../chat/ToolCallCard';
import { ToolCallGroup } from '../chat/ToolCallGroup';
import { extractToolOutputText } from '@/api/normalize';
import { ChatError } from '../chat/ChatError';
import { ModelPicker } from '../models/ModelPicker';
import { SessionInfoPanel } from '../session/SessionInfoPanel';
import type { PiModel } from '@/api/types';
import { emptySessionStats } from '@/api/types';
import '@/i18n';

const models: PiModel[] = [
  { provider: 'deepseek', id: 'flash', name: 'Flash', contextWindow: 1, reasoning: false, input: ['text'], hasAuth: true },
  { provider: 'anthropic', id: 'sonnet', name: 'Sonnet', contextWindow: 1, reasoning: true, input: ['text'], hasAuth: false },
];

describe('chat UI pieces', () => {
  it('collapses thinking until clicked', () => {
    render(<ThinkingBlock text={'内部推理\n第二行内容'} />);
    expect(screen.getByTestId('thinking-block')).toBeTruthy();
    expect(document.querySelector('pre')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('pre')?.textContent).toContain('第二行内容');
  });

  it('renders tool card args and error state', () => {
    render(
      <ToolCallCard
        tool={{
          id: 't1',
          name: 'bash',
          arguments: { command: 'ls' },
          result: 'permission denied',
          status: 'error',
          isError: true,
        }}
        defaultOpen
      />
    );
    expect(screen.getByTestId('tool-card').getAttribute('data-tool-status')).toBe('error');
    expect(screen.getByText('bash')).toBeTruthy();
    expect(screen.getByText('permission denied')).toBeTruthy();
  });

  it('collapses consecutive tools into one group by default', () => {
    render(
      <ToolCallGroup
        tools={[
          {
            id: 't1',
            name: 'bash',
            arguments: { command: 'curl weather' },
            result: JSON.stringify({ content: [{ type: 'text', text: 'sunny' }], structuredContent: {} }),
            status: 'success',
          },
          { id: 't2', name: 'bash', arguments: { command: 'ls' }, result: 'ok', status: 'success' },
          { id: 't3', name: 'read', arguments: { path: 'a.txt' }, result: 'file', status: 'success' },
        ]}
      />
    );
    const group = screen.getByTestId('tool-group');
    expect(group.getAttribute('data-open')).toBe('false');
    expect(group.textContent).toMatch(/已执行 3 个工具/);
    expect(group.textContent).toMatch(/bash ×2/);
    expect(screen.queryByTestId('tool-group-list')).toBeNull();
    // 默认折叠：详情列表未挂载
    expect(document.body.textContent).toMatch(/已执行 3 个工具|Ran 3 tools/);
    fireEvent.click(screen.getByTestId('tool-group-toggle'));
    expect(group.getAttribute('data-open')).toBe('true');
    expect(screen.getByTestId('tool-group-list')).toBeTruthy();
    expect(screen.getAllByTestId('tool-card')).toHaveLength(3);
    expect(screen.queryByText(/structuredContent/)).toBeNull();
  });

  it('shows created-session link and strips JSON envelopes', () => {
    expect(
      extractToolOutputText({
        content: [{ type: 'text', text: 'plain out' }],
        structuredContent: { exit_code: 0 },
        truncated: false,
      })
    ).toBe('plain out');

    render(
      <ToolCallGroup
        tools={[
          {
            id: 't1',
            name: 'pibot_create_session',
            arguments: { name: '天气调研', initialPrompt: '查天气' },
            result: '已创建会话 天气调研（sessionId=sess-weather，bot=Researcher）。',
            status: 'success',
          },
        ]}
      />
    );
    expect(screen.getByTestId('created-session-link').textContent).toMatch(/已创建会话/);
  });

  it('shows actionable auth hint', () => {
    render(
      <MemoryRouter>
        <ChatError error="No API key found for openai." />
      </MemoryRouter>
    );
    expect(screen.getByTestId('chat-error').textContent).toContain('openai');
    expect(screen.getByRole('link').getAttribute('href')).toBe('/settings?tab=providers');
  });

  it('groups models and disables unauthenticated ones', () => {
    const onChange = vi.fn();
    render(<ModelPicker models={models} value={null} onChange={onChange} />);
    const select = screen.getByTestId('model-picker-select') as HTMLSelectElement;
    const disabled = Array.from(select.options).find((o) => o.value === 'anthropic/sonnet');
    expect(disabled?.disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'deepseek/flash' } });
    expect(onChange).toHaveBeenCalledWith({ provider: 'deepseek', id: 'flash' });
  });

  it('renders context usage bar', () => {
    render(
      <SessionInfoPanel
        model={{ provider: 'deepseek', id: 'flash' }}
        thinking="medium"
        stats={{
          ...emptySessionStats(),
          tokens: { input: 10, output: 4, cacheRead: 8, cacheWrite: 1, total: 23 },
          cost: 0.01,
          contextUsage: { tokens: 2000, contextWindow: 10000, percent: 20 },
        }}
        followLabel="follow"
      />
    );
    expect(screen.getByTestId('session-info')).toBeTruthy();
    expect(screen.getByTestId('context-usage-bar').textContent).toContain('20.0%');
    expect(screen.getByTestId('session-cost').textContent).toContain('0.0100');
  });
});
