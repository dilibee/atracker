// Credential-free scan policy, shared with its regression tests.
export function scanEnvironment(source:NodeJS.ProcessEnv){
 const env:NodeJS.ProcessEnv={};
 const allowed=new Set(['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','HOMEDRIVE','HOMEPATH','CODEX_HOME','HOME','LANG','LC_ALL']);
 for(const [key,value]of Object.entries(source))if(allowed.has(key.toUpperCase()))env[key]=value;
 return env;
}
export function scanPermissionArgs(){
 const config:Record<string,string>={
  default_permissions:'atracker-scan',approval_policy:'never',
  'permissions.atracker-scan.filesystem.":minimal"':'read',
  'permissions.atracker-scan.filesystem.":workspace_roots"."."':'read',
  'permissions.atracker-scan.filesystem.":workspace_roots".".env"':'deny',
  'permissions.atracker-scan.filesystem.":workspace_roots".".env.*"':'deny',
  'permissions.atracker-scan.filesystem.":workspace_roots"."data/browser"':'deny',
  'permissions.atracker-scan.filesystem.":workspace_roots"."scripts/server-db.ts"':'deny',
 };
 return ['--ignore-user-config','--strict-config',...Object.entries(config).flatMap(([key,value])=>['-c',key+'='+JSON.stringify(value)]),'-c','permissions.atracker-scan.network.enabled=true'];
}
