
import { NewCrew } from '../models/newCrewModel';
import { BasePay } from '../models/BasePay';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Types } from 'mongoose';

dotenv.config();

export const findCrewByEmail = async (email: string) => {
  return await NewCrew.findOne({ email });
};

export const findCrewByCrewId = async (crewId: number) => {
  const crew = await NewCrew.findOne({ crewId });
  if (!crew) return false;

  // Use countDocuments instead of fetching all
  const crewsLength = await NewCrew.countDocuments({});

  const baseSeniority = parseFloat((crewsLength / crewId).toFixed(2));
  const aaSeniority = crewId;

  return {
    ...crew.toObject(),
    baseSeniority,
    aaSeniority
  };
};


export const findCrewById = async (id: string) => {
  return await NewCrew.findById(id).populate({ path: "avatar", select: "_id media" });
};

export const findByCrewId = async (crewId: number) => {
  return await NewCrew.findOne({ crewId }).populate({ path: "avatar", select: "_id media" });
};

export const findCrewAndUpdate = async (id: Types.ObjectId, avatar: Types.ObjectId) => {
  const crew = await NewCrew.findByIdAndUpdate(
    id,
    { $set: { avatar } },
    { new: true }
  ).populate({ path: "avatar", select: "_id media" });
  return crew;
};

const getYearsOfService = (hireDate: Date, today = new Date()): number => {
  let years = today.getFullYear() - hireDate.getFullYear();
  const monthDiff = today.getMonth() - hireDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < hireDate.getDate())) {
    years--;
  }

  return years + 1; 
};

export const getCrewPayDetails = async (id: string) => {
  // Only fetch the hireDate to keep it light
  const crew = await NewCrew.findById(id, { hireDate: 1 }).lean();
  if (!crew) {
    return { basePay: null, yearsOfService: null, moreThan13Years: false, note: "Crew not found" };
  }

  // Handle missing hire date
  if (!crew.hireDate) {
    return { basePay: null, yearsOfService: null, moreThan13Years: false, note: "Hire date not provided" };
  }

  const yearsOfService = getYearsOfService(new Date(crew.hireDate));
  const cappedYears = Math.min(yearsOfService, 13);

  const basePay = await BasePay.findOne({ YearsOfService: cappedYears }).lean();

  return {
    basePay: basePay || null,
    yearsOfService,
    moreThan13Years: yearsOfService > 13,
    note: basePay ? null : "Base pay not found for this level of service"
  };
};

