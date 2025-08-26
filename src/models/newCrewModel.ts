import mongoose, { Schema, Document } from 'mongoose';

export interface ICrew extends Document {
    airline: string;
    UserID: string;
    crewId: number;
    firstName: string;
    lastName: string;
    telephone: string;
    commuterAirportCode: string;
    hireDate: Date,
    base: string,
    otp: number;
    otpVerified: boolean;
    isActive: boolean;
    email: string;
    airport: string;
    password: string;
    role: string;
    avatar: mongoose.Types.ObjectId;
}

const NewCrewSchema: Schema = new Schema<ICrew>({
    airline: { type: String },
    UserID: { type: String },
    crewId: { type: Number },
    firstName: { type: String },
    lastName: { type: String },
    telephone: { type: String },
    commuterAirportCode: { type: String },
    hireDate: { type: Date },
    base: { type: String },
    otp: { type: Number },
    otpVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    email: { type: String },
    password: { type: String },
    airport: { type: String },
    role: {
        type: String,
        enum: ["admin", "Flight Attendant"],
        default: "Flight Attendant"
    },
    avatar: { type: Schema.Types.ObjectId, ref: 'Media' },
}, { timestamps: true });

export const NewCrew = mongoose.model<ICrew>('crews', NewCrewSchema, 'crews');
