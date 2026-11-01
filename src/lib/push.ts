import {setDoc,supabase} from './db';
export async function enablePush(){
 if(!supabase)throw new Error('Configure Supabase and sign in to enable synced reminders.');
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw new Error('Web push needs a supported browser. On iPhone, install to the Home Screen first (iOS 16.4+).');
 const key=import.meta.env.VITE_VAPID_PUBLIC_KEY;if(!key)throw new Error('Configure VITE_VAPID_PUBLIC_KEY first.');
 const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notification permission was not granted.');
 const registration=await navigator.serviceWorker.ready;
 const bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const sub=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
 await setDoc('pushSubs',Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub.endpoint))),b=>b.toString(16).padStart(2,'0')).join(''),sub.toJSON());
}
