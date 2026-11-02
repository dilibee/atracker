import {expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {htmlOutlineText} from './outline-text';
import {diagnostic,redact,launchCodex} from './codex-runner';
const mocks=vi.hoisted(()=>({spawn:vi.fn(()=>({stdin:{on:vi.fn(),end:vi.fn()}})),exists:vi.fn((path:string)=>path.includes('Roaming'))}));
vi.mock('node:child_process',()=>({spawn:mocks.spawn}));
vi.mock('node:fs',()=>({existsSync:mocks.exists}));
it('extracts the HTML fixture without a browser',async()=>{
 const text=await htmlOutlineText(await readFile(new URL('./fixtures/outline.html',import.meta.url),'utf8'));
 expect(text).toContain('ECE 150 Fall 2026');expect(text).toContain('November 15, 2026 at 11:59 PM');expect(text).toContain('Quiz & review –');expect(text).not.toContain('must not execute');
});
it('falls back to APPDATA npm on minimal PATH, passing untrusted prompt over stdin',()=>{
 const before=process.env.PATH,app=process.env.APPDATA;process.env.PATH='';process.env.APPDATA='C:/Users/Me/AppData/Roaming';
 try{launchCodex('untrusted $(secret)','summary.txt');const [command,args,options]=mocks.spawn.mock.calls[0] as unknown as [string,string[],{env:NodeJS.ProcessEnv}];expect(command).toBe(process.execPath);expect(args).toContain('workspace-write');expect(args).not.toContain('untrusted $(secret)');expect(options.env).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')}finally{if(before===undefined)delete process.env.PATH;else process.env.PATH=before;if(app===undefined)delete process.env.APPDATA;else process.env.APPDATA=app}
});
it('keeps exit status and only last forty stderr lines, redacting credentials',()=>{
 const output=diagnostic(2,null,Array.from({length:50},(_,i)=>'line '+i).join('\n')+'\nAuthorization: Bearer fake-token');
 expect(output).toContain('exit code: 2');expect(output).not.toContain('line 0\n');expect(output).not.toContain('fake-token');expect(redact('key=sk-secret123')).not.toContain('sk-secret123');
});
