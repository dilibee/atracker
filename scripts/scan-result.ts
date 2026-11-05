export const SIGNED_OUT_MARKER = 'ATRACKER_SCAN_NEEDS_SIGNIN';
export const COMPLETE_MARKER = 'ATRACKER_SCAN_COMPLETE';
export function scanResult(status: string, summary: string) {
  return summary.includes(SIGNED_OUT_MARKER) || /(?:"status"\s*:\s*"signed-out"|learn=signed-out|sign-in check:\s*signed.out)/i.test(summary)
    ? 'needs_signin' : status === 'completed' && summary.split(/\r?\n/).some(line => line.trim() === COMPLETE_MARKER) ? 'completed' : 'failed';
}
