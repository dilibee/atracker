// RFC 8291 aes128gcm payload encryption and RFC 8292 VAPID, using Node crypto.
import {createECDH,createPrivateKey,createCipheriv,hkdfSync,randomBytes,sign} from 'node:crypto';
export interface PushSubscription {endpoint:string;keys:{p256dh:string;auth:string}}
export function generateVAPIDKeys(){const ecdh=createECDH('prime256v1');ecdh.generateKeys();return {publicKey:ecdh.getPublicKey().toString('base64url'),privateKey:ecdh.getPrivateKey().toString('base64url')}}
export function encryptPayload(subscription:PushSubscription,payload:string){
 const receiver=Buffer.from(subscription.keys.p256dh,'base64url'),auth=Buffer.from(subscription.keys.auth,'base64url');
 const sender=createECDH('prime256v1');sender.generateKeys();const pub=sender.getPublicKey(),salt=randomBytes(16);
 const ikm=Buffer.from(hkdfSync('sha256',sender.computeSecret(receiver),auth,Buffer.concat([Buffer.from('WebPush: info\0'),receiver,pub]),32));
 const key=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
 const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const plain=Buffer.concat([Buffer.from(payload),Buffer.from([2])]);if(plain.length+16>4096)throw new Error('Push payload too large');
 const cipher=createCipheriv('aes-128-gcm',key,nonce),encrypted=Buffer.concat([cipher.update(plain),cipher.final(),cipher.getAuthTag()]);
 const recordSize=Buffer.alloc(4);recordSize.writeUInt32BE(4096);return Buffer.concat([salt,recordSize,Buffer.from([pub.length]),pub,encrypted]);
}
export function vapidAuthorization(endpoint:string,subject:string,publicKey:string,privateKey:string){
 if(!/^(mailto:|https:\/\/)/.test(subject))throw new Error('VAPID_SUBJECT must be a contact mailto: or https: URL');
 const pub=Buffer.from(publicKey,'base64url');if(pub.length!==65)throw new Error('Invalid VAPID public key');
 const key=createPrivateKey({key:{kty:'EC',crv:'P-256',x:pub.subarray(1,33).toString('base64url'),y:pub.subarray(33).toString('base64url'),d:privateKey},format:'jwk'});
 const header=Buffer.from(JSON.stringify({typ:'JWT',alg:'ES256'})).toString('base64url');
 const claims=Buffer.from(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+12*3600,sub:subject})).toString('base64url');
 const unsigned=`${header}.${claims}`,signature=sign('sha256',Buffer.from(unsigned),{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return `vapid t=${unsigned}.${signature}, k=${publicKey}`;
}
export async function sendNotification(subscription:PushSubscription,payload:string){
 const endpoint=new URL(subscription.endpoint);if(endpoint.protocol!=='https:')throw new Error('Push endpoint requires HTTPS');
 const body=encryptPayload(subscription,payload);
 const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:vapidAuthorization(subscription.endpoint,process.env.VAPID_SUBJECT||'',process.env.VAPID_PUBLIC_KEY||'',process.env.VAPID_PRIVATE_KEY||''),'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'3600'},body:new Uint8Array(body)});
 if(!response.ok)throw Object.assign(new Error('Push request failed'),{statusCode:response.status});
}
