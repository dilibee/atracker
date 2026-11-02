import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve,delimiter,dirname} from 'node:path';
import {scanEnvironment,scanPermissionArgs} from './scan-policy';
export function redact(text:string){return text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]').replace(/\b(?:sb_secret_|sk-|ghp_)[A-Za-z0-9_-]+/g,'[REDACTED KEY]').replace(/(Bearer\s+|(?:token|password|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi,'$1[REDACTED]')}
export function launchCodex(prompt:string,summary:string,extra:string[]=[],env=scanEnvironment(process.env)){
 const app=process.env.APPDATA;
 const pathKey=Object.keys(env).find(key=>key.toUpperCase()==='PATH')||'PATH';
 env[pathKey]=[dirname(process.execPath),...(app?[resolve(app,'npm')]:[]),env[pathKey]||''].join(delimiter);
 const candidates=[...(process.env.PATH||process.env.Path||'').split(delimiter).map(p=>resolve(p,process.platform==='win32'?'codex.cmd':'codex')), ...(app?[resolve(app,'npm/codex.cmd')]:[])];
 const command=candidates.find(p=>existsSync(p));
 if(!command)throw new Error('Codex CLI not found on PATH or in APPDATA/npm.');
 const js=resolve(command,'../node_modules/@openai/codex/bin/codex.js');
 const args=['exec',...scanPermissionArgs(),'--output-last-message',summary,...extra,'-'];
 // npm's JS entrypoint avoids cmd.exe argument parsing. Fallback .cmd needs a shell.
 const child=existsSync(js)?spawn(process.execPath,[js,...args],{env,windowsHide:true,stdio:'pipe'}):spawn(command,args,{env,windowsHide:true,shell:process.platform==='win32',stdio:'pipe'});
 child.stdin.on('error',()=>{});child.stdin.end(prompt);return child;
}
export function diagnostic(code:number|null,signal:string|null,stderr:string){return redact(`Codex exit code: ${code}; signal: ${signal||'none'}\n`+stderr.trim().split(/\r?\n/).slice(-40).join('\n'))}
