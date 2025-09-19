import { User } from '../models/userModel';
import { Crew } from '../models/crewModel';
import { BasePay } from '../models/BasePay';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Types } from 'mongoose';

dotenv.config();

export const findUserByEmail = async (email: string) => {
  return await User.findOne({ email });
};

export const findUserByCrewId = async (crewId: string) => {
  // return await User.findOne({ crewId });
  const crew = await User.findOne({ crewId });
  if (!crew) return false;
  const users = await User.find({});
  const crewsLength = users.length;

  const CrewID = parseInt(crewId);
  const baseSeniority = parseFloat((crewsLength / CrewID).toFixed(2));
  const aaSeniority = crewId;
  const crewObj = crew?.toObject();
  const newCrew = { ...crewObj, baseSeniority, aaSeniority };
  return newCrew;
};

export const findUserByClientCrewId = async (CrewID: number) => {
  const crew = await Crew.findOne({ CrewID });
  if (!crew) return false;

  const crews = await Crew.find({});
  const crewsLength = crews.length;

  const baseSeniority = parseFloat((crewsLength / CrewID).toFixed(2));
  const aaSeniority = CrewID;
  const crewObj = crew?.toObject();
  const newCrew = { ...crewObj, baseSeniority, aaSeniority };

  return newCrew;
};

export const findUserById = async (crewId: number) => {
  return await User.findOne({ crewId }).populate({ path: "avatar", select: "_id media" });
};

export const findCrewNew = async (crewId: string) => {
  return await User.findOne({ crewId });
};

export const findCrewOld = async (CrewID: number) => {
  return await Crew.findOne({ CrewID });
};

export const findUserAndUpdate = async (id: Types.ObjectId, avatar: Types.ObjectId) => {
  const user = await User.findByIdAndUpdate(
    id,
    { $set: { avatar } },
    { new: true }
  ).populate({ path: "avatar", select: "_id media" });
  return user;
};

const getYearsOfService = (hireDate: Date, today = new Date()): number => {
  const msInYear = 365 * 24 * 60 * 60 * 1000;
  const diff = today.getTime() - hireDate.getTime();
  return Math.floor(diff / msInYear) + 1;
};

export const getCrewPayDetails = async (crewId: number) => {
  const crew = await Crew.findOne({ CrewID: crewId }).lean();

  if (!crew) {
    throw new Error("Crew not found");
  }

  let yearsOfService = getYearsOfService(crew?.HireDate);
  const cappedYears = Math.min(yearsOfService, 13);

  const basePay = await BasePay.findOne({ YearsOfService: cappedYears }).lean();

  if (!basePay) {
    throw new Error("Base pay not found for this level of service");
  }

  const extendedBasePay = {
    ...basePay,
    moreThan13Years: yearsOfService > 13,
  };

  return extendedBasePay;
};
