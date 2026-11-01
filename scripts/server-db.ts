// Only trusted scripts load credentials. Never print environment variables or keys.
import 'dotenv/config';
import {createClient} from '@supabase/supabase-js';
export function serverDB(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
export function owner(){const id=process.env.ATRACKER_USER_ID;if(!id||!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Configure ATRACKER_USER_ID with your Supabase auth user UUID.');return id}
