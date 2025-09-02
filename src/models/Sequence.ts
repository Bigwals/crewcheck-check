import { Schema, model, Document } from 'mongoose';

interface ISequence extends Document {
    UniqueSeqNo: number;
    SeqNo: number;
    CrewBase: string;
    SeqCategory: string;
    SeqType: number;
    NBR_Legs: number;
    NBR_Days: number;
    NBR_Duty: number;
    SeqCrewPos: number;
    SeqFlyTime: number;
    SeqPC: number;
    TAFB: number;
    AutoExp: number;
    DateRmvd: Date;
    SeqPremTime: number;
    B777300: number;
    B77W300: number;
    B772_200: number;
    B787_900: number;
    B787_800: number;
    B787P_900: number;
    A321_AK: number;
    A321_XLR: number;
    A321_NEO: number;
    A321: number;
    A320: number;
    A319: number;
    B737_MAX: number;
    B737: number;
    E190: number;
    Redeye: number;
    ODAN: number;
    IPDPremium: number;
    Charter: number;
    Shuttle: number;
    PremiumTranscon: number;
    Rocket: number;
    IPD: number;
    INT: number;
    CvtSeqFlyTime: string;
    CvtSeqPC: string;
    CvtTAFB: string;
    CvtSeqPremTime: string;
    dummy: number;
}

const SequenceSchema = new Schema<ISequence>({
    UniqueSeqNo: { type: Number },
    SeqNo: { type: Number },
    CrewBase: { type: String },
    SeqCategory: { type: String },
    SeqType: { type: Number },
    NBR_Legs: { type: Number },
    NBR_Days: { type: Number },
    NBR_Duty: { type: Number },
    SeqCrewPos: { type: Number },
    SeqFlyTime: { type: Number },
    SeqPC: { type: Number },
    TAFB: { type: Number },
    AutoExp: { type: Number },
    DateRmvd: { type: Date },
    SeqPremTime: { type: Number },
    B777300: { type: Number },
    B77W300: { type: Number },
    B772_200: { type: Number },
    B787_900: { type: Number },
    B787_800: { type: Number },
    B787P_900: { type: Number },
    A321_AK: { type: Number },
    A321_XLR: { type: Number },
    A321_NEO: { type: Number },
    A321: { type: Number },
    A320: { type: Number },
    A319: { type: Number },
    B737_MAX: { type: Number },
    B737: { type: Number },
    E190: { type: Number },
    Redeye: { type: Number },
    ODAN: { type: Number },
    IPDPremium: { type: Number },
    Charter: { type: Number },
    Shuttle: { type: Number },
    PremiumTranscon: { type: Number },
    Rocket: { type: Number },
    IPD: { type: Number },
    INT: { type: Number },
    CvtSeqFlyTime: { type: String },
    CvtSeqPC: { type: String },
    CvtTAFB: { type: String },
    CvtSeqPremTime: { type: String },
    dummy: { type: Number },
});

export const Sequence = model<ISequence>('Sequence', SequenceSchema, 'Sequence');
