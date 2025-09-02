"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordEmail = exports.sendOtpEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const otpEmailTemplate_1 = require("../templates/otpEmailTemplate");
const transporter = nodemailer_1.default.createTransport({
    service: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
    },
});
const sendOtpEmail = async (to, firstName, otp) => {
    console.log(firstName, otp);
    const html = (0, otpEmailTemplate_1.otpEmailTemplate)(otp, firstName);
    const subject = "Your OTP Code";
    const info = await transporter.sendMail({
        from: process.env.MAIL_USER,
        to,
        subject,
        html,
    });
    console.log("Email Sent: %s", info.messageId);
};
exports.sendOtpEmail = sendOtpEmail;
const sendPasswordEmail = async (to, email, password) => {
    console.log(email, password);
    const html = (0, otpEmailTemplate_1.passwordEmailTemplate)(password, email);
    const subject = "Your Password Code";
    const info = await transporter.sendMail({
        from: process.env.MAIL_USER,
        to,
        subject,
        html,
    });
    console.log("Email Sent: %s", info.messageId);
};
exports.sendPasswordEmail = sendPasswordEmail;
