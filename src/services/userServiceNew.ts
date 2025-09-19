
import { NewCrew } from '../models/newCrewModel';
import { BasePay } from '../models/BasePay';
import { getPool, sql } from "../config/db";
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Types } from 'mongoose';

dotenv.config();

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

// old
export const findBySequenceNo = async (seqNo: number) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("seqNo", sql.Int, seqNo)
    .query(`
            SELECT * FROM Sequence
            WHERE SeqNo = @seqNo
        `);

  return result.recordset.length > 0 ? result.recordset : null;
};

export const findByDateAndSeqNo = async (seqNo: number, effDate: Date) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("seqNo", sql.Int, seqNo)
    .input("effDate", sql.Date, effDate)
    .query(`
            SELECT *
            FROM Leg
            WHERE SeqNo = @seqNo 
            AND EffDate = @effDate
        `);

  return result.recordset.length > 0 ? result.recordset : null;
};

export const getBoardingPayByYears = async (YearsOfService: number) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("YearsOfService", sql.Int, YearsOfService)
    .query(`
            SELECT *
            FROM BoardingPay
            WHERE YearsOfService = @YearsOfService 
        `);

  return result.recordset.length > 0 ? result.recordset[0] : null;
}

export const updatePosition = async (seqNo: number, position: number, effDate: Date) => {
  const pool = await getPool();

  // Fetch current SeqCrewPos string for that seqNo + effDate
  const result = await pool.request()
    .input("seqNo", sql.Int, seqNo)
    .input("effDate", sql.Date, effDate)
    .query(`
      SELECT SeqCrewPos
      FROM Sequence
      WHERE SeqNo = @seqNo AND EffDate = @effDate
    `);

  if (result.recordset.length === 0) return null;

  let seqCrewPos: string = result.recordset[0].SeqCrewPos;

  // Convert to array for easy manipulation
  let seqCrewPosArr = seqCrewPos.split("");

  // Flip selected position (position is 1-based index)
  if (position > 0 && position <= seqCrewPosArr.length) {
    seqCrewPosArr[position - 1] = "0"; // user applied → mark unavailable
  }

  const updatedSeqCrewPos = seqCrewPosArr.join("");

  // Update DB (only this seqNo + effDate)
  await pool.request()
    .input("seqNo", sql.Int, seqNo)
    .input("effDate", sql.Date, effDate)
    .input("seqCrewPos", sql.VarChar, updatedSeqCrewPos)
    .query(`
      UPDATE Sequence
      SET SeqCrewPos = @seqCrewPos
      WHERE SeqNo = @seqNo AND EffDate = @effDate
    `);

  return updatedSeqCrewPos;
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
