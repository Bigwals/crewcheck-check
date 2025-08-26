import { Schema, model, Document } from 'mongoose';

interface IBasePay extends Document {
    YearsOfService: number;
    Pay_10_1_24: string;
    Pay_10_1_25: string;
    Pay_10_1_26: string;
    Pay_10_1_27: string;
    Pay_10_1_28: string;
}

const BasePaySchema = new Schema<IBasePay>({
    YearsOfService: { type: Number },
    Pay_10_1_24: { type: String },
    Pay_10_1_25: { type: String },
    Pay_10_1_26: { type: String },
    Pay_10_1_27: { type: String },
    Pay_10_1_28: { type: String },
});

export const BasePay = model<IBasePay>('BasePay', BasePaySchema, 'BasePay');
