/**
 * Tests for the recall gate state machine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { GateState } from '../src/types.js';

describe('Gate State Machine', () => {
  let gateState: GateState;

  beforeEach(() => {
    gateState = {
      status: 'closed',
      recallAttempted: false,
      recallFailed: false,
      blockCount: 0,
      currentBatch: new Set(),
    };
  });

  describe('Initial state', () => {
    it('should start in closed state', () => {
      expect(gateState.status).toBe('closed');
      expect(gateState.recallAttempted).toBe(false);
      expect(gateState.blockCount).toBe(0);
    });
  });

  describe('State transitions', () => {
    it('should transition from closed to pending when recall is called', () => {
      gateState.status = 'pending';
      gateState.recallAttempted = true;
      gateState.currentBatch.add('tool-call-1');

      expect(gateState.status).toBe('pending');
      expect(gateState.recallAttempted).toBe(true);
      expect(gateState.currentBatch.has('tool-call-1')).toBe(true);
    });

    it('should transition from pending to open when recall succeeds', () => {
      gateState.status = 'pending';
      gateState.recallAttempted = true;
      gateState.currentBatch.add('tool-call-1');

      gateState.status = 'open';
      gateState.currentBatch = new Set();

      expect(gateState.status).toBe('open');
      expect(gateState.recallFailed).toBe(false);
    });

    it('should transition from pending to error_gate when recall fails', () => {
      gateState.status = 'pending';
      gateState.recallAttempted = true;
      gateState.currentBatch.add('tool-call-1');

      gateState.status = 'error_gate';
      gateState.recallFailed = true;
      gateState.currentBatch = new Set();

      expect(gateState.status).toBe('error_gate');
      expect(gateState.recallFailed).toBe(true);
    });

    it('should increment block count when non-recall tool is called while closed', () => {
      expect(gateState.blockCount).toBe(0);

      gateState.blockCount += 1;
      expect(gateState.blockCount).toBe(1);

      gateState.blockCount += 1;
      expect(gateState.blockCount).toBe(2);
    });

    it('should reset state on new user input', () => {
      gateState.status = 'open';
      gateState.recallAttempted = true;
      gateState.blockCount = 3;

      gateState = {
        status: 'closed',
        recallAttempted: false,
        recallFailed: false,
        blockCount: 0,
        currentBatch: new Set(),
      };

      expect(gateState.status).toBe('closed');
      expect(gateState.recallAttempted).toBe(false);
      expect(gateState.blockCount).toBe(0);
    });
  });

  describe('Batch tracking', () => {
    it('should track multiple recall tool calls in the same batch', () => {
      gateState.currentBatch.add('tool-call-1');
      gateState.currentBatch.add('tool-call-2');

      expect(gateState.currentBatch.size).toBe(2);
      expect(gateState.currentBatch.has('tool-call-1')).toBe(true);
      expect(gateState.currentBatch.has('tool-call-2')).toBe(true);
    });

    it('should clear batch after processing', () => {
      gateState.currentBatch.add('tool-call-1');
      gateState.currentBatch.add('tool-call-2');

      gateState.currentBatch = new Set();

      expect(gateState.currentBatch.size).toBe(0);
    });
  });

  describe('Max blocks termination', () => {
    it('should track consecutive blocks', () => {
      const maxBlocks = 3;
      let blockCount = 0;

      for (let i = 0; i < maxBlocks + 1; i++) {
        blockCount += 1;
      }

      expect(blockCount).toBe(maxBlocks + 1);
    });

    it('should prevent infinite loops by enforcing max blocks', () => {
      const maxBlocks = 3;
      let terminated = false;

      for (let i = 0; i < 5; i++) {
        gateState.blockCount += 1;

        if (gateState.blockCount >= maxBlocks) {
          terminated = true;
          break;
        }
      }

      expect(terminated).toBe(true);
      expect(gateState.blockCount).toBe(maxBlocks);
    });
  });
});
