"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequence = exports.uploadAvatar = exports.changePassword = exports.getProfile = void 0;
const responseMessages_1 = require("../constants/responseMessages");
const statusCodes_1 = require("../constants/statusCodes");
// import { deleteMedia, getUserProfile, uploadMedia } from '../services/authService';
const authService_1 = require("../services/authService");
// import { findUserById, findUserByEmail, findUserAndUpdate } from '../services/userService';
const userServiceNew_1 = require("../services/userServiceNew");
const bcrypt_1 = __importDefault(require("bcrypt"));
const Sequence_1 = require("../models/Sequence");
const getProfile = async (req, res) => {
    try {
        // const crewId = (req as any).user.id;
        const crewId = req.user.crewId;
        // const userId = (req as any).query?.userId;
        console.log("User ==>>", crewId);
        // return res.json({user: crewId});
        // if (!userId || !Types.ObjectId.isValid(crewId)) {
        if (!crewId) {
            return res.status(400).json({ message: "Invalid or missing user ID" });
        }
        const crew = await (0, userServiceNew_1.findCrewById)(crewId);
        if (!crew) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        const service = await (0, userServiceNew_1.getCrewPayDetails)(crewId);
        if (service)
            return res.status(200).json({ message: responseMessages_1.Messages.USER_PROFILE, crew, service });
        return res.status(200).json({ message: responseMessages_1.Messages.USER_PROFILE, crew });
    }
    catch (error) {
        console.error("Error in getProfile:", error);
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR });
    }
};
exports.getProfile = getProfile;
const changePassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        if (password !== confirmPassword) {
            return res.status(statusCodes_1.StatusCode.BAD_REQUEST).json({ message: responseMessages_1.Messages.PASSWORD_DOES_NOT_MATCH });
        }
        // return res.json({ crew: crewId })
        const crewId = req.user.crewId;
        // const email = (req as any).user.email;
        // return res.json({ crew: crewId })
        const crew = await (0, userServiceNew_1.findCrewById)(crewId);
        // const crew = await findCrewByEmail(email);
        if (!crew) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, Number(process.env.SALT) || 10);
        // crew.password = hashedPassword;
        // await crew.save();
        await (0, userServiceNew_1.UpdatePassword)(crewId, hashedPassword);
        return res.status(statusCodes_1.StatusCode.OK).json({ message: responseMessages_1.Messages.PASSWORD_CHANGED });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR, error: error.message });
    }
};
exports.changePassword = changePassword;
const uploadAvatar = async (req, res) => {
    try {
        const crewId = req.user.id;
        const file = req.file;
        console.log("====>>>>", crewId);
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        if (file.size > MAX_SIZE) {
            return res.status(400).json({ message: 'File is large. Max allowed size is 2MB.' });
        }
        // return res.json({ user: crewId });
        const crew = await (0, userServiceNew_1.findCrewById)(crewId);
        if (!crew) {
            return res.status(statusCodes_1.StatusCode.NOT_FOUND).json({ message: responseMessages_1.Messages.NOT_FOUND });
        }
        if (crew.avatar) {
            await (0, authService_1.deleteMedia)(crew?.avatar);
        }
        // const media = await uploadMedia(userId, file.filename) as { _id: string };
        const media = await (0, authService_1.uploadMedia)(crewId, file.filename);
        // return res.status(200).json({media: media});
        // await findUserAndUpdate(userId, media._id.toString());
        const updatedCrew = await (0, userServiceNew_1.findCrewAndUpdate)(crewId, media._id);
        return res.status(statusCodes_1.StatusCode.OK).json({ message: responseMessages_1.Messages.AVATAR_UPLOADED, user: updatedCrew });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({ message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR });
    }
};
exports.uploadAvatar = uploadAvatar;
const sequence = async (req, res) => {
    try {
        const sequenceId = Number(req.query.sequenceId); // Ensure it's numeric
        // const userSequence = await UserSequence.find({SeqNo: sequenceId});
        const sequence = await Sequence_1.Sequence.aggregate([
            {
                $match: { SeqNo: sequenceId }
            },
            {
                $lookup: {
                    from: "UserSequence",
                    localField: "SeqNo",
                    foreignField: "SeqNo",
                    as: "userSequence"
                }
            },
            {
                $unwind: {
                    path: "$userSequence",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: ["$userSequence", "$$ROOT"] // merge fields from both docs
                    }
                }
            },
            {
                $project: {
                    // sequence: 1,
                    // UserSequence: 1,
                    userSequence: 0, // remove nested duplicate
                    __v: 0
                }
            }
        ]);
        return res.status(200).json({ message: "Sequence Fetched Successfully", sequence });
    }
    catch (error) {
        return res.status(statusCodes_1.StatusCode.INTERNAL_SERVER_ERROR).json({
            message: responseMessages_1.Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};
exports.sequence = sequence;
