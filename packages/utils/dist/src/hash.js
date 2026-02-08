"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateHash = void 0;
const crypto_1 = require("crypto");
function calculateHash(content) {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    return (0, crypto_1.createHash)('sha256').update(str).digest('hex');
}
exports.calculateHash = calculateHash;
