import mongoose, { Schema, Types, model } from "mongoose";

export interface IOtp extends Document {
    crewId: number;
    password: string;
}

// Mongoose schema definition
const OtpSchema = new Schema<IOtp>({
    crewId: { type: Number },
    password: { type: String },
}, { timestamps: true });

// Export the model
export const OtpModel = model<IOtp>('otp', OtpSchema);
