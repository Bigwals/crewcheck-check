"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpModel = void 0;
const mongoose_1 = require("mongoose");
// Mongoose schema definition
const OtpSchema = new mongoose_1.Schema({
    crewId: { type: Number },
    password: { type: String },
}, { timestamps: true });
// Export the model
exports.OtpModel = (0, mongoose_1.model)('otp', OtpSchema);
