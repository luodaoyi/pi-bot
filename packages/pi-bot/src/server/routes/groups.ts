/**
 * Group chat routes
<<<<<<< HEAD
 * TO BE IMPLEMENTED by parallel branch A
=======
>>>>>>> 6dfc7cc (feat: implement session pool, team coordination, and group chat)
 */

import type { Hono } from 'hono';
import type { Config } from '../../config.js';
import type { Store } from '../../store/index.js';
<<<<<<< HEAD

export function setupGroupRoutes(_app: Hono, _store: Store, _config: Config) {
  // TODO: Implement group routes:
  // - GET /api/groups (list groups)
  // - POST /api/groups (create group)
  // - GET /api/groups/:id (get group)
  // - PATCH /api/groups/:id (update group)
  // - DELETE /api/groups/:id (delete group)
  // - POST /api/groups/:id/messages (post to group)
  // - GET /api/groups/:id/messages (get group messages)
=======
import type { GroupManager } from '../../groups/index.js';
import type {
  GroupCreateRequest,
  GroupUpdateRequest,
  PostToGroupRequest,
} from '../../groups/types.js';

export function setupGroupRoutes(
  app: Hono,
  _store: Store,
  groupManager: GroupManager,
  _config: Config
) {
  /**
   * List all groups
   */
  app.get('/api/groups', async (c) => {
    const groups = groupManager.listGroups();
    return c.json({ success: true, data: { groups } });
  });

  /**
   * Get group by ID
   */
  app.get('/api/groups/:id', async (c) => {
    const groupId = c.req.param('id');
    const group = groupManager.getGroup(groupId);

    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    return c.json({ success: true, data: { group } });
  });

  /**
   * Create a new group
   */
  app.post('/api/groups', async (c) => {
    const body = (await c.req.json()) as GroupCreateRequest;

    try {
      const group = await groupManager.createGroup(body);
      return c.json({ success: true, data: { group } }, 201);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create group',
        },
        400
      );
    }
  });

  /**
   * Update group settings
   */
  app.patch('/api/groups/:id', async (c) => {
    const groupId = c.req.param('id');
    const body = (await c.req.json()) as GroupUpdateRequest;

    try {
      const group = await groupManager.updateGroup(groupId, body);
      return c.json({ success: true, data: { group } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update group',
        },
        400
      );
    }
  });

  /**
   * Delete a group
   */
  app.delete('/api/groups/:id', async (c) => {
    const groupId = c.req.param('id');

    try {
      await groupManager.deleteGroup(groupId);
      return c.json({ success: true, data: { success: true } });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete group',
        },
        400
      );
    }
  });

  /**
   * Post message to group and run round
   */
  app.post('/api/groups/:id/post', async (c) => {
    const groupId = c.req.param('id');
    const body = (await c.req.json()) as Omit<PostToGroupRequest, 'groupId'>;

    try {
      const result = await groupManager.postToGroup({
        groupId,
        ...body,
      });
      return c.json({ success: true, data: result });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to post to group',
        },
        400
      );
    }
  });

  /**
   * Get group chat history
   */
  app.get('/api/groups/:id/history', async (c) => {
    const groupId = c.req.param('id');
    const group = groupManager.getGroup(groupId);

    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    const limit = parseInt(c.req.query('limit') ?? '60', 10);
    const log = group.log.slice(-limit);

    return c.json({ success: true, data: { log } });
  });
>>>>>>> 6dfc7cc (feat: implement session pool, team coordination, and group chat)
}
