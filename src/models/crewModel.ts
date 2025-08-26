import mongoose, { Document, Schema, model } from 'mongoose';

// Interface for a single media document
export interface ICrew extends Document {
    UserID: string;
    CrewID: number;
    FirstName: string;
    LastName: string;
    HireDate: Date;
    Base: string;
}

// Mongoose schema definition
const CrewSchema = new Schema<ICrew>({
    UserID: {
        type: String
    },
    CrewID: {
        type: Number
    },
    FirstName: { type: String },
    LastName: { type: String },
    HireDate: { type: Date },
    Base: { type: String },
});

// Export the model
export const Crew = model<ICrew>('Crews', CrewSchema, 'Crews');
