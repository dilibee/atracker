import {it,expect} from 'vitest';
import {scanEnvironment,scanPermissionArgs} from './scan-policy';
it('allows only runtime environment and drops credentials and preload hooks',()=>{
 const env=scanEnvironment({Path:'node',APPDATA:'app',SUPABASE_SERVICE_ROLE_KEY:'fake',VITE_SUPABASE_ANON_KEY:'fake',VAPID_PRIVATE_KEY:'fake',customCredential:'fake',NODE_OPTIONS:'--import malicious',DOTENV_CONFIG_PATH:'private'});
 expect(env).toEqual({Path:'node',APPDATA:'app'});
});
it('requires strict profiles with explicit secret read denials and no sandbox fallback',()=>{
 const args=scanPermissionArgs();
 expect(args).toContain('--strict-config');expect(args).toContain('--ignore-user-config');
 expect(args).toContain('default_permissions="atracker-scan"');
 for(const path of ['.env','.env.*','data/browser','scripts/server-db.ts'])expect(args).toContain(`permissions.atracker-scan.filesystem.":workspace_roots".${JSON.stringify(path)}="deny"`);
 expect(args).not.toContain('--sandbox');
});
