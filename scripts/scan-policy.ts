// Credential-free scan policy, shared with its regression tests.
export function scanEnvironment(source:NodeJS.ProcessEnv){
 const env:NodeJS.ProcessEnv={};
 const allowed=new Set(['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','HOMEDRIVE','HOMEPATH','CODEX_HOME','HOME','LANG','LC_ALL']);
 for(const [key,value]of Object.entries(source))if(allowed.has(key.toUpperCase()))env[key]=value;
 return env;
}
export function scanPermissionArgs(){
 return ['-s','workspace-write','-c','approval_policy="never"'];
}
