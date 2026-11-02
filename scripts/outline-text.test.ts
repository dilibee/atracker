import {expect,it} from 'vitest';
import {htmlOutlineText} from './outline-text';
it('extracts readable HTML dates and entities without executing scripts or retaining styles',async()=>{
 const text=await htmlOutlineText('<h1>ECE &amp; math</h1><table><tr><td>Quiz</td><td>November 15, 2026</td></tr></table><script>document.body.textContent="executed"</script><style>hidden{color:red}</style>');
 expect(text).toContain('ECE & math');expect(text).toContain('November 15, 2026');expect(text).toMatch(/Quiz\s+November/);expect(text).not.toContain('executed');expect(text).not.toContain('color:red');expect(text).not.toContain('<td>');
},20000);
