import {generateVAPIDKeys} from './web-push';
const keys=generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
