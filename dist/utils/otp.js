"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOtp = exports.saveOtp = exports.generateOtp = void 0;
const newCrewModel_1 = require("../models/newCrewModel");
const generateOtp = async () => {
    return Math.floor(100000 + Math.random() * 900000);
};
exports.generateOtp = generateOtp;
const saveOtp = async (email, otp) => {
    const crew = await newCrewModel_1.NewCrew.findOne({ email });
    if (crew) {
        crew.otp = otp;
        crew.otpVerified = false;
        return await crew.save();
    }
    return false;
};
exports.saveOtp = saveOtp;
const deleteOtp = async (email) => {
    const crew = await newCrewModel_1.NewCrew.findOne({ email });
    if (crew) {
        crew.otp = 0;
        crew.otpVerified = true;
        return await crew.save();
    }
    return false;
};
exports.deleteOtp = deleteOtp;
