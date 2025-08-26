import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    airline: string;
    crewId: string;
    firstName: string;
    lastName: string;
    telephone: string;
    commuterAirportCode: string;
    otp: number;
    otpVerified: boolean;
    isActive: boolean;
    email: string;
    password: string;
    role: string;
    avatar: mongoose.Types.ObjectId;
}

const UserSchema: Schema = new Schema<IUser>({
    airline: { type: String, required: true },
    crewId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    telephone: { type: String, required: true },
    commuterAirportCode: { type: String, required: true },
    otp: { type: Number, required: true },
    otpVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ["admin", "Flight Attendant"],
        default: "Flight Attendant"
    },
    avatar: { type: Schema.Types.ObjectId, ref: 'Media'},
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
