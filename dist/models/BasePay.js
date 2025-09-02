"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePay = void 0;
const mongoose_1 = require("mongoose");
const BasePaySchema = new mongoose_1.Schema({
    YearsOfService: { type: Number },
    Pay_10_1_24: { type: String },
    Pay_10_1_25: { type: String },
    Pay_10_1_26: { type: String },
    Pay_10_1_27: { type: String },
    Pay_10_1_28: { type: String },
});
exports.BasePay = (0, mongoose_1.model)('BasePay', BasePaySchema, 'BasePay');
