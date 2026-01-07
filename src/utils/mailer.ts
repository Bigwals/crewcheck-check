import nodemailer from 'nodemailer';
import { otpEmailTemplate, passwordEmailTemplate } from '../templates/otpEmailTemplate';

const transporter = nodemailer.createTransport({
    service: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: true,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
    },
});

export const sendOtpEmail = async (to: string, firstName: string, otp: string) => {
    console.log(firstName, otp);
    const html = otpEmailTemplate(otp, firstName);
    const subject = "Your OTP Code"
    const info = await transporter.sendMail({
        from: process.env.MAIL_USER,
        to,
        subject,
        html,
    });
    console.log("Email Sent: %s", info.messageId);
};
    
export const sendPasswordEmail = async (to: string, email: string, password: string): Promise<any> => {
    console.log(email, password);
    const html = passwordEmailTemplate(password, email);
    const subject = "Your Password Code"
    const info = await transporter.sendMail({
        from: process.env.MAIL_USER,
        to,
        subject,
        html,
    });
    console.log("Email Sent: %s", info.messageId);
};
    