import {it,expect} from 'vitest';
import {scanResult,SIGNED_OUT_MARKER} from './scan-result';
it('does not report signed-out scans as completed',()=>{
 for(const message of [SIGNED_OUT_MARKER,'Sign-in check: signed-out','{"status":"signed-out"}','learn=signed-out'])expect(scanResult('completed',message)).toBe('needs_signin');
 expect(scanResult('completed','Review proposals')).toBe('completed');
 expect(scanResult('failed','Timeout')).toBe('failed');
});

it("ignores sign-in markers in diagnostic transcripts",()=>{
 const transcript="Runbook: "+SIGNED_OUT_MARKER;
 const finalResponse="Scan completed. Review proposals.";
 expect(scanResult("completed",finalResponse)).toBe("completed");
 expect(transcript).toContain(SIGNED_OUT_MARKER);
});
