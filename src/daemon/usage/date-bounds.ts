/**
 * GUI / period 查询传 YYYY-MM-DD。ISO timestamp 字面量比较时
 * `2026-10-11T16:00:00Z` > `2026-10-11`，会把当天记录全部排除。
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function boundStartDate(value: string): string {
  return DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value;
}

export function boundEndDate(value: string): string {
  return DATE_ONLY.test(value) ? `${value}T23:59:59.999Z` : value;
}
