"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaSchema = void 0;
const zod_1 = require("zod");
exports.mediaSchema = zod_1.z.object({
    crewId: zod_1.z.string().min(1, "Crew ID is required"),
    media: zod_1.z.string().min(1, "Media is required"),
});
