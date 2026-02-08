"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = void 0;
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .trim();
}
exports.normalizeText = normalizeText;
