/**
 * GUI 客户端依赖的全部 HTTP 路由合同。
 * 合同测试对照此清单检查真实 Hono router 是否注册了对应 method+path。
 */
export interface RouteContract {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  /** 成功响应 data 中应出现的字段（health 为顶层字段） */
  dataKeys: string[];
  envelope?: boolean;
}

export const CLIENT_ROUTE_CONTRACT: RouteContract[] = [
  { method: 'GET', path: '/health', dataKeys: ['status', 'version'], envelope: false },
  { method: 'GET', path: '/api/health', dataKeys: ['status', 'version'], envelope: true },

  { method: 'GET', path: '/api/bots', dataKeys: ['bots'] },
  { method: 'POST', path: '/api/bots', dataKeys: ['bot'] },
  { method: 'GET', path: '/api/bots/:id', dataKeys: ['bot'] },
  { method: 'PATCH', path: '/api/bots/:id', dataKeys: ['bot'] },
  { method: 'DELETE', path: '/api/bots/:id', dataKeys: ['success'] },
  { method: 'GET', path: '/api/bots/:id/history', dataKeys: ['messages'] },
  { method: 'POST', path: '/api/bots/:id/chat', dataKeys: ['sessionId', 'runId'] },
  { method: 'POST', path: '/api/bots/:id/abort', dataKeys: ['aborted'] },
  { method: 'GET', path: '/api/bots/:id/sessions', dataKeys: ['sessions'] },
  { method: 'POST', path: '/api/bots/:id/sessions', dataKeys: ['session'] },
  { method: 'GET', path: '/api/bots/:id/sessions/:sid', dataKeys: ['session', 'messages', 'stats'] },
  { method: 'PATCH', path: '/api/bots/:id/sessions/:sid', dataKeys: ['session'] },
  { method: 'POST', path: '/api/bots/:id/sessions/:sid/activate', dataKeys: ['session'] },
  { method: 'POST', path: '/api/bots/:id/sessions/:sid/fork', dataKeys: ['session'] },
  { method: 'DELETE', path: '/api/bots/:id/sessions/:sid', dataKeys: ['success'] },
  { method: 'POST', path: '/api/bots/:botId/memory', dataKeys: ['entry'] },

  { method: 'GET', path: '/api/groups', dataKeys: ['groups'] },
  { method: 'POST', path: '/api/groups', dataKeys: ['group'] },
  { method: 'GET', path: '/api/groups/:id', dataKeys: ['group'] },
  { method: 'PATCH', path: '/api/groups/:id', dataKeys: ['group'] },
  { method: 'DELETE', path: '/api/groups/:id', dataKeys: ['success'] },
  { method: 'GET', path: '/api/groups/:id/history', dataKeys: ['log'] },
  { method: 'POST', path: '/api/groups/:id/post', dataKeys: [] },

  { method: 'GET', path: '/api/memory/status', dataKeys: ['available'] },
  { method: 'GET', path: '/api/memory/search', dataKeys: ['available', 'entries'] },
  { method: 'GET', path: '/api/memory/summary', dataKeys: ['summary'] },
  { method: 'GET', path: '/api/memory/:id', dataKeys: ['available'] },
  { method: 'POST', path: '/api/memory/recall', dataKeys: ['available'] },
  { method: 'POST', path: '/api/memory/remember', dataKeys: [] },
  { method: 'PATCH', path: '/api/memory/:id', dataKeys: [] },
  { method: 'DELETE', path: '/api/memory/:id', dataKeys: [] },

  { method: 'GET', path: '/api/tasks', dataKeys: ['schedules'] },
  { method: 'POST', path: '/api/tasks', dataKeys: ['schedule'] },
  { method: 'GET', path: '/api/tasks/:id', dataKeys: ['schedule'] },
  { method: 'PATCH', path: '/api/tasks/:id', dataKeys: ['schedule'] },
  { method: 'DELETE', path: '/api/tasks/:id', dataKeys: ['success'] },
  { method: 'POST', path: '/api/tasks/:id/toggle', dataKeys: ['schedule'] },

  { method: 'GET', path: '/api/secrets', dataKeys: ['secrets'] },
  { method: 'POST', path: '/api/secrets', dataKeys: ['success'] },
  { method: 'POST', path: '/api/secrets/:name/approve', dataKeys: ['success'] },
  { method: 'POST', path: '/api/secrets/:name/revoke', dataKeys: ['success'] },
  { method: 'DELETE', path: '/api/secrets/:name', dataKeys: ['success'] },
  { method: 'GET', path: '/api/secrets/:name/value', dataKeys: ['value'] },

  { method: 'GET', path: '/api/usage', dataKeys: ['stats'] },
  { method: 'GET', path: '/api/usage/records', dataKeys: ['records', 'total'] },
  { method: 'GET', path: '/api/usage/stats', dataKeys: ['aggregations', 'stats'] },
  { method: 'GET', path: '/api/usage/bots/:botId/stats', dataKeys: ['stats'] },
  { method: 'POST', path: '/api/usage/cleanup', dataKeys: ['deletedCount'] },

  { method: 'GET', path: '/api/settings', dataKeys: ['settings'] },
  { method: 'PATCH', path: '/api/settings', dataKeys: ['settings'] },

  { method: 'GET', path: '/api/models', dataKeys: ['models', 'defaultModel', 'defaultThinking'] },
  { method: 'GET', path: '/api/providers', dataKeys: ['providers'] },
  { method: 'PUT', path: '/api/providers/:id/api-key', dataKeys: ['configured'] },
  { method: 'DELETE', path: '/api/providers/:id/auth', dataKeys: ['configured'] },
  { method: 'POST', path: '/api/providers/:id/oauth/start', dataKeys: ['url', 'flowId'] },
  { method: 'GET', path: '/api/providers/:id/oauth/:flowId', dataKeys: ['status'] },

  { method: 'GET', path: '/api/system/status', dataKeys: ['version', 'respireStatus'] },
  { method: 'GET', path: '/api/system/models', dataKeys: ['models', 'defaultModel', 'defaultThinking'] },
  { method: 'POST', path: '/api/shutdown', dataKeys: [] },
];
