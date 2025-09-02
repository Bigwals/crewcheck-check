"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMedia = exports.uploadMedia = exports.updateCrew = void 0;
// services/authService.ts
// import { User } from '../models/userModel';
const newCrewModel_1 = require("../models/newCrewModel");
const mediaModel_1 = require("../models/mediaModel");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// authservice.ts
const updateCrew = async (airline, crewId, firstName, lastName, telephone, commuterAirportCode, 
// otp: string,
email, password, airport, base) => {
    // Check if the crew exists first
    const crewExists = await newCrewModel_1.NewCrew.findOne({ crewId });
    if (!crewExists) {
        return null; // Or throw an error if you prefer
    }
    // Update the crew record
    const updatedCrew = await newCrewModel_1.NewCrew.findOneAndUpdate({ crewId }, // condition
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
    }, { new: true } // return updated doc
    );
    return updatedCrew;
};
exports.updateCrew = updateCrew;
// export const getUserProfile = async (id: string) => {
//     const crew = await NewCrew.findById(id)
//         .populate({
//             path: 'avatar',
//             select: '_id media',
//         })
//         .lean();
//     if (!crew) throw new Error('Crew not found');
//     return crew;
// };
const uploadMedia = async (crewId, media) => {
    const avatar = new mediaModel_1.Media({
        crewId,
        media
    });
    return await avatar.save();
};
exports.uploadMedia = uploadMedia;
const deleteMedia = async (id) => {
    const avatar = await mediaModel_1.Media.findByIdAndDelete(id);
    return avatar;
};
exports.deleteMedia = deleteMedia;
