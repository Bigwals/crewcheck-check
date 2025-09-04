
import { NewCrew } from '../models/newCrewModel';
import { BasePay } from '../models/BasePay';
import { getPool, sql } from "../config/db";
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Types } from 'mongoose';

dotenv.config();

// export const findCrewByEmail = async (email: string) => {
//   return await NewCrew.findOne({ email });
// };

export const findCrewByEmail = async (email: string) => {
  const pool = await getPool();

  const result = await pool.request()
    .input("email", email)
    .query(`
      SELECT * FROM Users
      WHERE email = @email
    `);

  return result.recordset.length > 0 ? result.recordset[0] : null;
};

// export const findCrewByCrewId = async (crewId: number) => {
//   const crew = await NewCrew.findOne({ crewId });
//   if (!crew) return false;

//   // Use countDocuments instead of fetching all
//   const crewsLength = await NewCrew.countDocuments({});

//   const baseSeniority = parseFloat((crewsLength / crewId).toFixed(2));
//   const aaSeniority = crewId;

//   return {
//     ...crew.toObject(),
//     baseSeniority,
//     aaSeniority
//   };
// };




// export const findCrewById = async (id: string) => {
//   return await NewCrew.findById(id).populate({ path: "avatar", select: "_id media" });
// };

export const findCrewById = async (crewId: number) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("crewId", sql.Int, crewId)
    .query(`
    SELECT * FROM Users WHERE crewId = @crewId
    `);
  return result.recordset.length > 0 ? result.recordset[0] : null;

}

export const UpdatePassword = async (crewId: number, hashedPassword: string) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("crewId", sql.Int, crewId)
    .input("hashedPassword", sql.NVarChar, hashedPassword)
    .query(`
    UPDATE Users SET PasswordHash = @hashedPassword WHERE crewId = @crewId 
    `)

  const records = result?.recordset ?? [];
  return records.length > 0 ? records[0] : null;
}

export const findByCrewId = async (crewId: number, firstName: string, lastName: string) => {
  const pool = await getPool();

  const result = await pool.request()
    .input("crewId", sql.Int, crewId)
    .input("FirstName", sql.NVarChar, firstName)
    .input("LastName", sql.NVarChar, lastName)
    .query(`
      SELECT * FROM Roster
      WHERE crewId = @crewId 
        AND FirstName = @FirstName 
        AND LastName = @LastName
    `);

  return result.recordset.length > 0 ? result.recordset[0] : null;
};

// export const findBySequenceNo = async (seqNo: number) => {
//   const pool = await getPool();

//   const result = await pool.request()
//     .input("seqNo", sql.Int, seqNo)
//     .query(`
//     SELECT s.*, l.*
//     FROM Sequence s
//     INNER JOIN Leg l ON l.seqNo = s.seqNo
//     WHERE s.seqNo = @seqNo
//   `);

//   return result.recordset.length > 0 ? result.recordset : null;
// };

export const findBySequenceNo = async (seqNo: number) => {
  const pool = await getPool();

  const result = await pool.request()
    .input("seqNo", sql.Int, seqNo)
    .query(`
    SELECT * FROM Sequence
    WHERE seqNo = @seqNo
  `);

  return result.recordset.length > 0 ? result.recordset : null;
};

export const findCrewAndUpdate = async (id: Types.ObjectId, avatar: Types.ObjectId) => {
  const crew = await NewCrew.findByIdAndUpdate(
    id,
    { $set: { avatar } },
    { new: true }
  ).populate({ path: "avatar", select: "_id media" });
  return crew;
};

// helper function
const getYearsOfService = (hireDate: Date, today = new Date()): number => {
  let years = today.getFullYear() - hireDate.getFullYear();
  const monthDiff = today.getMonth() - hireDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < hireDate.getDate())) {
    years--;
  }

  return years + 1;
};

export const getCrewPayDetails = async (crewId: number) => {
  const pool = await getPool();

  // 1. Get crew hireDate
  const crewResult = await pool.request()
    .input("crewId", sql.Int, crewId)
    .query(`
      SELECT OccDate
      FROM Roster
      WHERE CrewId = @crewId
    `);

  const crew = crewResult.recordset[0];

  if (!crew) {
    return { basePay: null, yearsOfService: null, moreThan13Years: false, note: "Crew not found" };
  }

  if (!crew.OccDate) {
    return { basePay: null, yearsOfService: null, moreThan13Years: false, note: "Hire date not provided" };
  }

  // 2. Calculate years of service
  const yearsOfService = getYearsOfService(new Date(crew.OccDate));
  const cappedYears = Math.min(yearsOfService, 13);

  // 3. Get base pay for cappedYears
  const basePayResult = await pool.request()
    .input("YearsOfService", sql.Int, cappedYears)
    .query(`
      SELECT TOP 1 *
      FROM BasePay
      WHERE YearsOfService = @YearsOfService
    `);

  const basePay = basePayResult.recordset[0] || null;

  return {
    basePay,
    yearsOfService,
    moreThan13Years: yearsOfService > 13,
    note: basePay ? null : "Base pay not found for this level of service"
  };
};
