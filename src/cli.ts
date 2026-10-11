#!/usr/bin/env node
/**
 * CLI entry point
 * Re-exports the daemon CLI
 */
export * from './daemon/cli.js';

// Import and run CLI if this is the main module
import './daemon/cli.js';
