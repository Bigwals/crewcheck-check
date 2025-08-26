import { NewCrew } from '../models/newCrewModel';
import { User } from '../models/userModel';

export const generateOtp = async (): Promise<any> => {
    return Math.floor(100000 + Math.random() * 900000);
}

export const saveOtp = async (email: string, otp: number) => {
    const crew = await NewCrew.findOne({ email });
    if (crew) {
        crew.otp = otp;
        crew.otpVerified = false;
        return await crew.save();
    }
    return false;
};

export const deleteOtp = async (email: string) => {
    const crew = await NewCrew.findOne({ email });
    if (crew) {
        crew.otp = 0;
        crew.otpVerified = true;
        return await crew.save();
    }
    return false;
};