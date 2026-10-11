/**
 * Respire client error types
 */

export type RespireErrorCode =
  | 'runtime_unavailable'
  | 'runtime_unauthorized'
  | 'runtime_transport'
  | 'protocol_version_mismatch'
  | 'request_in_progress'
  | 'daemon_unavailable'
  | 'unknown';

export class RespireError extends Error {
  constructor(
    message: string,
    public code: RespireErrorCode = 'unknown',
    public response?: unknown
  ) {
    super(message);
    this.name = 'RespireError';
  }

  static unavailable(message = 'Respire runtime is not running'): RespireError {
    return new RespireError(message, 'runtime_unavailable');
  }

  static unauthorized(message = 'Unauthorized access to runtime'): RespireError {
    return new RespireError(message, 'runtime_unauthorized');
  }

  static transport(message: string): RespireError {
    return new RespireError(message, 'runtime_transport');
  }

  static protocolMismatch(message = 'Protocol version mismatch'): RespireError {
    return new RespireError(message, 'protocol_version_mismatch');
  }
}
