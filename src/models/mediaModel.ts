import mongoose, { Document, Schema, model } from 'mongoose';

// Interface for a single media document
export interface IMedia extends Document {
  crewId: mongoose.Types.ObjectId;
  media: string;
}

// Mongoose schema definition
const MediaSchema = new Schema<IMedia>({
  crewId: { type: Schema.Types.ObjectId, ref: 'crews', required: true },
  media: { type: String, required: true },
}, { timestamps: true });

// Export the model
export const Media = model<IMedia>('Media', MediaSchema);
