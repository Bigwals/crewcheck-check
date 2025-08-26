export const otpEmailTemplate = (otp: number, firstName: string) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; background-color: #f9f9f9; text-align: center;">
        <h2 style="color: #333;">Hello ${firstName},</h2>
        <p style="font-size: 16px;">Thank you for registering with us.</p>
        <p style="font-size: 16px;">Your One-Time Password (OTP) for email verification is:</p>
        <div style="font-size: 24px; font-weight: bold; color: #0d6efd; margin: 20px 0;">${otp}</div>
        <p style="font-size: 14px; color: #555;">This OTP will expire in 2 minutes.</p>
        <p style="font-size: 14px; color: #999;">If you didn’t request this, please ignore this email.</p>
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #bbb;">&copy; ${new Date().getFullYear()} Crew Check. All rights reserved.</p>
      </div>
    `;
};

export const passwordEmailTemplate = (password: string, email: string) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; background-color: #f9f9f9; text-align: center;">
        <h2 style="color: #333;">Hello ${email},</h2>
        <p style="font-size: 16px;">Your Password for email is:</p>
        <div style="font-size: 24px; font-weight: bold; color: #0d6efd; margin: 20px 0;">${password}</div>
        <p style="font-size: 14px; color: #999;">If you didn’t request this, please ignore this email.</p>
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #bbb;">&copy; ${new Date().getFullYear()} Crew Check. All rights reserved.</p>
      </div>
    `;
};
