/**
 * Scheduler extension for pi agent
 * Provides tools for bots to manage their own scheduled tasks
 */

import { Type } from '@sinclair/typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { Scheduler } from '../scheduler/index.js';

export interface SchedulerExtensionOptions {
  scheduler: Scheduler;
  getCurrentBotId: () => string;
}

export function createSchedulerExtension(options: SchedulerExtensionOptions) {
  return (pi: ExtensionAPI) => {
    const { scheduler, getCurrentBotId } = options;

    // schedule_create tool
    pi.registerTool({
      name: 'schedule_create',
      label: 'Create Schedule',
      description: 'Create a scheduled task that will deliver a prompt to you at a specified time',
      parameters: Type.Object({
        prompt: Type.String({ description: 'The prompt to deliver when the task triggers' }),
        timeType: Type.Union([
          Type.Literal('cron'),
          Type.Literal('daily'),
          Type.Literal('weekly'),
          Type.Literal('every'),
        ], { description: 'Type of schedule' }),
        time: Type.String({
          description: 'Schedule specification: cron expression, HH:mm for daily, "day HH:mm" for weekly (day 0-6), or interval like "1h", "30m" for every',
        }),
        timezone: Type.Optional(Type.String({ description: 'IANA timezone (default: UTC)' })),
        missedPolicy: Type.Optional(
          Type.Union([Type.Literal('run-once'), Type.Literal('skip')], {
            description: 'What to do if a run was missed while offline (default: run-once)',
          })
        ),
      }),
      async execute(_id, params) {
        try {
          const botId = getCurrentBotId();
          const schedule = await scheduler.create({
            botId,
            prompt: params.prompt,
            timeType: params.timeType,
            time: params.time,
            timezone: params.timezone,
            missedPolicy: params.missedPolicy,
          });

          return {
            content: [
              {
                type: 'text',
                text: `✓ Created schedule ${schedule.id}\nNext run: ${schedule.nextRun || 'calculating...'}`,
              },
            ],
            details: undefined,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to create schedule: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: undefined,
            isError: true,
          };
        }
      },
    });

    // schedule_list tool
    pi.registerTool({
      name: 'schedule_list',
      label: 'List Schedules',
      description: 'List all your scheduled tasks',
      parameters: Type.Object({}),
      async execute() {
        try {
          const botId = getCurrentBotId();
          const schedules = await scheduler.list(botId);

          if (schedules.length === 0) {
            return {
              content: [{ type: 'text', text: 'No scheduled tasks.' }],
              details: undefined,
            };
          }

          const lines = schedules.map((s) => {
            const status = s.enabled ? '✓' : '✗';
            const nextRun = s.nextRun ? new Date(s.nextRun).toLocaleString() : 'N/A';
            return `${status} ${s.id}: ${s.prompt.slice(0, 50)}... | Next: ${nextRun}`;
          });

          return {
            content: [
              {
                type: 'text',
                text: `Your scheduled tasks:\n${lines.join('\n')}`,
              },
            ],
            details: undefined,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to list schedules: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: undefined,
            isError: true,
          };
        }
      },
    });

    // schedule_cancel tool
    pi.registerTool({
      name: 'schedule_cancel',
      label: 'Cancel Schedule',
      description: 'Cancel a scheduled task',
      parameters: Type.Object({
        scheduleId: Type.String({ description: 'The ID of the schedule to cancel' }),
      }),
      async execute(_id, params) {
        try {
          const botId = getCurrentBotId();
          const schedule = await scheduler.get(params.scheduleId);

          if (!schedule) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Schedule not found: ${params.scheduleId}`,
                },
              ],
              details: undefined,
              isError: true,
            };
          }

          // Verify ownership
          if (schedule.botId !== botId) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'You can only cancel your own scheduled tasks.',
                },
              ],
              details: undefined,
              isError: true,
            };
          }

          await scheduler.delete(params.scheduleId);

          return {
            content: [
              {
                type: 'text',
                text: `✓ Cancelled schedule ${params.scheduleId}`,
              },
            ],
            details: undefined,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to cancel schedule: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: undefined,
            isError: true,
          };
        }
      },
    });
  };
}
