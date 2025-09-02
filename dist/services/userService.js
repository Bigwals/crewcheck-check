"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCrewPayDetails = exports.findUserAndUpdate = exports.findCrewOld = exports.findCrewNew = exports.findUserById = exports.findUserByClientCrewId = exports.findUserByCrewId = exports.findUserByEmail = void 0;
const userModel_1 = require("../models/userModel");
const crewModel_1 = require("../models/crewModel");
const BasePay_1 = require("../models/BasePay");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const findUserByEmail = async (email) => {
    return await userModel_1.User.findOne({ email });
};
exports.findUserByEmail = findUserByEmail;
const findUserByCrewId = async (crewId) => {
    // return await User.findOne({ crewId });
    const crew = await userModel_1.User.findOne({ crewId });
    if (!crew)
        return false;
    const users = await userModel_1.User.find({});
    const crewsLength = users.length;
    const CrewID = parseInt(crewId);
    const baseSeniority = parseFloat((crewsLength / CrewID).toFixed(2));
    const aaSeniority = crewId;
    const crewObj = crew?.toObject();
    const newCrew = { ...crewObj, baseSeniority, aaSeniority };
    return newCrew;
};
exports.findUserByCrewId = findUserByCrewId;
const findUserByClientCrewId = async (CrewID) => {
    const crew = await crewModel_1.Crew.findOne({ CrewID });
    if (!crew)
        return false;
    const crews = await crewModel_1.Crew.find({});
    const crewsLength = crews.length;
    const baseSeniority = parseFloat((crewsLength / CrewID).toFixed(2));
    const aaSeniority = CrewID;
    const crewObj = crew?.toObject();
    const newCrew = { ...crewObj, baseSeniority, aaSeniority };
    return newCrew;
};
exports.findUserByClientCrewId = findUserByClientCrewId;
const findUserById = async (crewId) => {
    return await userModel_1.User.findOne({ crewId }).populate({ path: "avatar", select: "_id media" });
};
exports.findUserById = findUserById;
const findCrewNew = async (crewId) => {
    return await userModel_1.User.findOne({ crewId });
};
exports.findCrewNew = findCrewNew;
const findCrewOld = async (CrewID) => {
    return await crewModel_1.Crew.findOne({ CrewID });
};
exports.findCrewOld = findCrewOld;
const findUserAndUpdate = async (id, avatar) => {
    const user = await userModel_1.User.findByIdAndUpdate(id, { $set: { avatar } }, { new: true }).populate({ path: "avatar", select: "_id media" });
    return user;
};
exports.findUserAndUpdate = findUserAndUpdate;
// const getYearsOfService = (hireDate: Date, today = new Date()): number => {
//   const msInYear = 365 * 24 * 60 * 60 * 1000;
//   const diff = today.getTime() - hireDate.getTime();
//   return Math.floor(diff / msInYear) + 1;
// };
// export const getCrewPayDetails = async (crewId: number) => {
//   const crew = await Crew.findOne({ CrewID: crewId }).lean();
//   if (!crew) {
//     throw new Error("Crew not found");
//   }
//   const yearsOfService = getYearsOfService(crew?.HireDate);
//   console.log("Years of Service:", yearsOfService);
//   const basePay = await BasePay.findOne({ YearsOfService: yearsOfService }).lean();
//   if (!basePay) {
//     throw new Error("Base pay not found for this level of service");
//   }
//   return basePay;
// };
const getYearsOfService = (hireDate, today = new Date()) => {
    const msInYear = 365 * 24 * 60 * 60 * 1000;
    const diff = today.getTime() - hireDate.getTime();
    return Math.floor(diff / msInYear) + 1;
};
const getCrewPayDetails = async (crewId) => {
    const crew = await crewModel_1.Crew.findOne({ CrewID: crewId }).lean();
    if (!crew) {
        throw new Error("Crew not found");
    }
    let yearsOfService = getYearsOfService(crew?.HireDate);
    const cappedYears = Math.min(yearsOfService, 13);
    const basePay = await BasePay_1.BasePay.findOne({ YearsOfService: cappedYears }).lean();
    if (!basePay) {
        throw new Error("Base pay not found for this level of service");
    }
    const extendedBasePay = {
        ...basePay,
        moreThan13Years: yearsOfService > 13,
    };
    return extendedBasePay;
};
exports.getCrewPayDetails = getCrewPayDetails;
