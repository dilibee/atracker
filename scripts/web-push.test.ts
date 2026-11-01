import {it,expect} from 'vitest';
import {createECDH,randomBytes,hkdfSync,createDecipheriv,createPublicKey,verify} from 'node:crypto';
import {generateVAPIDKeys,encryptPayload,vapidAuthorization} from './web-push';
it('encrypts a payload that a receiver can decrypt per RFC 8291',()=>{
 const receiver=createECDH('prime256v1');receiver.generateKeys();const auth=randomBytes(16),pub=receiver.getPublicKey();
 const encrypted=encryptPayload({endpoint:'https://push.example/send',keys:{p256dh:pub.toString('base64url'),auth:auth.toString('base64url')}},'hello');
 const salt=encrypted.subarray(0,16),sender=encrypted.subarray(21,86),body=encrypted.subarray(86);
 const ikm=Buffer.from(hkdfSync('sha256',receiver.computeSecret(sender),auth,Buffer.concat([Buffer.from('WebPush: info\0'),pub,sender]),32));
 const key=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16)),nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const decipher=createDecipheriv('aes-128-gcm',key,nonce);decipher.setAuthTag(body.subarray(-16));expect(Buffer.concat([decipher.update(body.subarray(0,-16)),decipher.final()])).toEqual(Buffer.from('hello\x02'));expect(encrypted.readUInt32BE(16)).toBe(4096);
});
it('signs a valid VAPID JWT for the endpoint origin',()=>{const keys=generateVAPIDKeys(),authorization=vapidAuthorization('https://push.example/send','mailto:test@example.com',keys.publicKey,keys.privateKey);const token=authorization.split('t=')[1].split(',')[0],parts=token.split('.'),pub=Buffer.from(keys.publicKey,'base64url');const key=createPublicKey({key:{kty:'EC',crv:'P-256',x:pub.subarray(1,33).toString('base64url'),y:pub.subarray(33).toString('base64url')},format:'jwk'});expect(verify('sha256',Buffer.from(parts.slice(0,2).join('.')),{key,dsaEncoding:'ieee-p1363'},Buffer.from(parts[2],'base64url'))).toBe(true);expect(JSON.parse(Buffer.from(parts[1],'base64url').toString()).aud).toBe('https://push.example')});
