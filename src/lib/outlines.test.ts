import {expect,it} from 'vitest';
import {outlineContentType,OUTLINE_LIMIT} from './outlines';
it('accepts PDF, HTML and HTM and normalizes their MIME types',()=>{
 for(const name of ['outline.html','outline.HTM'])expect(outlineContentType({name,type:'',size:1})).toBe('text/html');
 expect(outlineContentType({name:'outline.PDF',type:'',size:OUTLINE_LIMIT})).toBe('application/pdf');
 expect(outlineContentType({name:'outline',type:'text/html',size:1})).toBe('text/html');
});
it('rejects oversized and unsupported files',()=>{
 expect(()=>outlineContentType({name:'a.pdf',type:'application/pdf',size:OUTLINE_LIMIT+1})).toThrow('20 MB');
 expect(()=>outlineContentType({name:'a.txt',type:'text/plain',size:1})).toThrow('PDF or HTML');
});
