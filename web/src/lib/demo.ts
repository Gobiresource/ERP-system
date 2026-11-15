// The example data (lib/seed.ts, and the made-up attendance, leave balances, scans and chart history beside it) is for
// checks and demonstrations. The system itself starts empty, with nothing made up (the user's decision,
// docs/decisions.md, 2026-11-15). The examples come back only in a browser that asks for them by keeping '1' under
// 'erp:demo': the test scripts do, nothing on the screens does. Each keeps its data under its own key, so neither
// touches the other's.
export const DEMO = (() => {
  try {
    return localStorage.getItem('erp:demo') === '1'
  } catch {
    return false
  }
})()
