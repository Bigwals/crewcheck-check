// services/authService.ts
// import { User } from '../models/userModel';
import { NewCrew } from '../models/newCrewModel';
import { Media } from '../models/mediaModel';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Types } from "mongoose";

dotenv.config();

// authservice.ts
export const updateCrew = async (
    airline: string,
    crewId: number,
    firstName: string,
    lastName: string,
    telephone: string,
    commuterAirportCode: string,
    // otp: string,
    email: string,
    password: string,
    airport: string,
    base: string,
) => {
    // Check if the crew exists first
    const crewExists = await NewCrew.findOne({ crewId });
    if (!crewExists) {
        return null; // Or throw an error if you prefer
    }

    // Update the crew record
    const updatedCrew = await NewCrew.findOneAndUpdate(
        { crewId }, // condition
        {
            $set: {
                airline,
                firstName,
                lastName,
                telephone,
                commuterAirportCode,
                // otp,
                otpVerified: false,
                isActive: false,
                email,
                password,
                airport,
                base,
            },
        },
        { new: true } // return updated doc
    );

    return updatedCrew;
};

export const getUserProfile = async (id: string) => {
    const crew = await NewCrew.findById(id)
        .populate({
            path: 'avatar',
            select: '_id media',
        })
        .lean();

    if (!crew) throw new Error('Crew not found');
    return crew;
};

export const uploadMedia = async (
    crewId: string,
    media: string
) => {
    const avatar = new Media({
        crewId,
        media
    })
    return await avatar.save();
}

export const deleteMedia = async (id: Types.ObjectId) => {
    const avatar = await Media.findByIdAndDelete(id);
    return avatar;
};