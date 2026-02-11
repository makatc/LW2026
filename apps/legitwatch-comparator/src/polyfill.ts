
import * as crypto from 'crypto';

if (!global.crypto) {
    console.log('Polyfilling global.crypto for Node.js < 19');
    // @ts-ignore
    global.crypto = {
        randomUUID: () => crypto.randomUUID(),
    };
}

// Polyfill for DOMMatrix and other browser APIs required by pdfjs-dist in Node 18
if (typeof global.DOMMatrix === 'undefined') {
    console.log('Polyfilling DOMMatrix for Node.js compatibility');
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix {
        constructor() { }
    };
}

if (typeof global.Path2D === 'undefined') {
    // @ts-ignore
    global.Path2D = class Path2D { };
}

if (typeof global.ImageData === 'undefined') {
    // @ts-ignore
    global.ImageData = class ImageData { };
}
