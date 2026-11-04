export const SIGNED_OUT_MARKER = 'ATRACKER_SCAN_NEEDS_SIGNIN';
export function scanResult(status: string, summary: string) {
  return summary.includes(SIGNED_OUT_MARKER) || /(?:"status"\s*:\s*"signed-out"|learn=signed-out|sign-in check:\s*signed.out)/i.test(summary)
    ? 'needs_signin' : status;
}
