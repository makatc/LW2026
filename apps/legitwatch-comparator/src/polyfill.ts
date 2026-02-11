
import * as crypto from 'crypto';

if (!global.crypto) {
    console.log('Polyfilling global.crypto for Node.js < 19');
    // @ts-ignore
    global.crypto = {
        randomUUID: () => crypto.randomUUID(),
    };
}
