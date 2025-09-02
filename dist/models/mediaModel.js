"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Media = void 0;
const mongoose_1 = require("mongoose");
// Mongoose schema definition
const MediaSchema = new mongoose_1.Schema({
    crewId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'crews', required: true },
    media: { type: String, required: true },
}, { timestamps: true });
// Export the model
exports.Media = (0, mongoose_1.model)('Media', MediaSchema);
