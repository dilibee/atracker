import {it,expect} from 'vitest';
import {scanResult,SIGNED_OUT_MARKER} from './scan-result';
it('does not report signed-out scans as completed',()=>{
 for(const message of [SIGNED_OUT_MARKER,'Sign-in check: signed-out','{"status":"signed-out"}','learn=signed-out'])expect(scanResult('completed',message)).toBe('needs_signin');
 expect(scanResult('completed','Review proposals\nATRACKER_SCAN_COMPLETE')).toBe('completed');
 expect(scanResult('failed','Timeout')).toBe('failed');
});

it("ignores sign-in markers in diagnostic transcripts",()=>{
 const transcript="Runbook: "+SIGNED_OUT_MARKER;
 const finalResponse="Scan completed. Review proposals.\nATRACKER_SCAN_COMPLETE";
 expect(scanResult("completed",finalResponse)).toBe("completed");
 expect(transcript).toContain(SIGNED_OUT_MARKER);
});

it('fails the reported blocked scan even with exit zero',()=>{expect(scanResult('completed', '`at courses` and `at scan-context` failed with Node\'s "uv_os_get_passwd returned ENOMEM", and Playwright access "required approval"')).toBe('failed');expect(scanResult('failed','ATRACKER_SCAN_COMPLETE')).toBe('failed');expect(scanResult('completed','')).toBe('failed')});
