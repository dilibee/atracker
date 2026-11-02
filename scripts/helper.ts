import {createServer} from 'node:http';
import {spawn,execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {scanEnvironment,scanPermissionArgs} from './scan-policy';
import {serverDB,owner} from './server-db';
const db=serverDB(),user_id=owner();let busy=false;let scanToken='';
const allowed=new Set([process.env.APP_ORIGIN,'http://localhost:5173','http://127.0.0.1:5173'].filter(Boolean));
const save=async(id:string,data:unknown)=>{const {error}=await db.from('atracker_docs').upsert({user_id,collection:'scanRuns',id,data});if(error)throw error};
createServer(async(req,res)=>{
 // Only a live scanning CLI can use this credential-free broker. No browser CORS.
 if(req.url==='/agent-cli'){
  if(req.method!=='POST'||!scanToken||req.headers.origin||req.headers.authorization!=='Bearer '+scanToken){res.writeHead(403);res.end();return}
  try{
   let body='';for await(const chunk of req){body+=chunk;if(body.length>100000){res.writeHead(413);res.end();return}}
   const argv:unknown=JSON.parse(body);
   if(!Array.isArray(argv)||argv.length>2||!argv.every(x=>typeof x==='string')||!['courses','outlines','propose','outline-done'].includes(argv[0]))throw new Error('Invalid CLI command');
   const env={...process.env};delete env.ATRACKER_SCAN_TOKEN;
   execFile(process.execPath,['--import','tsx',resolve('scripts/at.ts'),...argv],{env,windowsHide:true,timeout:120000,maxBuffer:8*1024*1024},(error,stdout)=>{res.writeHead(error?400:200,{'Content-Type':'text/plain'});res.end(error?'CLI failed; check proposal or local configuration.':stdout)});
  }catch{res.writeHead(400);res.end('Invalid CLI request')}
  return;
 }
 const origin=req.headers.origin;
 if(!req.headers.host||!['localhost:5199','127.0.0.1:5199'].includes(req.headers.host)||!origin||!allowed.has(origin)){res.writeHead(403);res.end('Origin not allowed');return}
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Private-Network','true');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 if(req.url==='/health'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,busy}));return}
 if(!['/scan','/outlines','/browser'].includes(req.url||'')||req.method!=='POST'){res.writeHead(404);res.end();return}
 if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415);res.end('JSON required');return}
 if(busy){res.writeHead(409);res.end('A scan or sign-in window is already open. Close the LEARN window or wait for the check to finish.');return}
 if(req.url==='/browser'){
  busy=true;
  const child=spawn(process.execPath,['--import','tsx',resolve('scripts/open-browser.ts')],{cwd:resolve('.'),env:scanEnvironment(process.env),windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
  child.once('error',()=>{busy=false;if(!res.headersSent){res.writeHead(500);res.end('Could not open the LEARN window.')}});
  child.on('message',(message:unknown)=>{if(res.headersSent)return;if(message&&typeof message==='object'&&'ready' in message){res.writeHead(202);res.end('LEARN sign-in window open')}else if(message&&typeof message==='object'&&'error' in message){res.writeHead(500);res.end(String(message.error))}});
  child.once('exit',()=>{busy=false;if(!res.headersSent){res.writeHead(500);res.end('LEARN window closed before sign-in was ready. Try again.')}});return;
 }
 const outlineOnly=req.url==='/outlines';
 busy=true;const id=randomUUID(),startedAt=new Date().toISOString();let log='';
 try{
  await save(id,{status:'running',startedAt,log:outlineOnly?'Checking outline dates':'Starting Codex scan'});
  await mkdir('data/scan-logs',{recursive:true});
  const summary=resolve('data/scan-logs',id+'.txt');
  // Resolve the installed JS entrypoint; do not use a shell to invoke user-controlled text.
  const npmRoot=process.env.APPDATA?resolve(process.env.APPDATA,'npm/node_modules/@openai/codex/bin/codex.js'):'';
  const toolDir=resolve('data/scan-tools');await mkdir(toolDir,{recursive:true});
  const mcpArgs=[resolve('node_modules/@playwright/mcp/cli.js').replace(/\\/g,'/'),'--ignore-roots','--output-dir',toolDir.replace(/\\/g,'/'),'--executable-path',chromium.executablePath().replace(/\\/g,'/'),'--user-data-dir',resolve('data/browser').replace(/\\/g,'/')];
  // Named permission profiles fail closed on unsupported Codex versions.
  const browserConfig=outlineOnly?[]:['-c',`mcp_servers.playwright.command=${JSON.stringify(process.execPath.replace(/\\/g,'/'))}`,'-c',`mcp_servers.playwright.cwd=${JSON.stringify(toolDir.replace(/\\/g,'/'))}`,'-c',`mcp_servers.playwright.args=${JSON.stringify(mcpArgs)}`];
  const args=[npmRoot,'exec',...scanPermissionArgs(),'--output-last-message',summary,...browserConfig,(outlineOnly?'Follow the OUTLINE-ONLY mode in docs/scan-runbook.md. Do not open LEARN or use Playwright. ':'Follow docs/scan-runbook.md completely. ')+'Never read .env, data/browser files, or any service-role key. Use only the at CLI for proposals. Process both PDF and HTML outlines through at outlines and mark each successfully reviewed file with outline-done. Do not commit, push, or deploy.'];
  const env=scanEnvironment(process.env);
  scanToken=randomUUID();env.ATRACKER_SCAN_TOKEN=scanToken;
  const child=spawn(process.execPath,args,{cwd:resolve('.'),env,windowsHide:true,stdio:['ignore','pipe','ignore']});
  // Save the final summary rather than the full browser/agent transcript.
  child.stdout.resume();
  const timeout=setTimeout(()=>{log='Scan exceeded 30 minutes';child.kill()},30*60*1000);
  let finished=false;
  const finish=async(status:string)=>{if(finished)return;finished=true;clearTimeout(timeout);try{const text=await readFile(summary,'utf8').catch(()=>'');await save(id,{status,startedAt,finishedAt:new Date().toISOString(),log:[log||status,text.slice(0,20000)].filter(Boolean).join('\n\n')})}catch{console.error('Could not save scan result')}finally{busy=false;scanToken=''}};
  child.once('error',()=>{log='Could not launch Codex. Install the Codex CLI and sign in.';void finish('failed')});child.once('exit',code=>{if(!log)log=code===0?'Scan completed. Review proposals.':'Codex scan failed; check local CLI configuration.';void finish(code===0?'completed':'failed')});
  res.writeHead(202,{'Content-Type':'application/json'});res.end(JSON.stringify({id}));
 }catch{busy=false;scanToken='';res.writeHead(500);res.end('Could not start scan; check local configuration.')}
}).listen(5199,'127.0.0.1',()=>console.log('ATracker helper listening on http://localhost:5199'));
