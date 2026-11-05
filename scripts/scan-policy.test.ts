import {it,expect} from 'vitest';
import {scanEnvironment,scanPermissionArgs} from './scan-policy';
it('allows only runtime environment and drops credentials and preload hooks',()=>{
 const env=scanEnvironment({Path:'node',APPDATA:'app',SUPABASE_SERVICE_ROLE_KEY:'fake',VITE_SUPABASE_ANON_KEY:'fake',VAPID_PRIVATE_KEY:'fake',customCredential:'fake',NODE_OPTIONS:'--import malicious',DOTENV_CONFIG_PATH:'private'});
 expect(env).toEqual({Path:'node',APPDATA:'app'});
});
it('uses supported sandbox flags without unsafe fallback',()=>{
 expect(scanPermissionArgs()).toEqual(['-s','workspace-write','-c','approval_policy="never"']);
});

it('preserves Windows identity and system paths without allowing arbitrary credentials',()=>{
 const runtime={USERPROFILE:'fake-profile',USERNAME:'fake-user',USERDOMAIN:'fake-domain',HOMEDRIVE:'C:',HOMEPATH:'fake-home',SystemRoot:'fake-windows'};
 expect(scanEnvironment({...runtime,SECRET:'fake'})).toEqual(runtime);
});
