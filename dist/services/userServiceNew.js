"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLanguages = exports.getUserLanguages = exports.getCrewPayDetail = exports.getCrewPayDetails = exports.getAllCrews = exports.addLegDataInUserLeg = exports.addSequenceDataInUserSequence = exports.updateCrewProfile = exports.updatePosition = exports.getBoardingPayByYears = exports.checkAlreadyApplied = exports.findByDateAndSeqNo = exports.findUserAppliedSequenceNo = exports.findByBidMonth = exports.findBySequenceNo = exports.findByCrewId = exports.UpdatePassword = exports.findCrewById = exports.findCrewByEmail = void 0;
exports.getDynamicBaseRate = getDynamicBaseRate;
const db_1 = require("../config/db");
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
const crypto = __importStar(require("crypto"));
dotenv_1.default.config();
const findCrewByEmail = async (email) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("email", email)
        .query(`
      SELECT * FROM Users
      WHERE email = @email
    `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
};
exports.findCrewByEmail = findCrewByEmail;
const findCrewById = async (crewId) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .query(`
    SELECT * FROM Users WHERE CrewID = @crewId
    `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
};
exports.findCrewById = findCrewById;
const UpdatePassword = async (crewId, hashedPassword) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .input("hashedPassword", db_1.sql.NVarChar, hashedPassword)
        .query(`
    UPDATE Users SET PasswordHash = @hashedPassword WHERE crewId = @crewId 
    `);
    const records = result?.recordset ?? [];
    return records.length > 0 ? records[0] : null;
};
exports.UpdatePassword = UpdatePassword;
const findByCrewId = async (crewId, firstName, lastName) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .input("FirstName", db_1.sql.NVarChar, firstName)
        .input("LastName", db_1.sql.NVarChar, lastName)
        .query(`
      SELECT * FROM Roster
      WHERE crewId = @crewId 
        AND FirstName = @FirstName 
        AND LastName = @LastName
    `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
};
exports.findByCrewId = findByCrewId;
const findBySequenceNo = async (seqNo, bidMonth) => {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    request.input("seqNo", db_1.sql.Int, seqNo);
    request.input("bidMonth", db_1.sql.NVarChar, bidMonth);
    const result = await request.query(`
    SELECT *
    FROM dbo.Sequence
    WHERE SeqNo = @seqNo
      AND BidMonth = @bidMonth
  `);
    return result.recordset;
};
exports.findBySequenceNo = findBySequenceNo;
const findByBidMonth = async (crewBase, bidMonth) => {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    request.input("crewBase", db_1.sql.VarChar, crewBase.trim());
    request.input("bidMonth", db_1.sql.NVarChar, bidMonth.trim());
    // new
    const result = await request.query(`
  SELECT 
    s.CrewBase,
    s.SeqNo,
    s.UniqueSeqNo,
    s.SeqCategory,
    s.NBR_Legs,
    s.SeqCrewPos,
    s.CvtSeqFlyTime,
    s.CvtSeqPC,
    s.CvtTAFB,
    s.CvtSeqPremTime,
    s.BidMonth,

    l.SeqLegNo,
    l.CvtDptTime,
    l.CvtArvTime,
    l.CvtLegPC,
    l.CvtDPOnDutyTime,
    l.EOD,
    l.DptTime,
    l.ArvTime,
    l.DeptStn,
    l.ArrvStn,
    l.LegEqupType,
    l.LegPC,
    l.CvtLayover

  FROM dbo.Sequence s
  INNER JOIN Leg l
      ON s.SeqNo = l.SeqNo
     AND s.BidMonth = l.BidMonth
  WHERE s.CrewBase = @crewBase
    AND s.BidMonth = @bidMonth
  ORDER BY s.SeqNo, l.SeqLegNo
`);
    // const sequencesMap = new Map();
    // old
    // result.recordset.forEach((row) => {
    //   if (!sequencesMap.has(row.SeqNo)) {
    //     sequencesMap.set(row.SeqNo, {
    //       CrewBase: row.CrewBase,
    //       SeqNo: row.SeqNo,
    //       UniqueSeqNo: row.UniqueSeqNo,
    //       SeqCategory: row.SeqCategory,
    //       NBR_Legs: row.NBR_Legs,
    //       SeqCrewPos: row.SeqCrewPos,
    //       CvtSeqFlyTime: row.CvtSeqFlyTime,
    //       CvtSeqPC: row.CvtSeqPC,
    //       CvtTAFB: row.CvtTAFB,
    //       CvtSeqPremTime: row.CvtSeqPremTime,
    //       BidMonth: row.BidMonth,
    //       legs: []
    //     });
    //   }
    //   sequencesMap.get(row.SeqNo).legs.push({
    //     SeqLegNo: row.SeqLegNo,
    //     CvtDptTime: row.CvtDptTime,
    //     CvtArvTime: row.CvtArvTime,
    //     CvtLegPC: row.CvtLegPC,
    //     EOD: row.EOD,
    //     DptTime: row.DptTime,
    //     ArvTime: row.ArvTime,
    //     DeptStn: row.DeptStn,
    //     ArrvStn: row.ArrvStn,
    //     LegEqupType: row.LegEqupType,
    //     LegPC: row.LegPC,
    //     CvtLayover: row.CvtLayover
    //   });
    // });
    // new
    const sequencesMap = new Map();
    result.recordset.forEach((row) => {
        const key = `${row.SeqNo}_${row.BidMonth}`;
        if (!sequencesMap.has(key)) {
            sequencesMap.set(key, {
                CrewBase: row.CrewBase,
                SeqNo: row.SeqNo,
                UniqueSeqNo: row.UniqueSeqNo,
                SeqCategory: row.SeqCategory,
                NBR_Legs: row.NBR_Legs,
                SeqCrewPos: row.SeqCrewPos,
                CvtSeqFlyTime: row.CvtSeqFlyTime,
                CvtSeqPC: row.CvtSeqPC,
                CvtTAFB: row.CvtTAFB,
                CvtSeqPremTime: row.CvtSeqPremTime,
                BidMonth: row.BidMonth,
                legs: []
            });
        }
        sequencesMap.get(key).legs.push({
            SeqLegNo: row.SeqLegNo,
            CvtDptTime: row.CvtDptTime,
            CvtArvTime: row.CvtArvTime,
            CvtLegPC: row.CvtLegPC,
            CvtDPOnDutyTime: row.CvtDPOnDutyTime,
            EOD: row.EOD,
            DptTime: row.DptTime,
            ArvTime: row.ArvTime,
            DeptStn: row.DeptStn,
            ArrvStn: row.ArrvStn,
            LegEqupType: row.LegEqupType,
            LegPC: row.LegPC,
            CvtLayover: row.CvtLayover
        });
    });
    const formattedData = Array.from(sequencesMap.values());
    return formattedData;
};
exports.findByBidMonth = findByBidMonth;
const findUserAppliedSequenceNo = async (seqNo, bidMonth, userId) => {
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    request.input("seqNo", db_1.sql.Int, seqNo);
    // request.input("bidMonth", sql.NVarChar, bidMonth);
    request.input("userId", db_1.sql.UniqueIdentifier, userId);
    const result = await request.query(`
    SELECT *
    FROM dbo.UserSequence
    WHERE SeqNo = @seqNo
    AND UserID = @userId
    `);
    // AND BidMonth = @bidMonth
    return result.recordset;
};
exports.findUserAppliedSequenceNo = findUserAppliedSequenceNo;
// export const findByDateAndUniqueSeqNo = async (uniqueSeqNo: number, frequency_date: String) => {
const findByDateAndSeqNo = async (uniqueSeqNo, frequency_date) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
        .input("frequency_date", db_1.sql.Date, frequency_date)
        .query(`
            SELECT *
            FROM Frequency
            WHERE UniqueSeqNo = @uniqueSeqNo 
            AND frequency_date = @frequency_date
        `);
    return result.recordset.length > 0 ? result.recordset : null;
};
exports.findByDateAndSeqNo = findByDateAndSeqNo;
// old
// export const findByDateAndSeqNo = async (seqNo: number, effDate: String) => {
//   const pool = await getPool();
//   const result = await pool.request()
//     .input("seqNo", sql.Int, seqNo)
//     .input("effDate", sql.Date, effDate)
//     .query(`
//             SELECT *
//             FROM Fre
//             WHERE SeqNo = @seqNo 
//             AND EffDate = @effDate
//         `);
//   return result.recordset.length > 0 ? result.recordset : null;
// };
// export const checkAlreadyApplied = async (seqNo: number, bidMonth: string, effDate: string, userId: string) => {
const checkAlreadyApplied = async (uniqueSeqNo, bidMonth, effDate, userId) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        // .input("seqNo", sql.Int, seqNo)
        .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
        .input("bidMonth", db_1.sql.VarChar, bidMonth)
        .input("effDate", db_1.sql.VarChar, effDate)
        .input("userId", db_1.sql.UniqueIdentifier, userId)
        .query(`
            SELECT *
            FROM UserSequence
            WHERE UniqueSeqNo = @uniqueSeqNo 
            AND BidMonth = @bidMonth
            AND EffDate = @effDate
            AND UserID = @userId
        `);
    return result.recordset.length > 0 ? result.recordset : null;
};
exports.checkAlreadyApplied = checkAlreadyApplied;
const getBoardingPayByYears = async (YearsOfService) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("YearsOfService", db_1.sql.Int, YearsOfService)
        .query(`
            SELECT *
            FROM boarding_pay
            WHERE YearsOfService = @YearsOfService 
        `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
};
exports.getBoardingPayByYears = getBoardingPayByYears;
// export const updatePosition = async (seqNo: number, position: number, effDate: Date) => {
// old
// export const updatePosition = async (seqNo: number, position: number, effDate: string, bidMonth: string) => {
//   const pool = await getPool();
//   // 1) Fetch the row
//   const result = await pool.request()
//     .input("seqNo", sql.Int, seqNo)
//     .input("effDate", sql.NVarChar, effDate)
//     .input("bidMonth", sql.NVarChar, bidMonth)
//     .query(`
//       SELECT *
//       FROM Sequence
//       WHERE SeqNo = @seqNo AND BidMonth = @bidMonth
//     `);
//   if (result.recordset.length === 0) return null;
//   // Get the row object
//   let row = result.recordset[0];
//   let seqCrewPos: string = row.SeqCrewPos;
//   // 2) Update the SeqCrewPos string
//   let seqCrewPosArr = seqCrewPos.split("");
//   let originalDigit = seqCrewPosArr[position - 1];
//   if (position > 0 && position <= seqCrewPosArr.length) {
//     seqCrewPosArr[position - 1] = "0"; // mark position as taken
//   }
//   const updatedSeqCrewPos = seqCrewPosArr.join("");
//   // 3) Update DB
//   await pool.request()
//     .input("seqNo", sql.Int, seqNo)
//     // .input("effDate", sql.NVarChar, effDate)
//     .input("bidMonth", sql.NVarChar, bidMonth)
//     // .input("seqCrewPos", sql.VarChar, updatedSeqCrewPos)
//     .input("seqCrewPos", sql.VarChar(20), updatedSeqCrewPos)
//     .query(`
//       UPDATE Sequence
//       SET SeqCrewPos = @seqCrewPos
//       WHERE SeqNo = @seqNo AND BidMonth = @bidMonth
//     `);
//   // 4) Return the updated row (with new SeqCrewPos)
//   return {
//     ...row,
//     SeqCrewPos: updatedSeqCrewPos,
//     originalDigit
//   };
// };
// new
const updatePosition = async (uniqueSeqNo, position, effDate, bidMonth) => {
    const pool = await (0, db_1.getPool)();
    // 1️⃣ ALWAYS get base Sequence row (MASTER DATA)
    const seqBaseResult = await pool.request()
        .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
        .input("bidMonth", db_1.sql.NVarChar, bidMonth)
        .query(`
      SELECT * 
      FROM Sequence
      WHERE UniqueSeqNo = @uniqueSeqNo 
        AND BidMonth = @bidMonth
    `);
    if (seqBaseResult.recordset.length === 0)
        return null;
    const baseRow = seqBaseResult.recordset[0];
    // 2️⃣ Check if effDate exists in Sequence
    const seqEffDateResult = await pool.request()
        .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
        .input("effDate", db_1.sql.NVarChar, effDate)
        .query(`
      SELECT 1
      FROM Sequence
      WHERE UniqueSeqNo = @uniqueSeqNo 
        AND EffDate = @effDate
    `);
    const seqEffExists = seqEffDateResult.recordset.length > 0;
    // 3️⃣ Check Frequency table
    const freqResult = await pool.request()
        .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
        .input("effDate", db_1.sql.NVarChar, effDate)
        .query(`
      SELECT *
      FROM Frequency
      WHERE UniqueSeqNo = @uniqueSeqNo 
        AND frequency_date = @effDate
    `);
    const freqExists = freqResult.recordset.length > 0;
    // 4️⃣ Update SeqCrewPos string
    const updateSeqCrewPosString = (seqCrewPos) => {
        let arr = seqCrewPos.split("");
        let originalDigit = arr[position - 1];
        if (position > 0 && position <= arr.length) {
            arr[position - 1] = "0";
        }
        return {
            updated: arr.join(""),
            originalDigit
        };
    };
    // const { updated, originalDigit } = updateSeqCrewPosString(baseRow.SeqCrewPos);
    // 🔥 Decide correct source
    let sourceSeqCrewPos;
    if (seqEffExists) {
        // ✅ exact date exists in Sequence
        const seqRow = await pool.request()
            .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
            .input("effDate", db_1.sql.NVarChar, effDate)
            .query(`
      SELECT SeqCrewPos
      FROM Sequence
      WHERE UniqueSeqNo = @uniqueSeqNo 
        AND EffDate = @effDate
    `);
        sourceSeqCrewPos = seqRow.recordset[0].SeqCrewPos;
    }
    else if (freqExists) {
        // ✅ only exists in Frequency
        sourceSeqCrewPos = freqResult.recordset[0].SeqCrewPos;
    }
    else {
        // ⚠️ fallback (rare case)
        sourceSeqCrewPos = baseRow.SeqCrewPos;
    }
    // ✅ NOW apply logic on correct source
    const { updated, originalDigit } = updateSeqCrewPosString(sourceSeqCrewPos);
    // 5️⃣ APPLY UPDATE LOGIC
    // ✅ Case 1: effDate exists in Sequence → update BOTH
    if (seqEffExists) {
        await pool.request()
            .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
            .input("effDate", db_1.sql.NVarChar, effDate)
            .input("seqCrewPos", db_1.sql.VarChar(20), updated)
            .query(`
        UPDATE Sequence
        SET SeqCrewPos = @seqCrewPos
        WHERE UniqueSeqNo = @uniqueSeqNo 
          AND EffDate = @effDate
      `);
        if (freqExists) {
            await pool.request()
                .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
                .input("effDate", db_1.sql.NVarChar, effDate)
                .input("seqCrewPos", db_1.sql.VarChar(20), updated)
                .query(`
          UPDATE Frequency
          SET SeqCrewPos = @seqCrewPos
          WHERE UniqueSeqNo = @uniqueSeqNo 
            AND frequency_date = @effDate
        `);
        }
    }
    // ✅ Case 2: only Frequency exists
    else if (freqExists) {
        await pool.request()
            .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
            .input("effDate", db_1.sql.NVarChar, effDate)
            .input("seqCrewPos", db_1.sql.VarChar(20), updated)
            .query(`
        UPDATE Frequency
        SET SeqCrewPos = @seqCrewPos
        WHERE UniqueSeqNo = @uniqueSeqNo 
          AND frequency_date = @effDate
      `);
    }
    // ❗ Optional: if neither exists, you may want to throw error
    else {
        return null;
    }
    // 6️⃣ FINAL RETURN → ALWAYS Sequence data (as you wanted)
    return {
        ...baseRow,
        SeqCrewPos: updated,
        originalDigit
    };
};
exports.updatePosition = updatePosition;
// export const updateCrewProfile = async (crewId: number, base: string, occ_date: string, aa_seniority: string, speaker: string,) => {
const updateCrewProfile = async (crewId, base, occ_date, aa_seniority, purser, speaker) => {
    const pool = await (0, db_1.getPool)();
    // Update query
    await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .input("base", db_1.sql.VarChar, base)
        .input("occ_date", db_1.sql.VarChar, occ_date)
        .input("aa_seniority", db_1.sql.VarChar, aa_seniority)
        .input("purser", db_1.sql.NVarChar, purser)
        .input("speaker", db_1.sql.NVarChar, speaker)
        .query(`
      UPDATE Users 
      SET 
        Base = @base, 
        OccDate = @occ_date, 
        Seniority = @aa_seniority, 
        Purser = @purser,
        Speaker = @speaker
      WHERE crewId = @crewId
    `);
    // Fetch updated user (WITHOUT join to avoid duplicates)
    const result = await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .query(`
      SELECT 
        crewId, FirstName, LastName, Email, ImageUrl, 
        Base, OccDate, Seniority, Purser, Speaker
      FROM Users
      WHERE crewId = @crewId
    `);
    return result.recordset[0];
};
exports.updateCrewProfile = updateCrewProfile;
const addSequenceDataInUserSequence = async (userId, crewSeqPos, position, effDate, digit, l_r_type) => {
    const userSequenceId = (0, uuid_1.v4)();
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    // return l_r_type;
    request.input("UserSequenceID", db_1.sql.NVarChar, userSequenceId);
    request.input("UserID", db_1.sql.UniqueIdentifier, userId);
    request.input("UniqueSeqNo", db_1.sql.NVarChar, crewSeqPos.UniqueSeqNo);
    request.input("RecordType", db_1.sql.Int, crewSeqPos.RecordType);
    request.input("CrewCat", db_1.sql.NVarChar, crewSeqPos.CrewCat);
    request.input("CrewBase", db_1.sql.NVarChar, crewSeqPos.CrewBase);
    request.input("SeqCategory", db_1.sql.NVarChar, crewSeqPos.SeqCategory);
    request.input("DataVersion", db_1.sql.NVarChar, crewSeqPos.DataVersion);
    // request.input("EffDate", sql.Date, crewSeqPos.EffDate);
    request.input("EffDate", db_1.sql.Date, effDate);
    request.input("ThruDate", db_1.sql.Date, crewSeqPos.ThruDate);
    request.input("Frequency", db_1.sql.NVarChar, crewSeqPos.Frequency);
    request.input("SeqNo", db_1.sql.Int, crewSeqPos.SeqNo);
    request.input("SeqType", db_1.sql.Int, crewSeqPos.SeqType);
    request.input("NBR_Legs", db_1.sql.Int, crewSeqPos.NBR_Legs);
    request.input("NBR_Days", db_1.sql.Int, crewSeqPos.NBR_Days);
    request.input("NBR_Duty", db_1.sql.Int, crewSeqPos.NBR_Duty);
    request.input("SeqCrewPos", db_1.sql.NVarChar, crewSeqPos.SeqCrewPos);
    request.input("SeqFlyTime", db_1.sql.Int, crewSeqPos.SeqFlyTime);
    request.input("SeqPC", db_1.sql.Int, crewSeqPos.SeqPC);
    request.input("TAFB", db_1.sql.Int, crewSeqPos.TAFB);
    request.input("AutoExp", db_1.sql.Int, crewSeqPos.AutoExp);
    request.input("Pay", db_1.sql.Decimal, crewSeqPos.Pay);
    request.input("PriorSeq", db_1.sql.NVarChar, crewSeqPos.PriorSeq);
    request.input("DateRmvd", db_1.sql.Date, crewSeqPos.DateRmvd);
    request.input("SeqPremTime", db_1.sql.Int, crewSeqPos.SeqPremTime);
    request.input("Language1", db_1.sql.NVarChar, crewSeqPos.Language1);
    request.input("Language2", db_1.sql.NVarChar, crewSeqPos.Language2);
    request.input("Reserved", db_1.sql.NVarChar, crewSeqPos.Reserved);
    request.input("B777300", db_1.sql.Bit, crewSeqPos.B777300);
    request.input("B77W300", db_1.sql.Bit, crewSeqPos.B77W300);
    request.input("B772_200", db_1.sql.Bit, crewSeqPos.B772_200);
    request.input("B787_900", db_1.sql.Bit, crewSeqPos.B787_900);
    request.input("B787_800", db_1.sql.Bit, crewSeqPos.B787_800);
    request.input("B787P_900", db_1.sql.Bit, crewSeqPos.B787P_900);
    request.input("A321_AK", db_1.sql.Bit, crewSeqPos.A321_AK);
    request.input("A321_XLR", db_1.sql.Bit, crewSeqPos.A321_XLR);
    request.input("A321_NEO", db_1.sql.Bit, crewSeqPos.A321_NEO);
    request.input("A321", db_1.sql.Bit, crewSeqPos.A321);
    request.input("A320", db_1.sql.Bit, crewSeqPos.A320);
    request.input("A319", db_1.sql.Bit, crewSeqPos.A319);
    request.input("B737_MAX", db_1.sql.Bit, crewSeqPos.B737_MAX);
    request.input("B737", db_1.sql.Bit, crewSeqPos.B737);
    request.input("E190", db_1.sql.Bit, crewSeqPos.E190);
    request.input("CovidStationRestriction", db_1.sql.NVarChar, crewSeqPos.CovidStationRestriction);
    request.input("Redeye", db_1.sql.Bit, crewSeqPos.Redeye);
    request.input("ODAN", db_1.sql.Bit, crewSeqPos.ODAN);
    request.input("IPDPremium", db_1.sql.Bit, crewSeqPos.IPDPremium);
    request.input("Charter", db_1.sql.Bit, crewSeqPos.Charter);
    request.input("Satellite", db_1.sql.Bit, crewSeqPos.Satellite);
    request.input("CoTerminal", db_1.sql.NVarChar, crewSeqPos.CoTerminal);
    request.input("PremiumTranscon", db_1.sql.Bit, crewSeqPos.PremiumTranscon);
    request.input("Rocket", db_1.sql.Bit, crewSeqPos.Rocket);
    request.input("IPD", db_1.sql.Bit, crewSeqPos.IPD);
    request.input("NIPD", db_1.sql.Bit, crewSeqPos.NIPD);
    request.input("Notes", db_1.sql.NVarChar, crewSeqPos.Notes);
    request.input("CvtSeqFlyTime", db_1.sql.NVarChar, crewSeqPos.CvtSeqFlyTime);
    request.input("CvtSeqPC", db_1.sql.NVarChar, crewSeqPos.CvtSeqPC);
    request.input("CvtTAFB", db_1.sql.NVarChar, crewSeqPos.CvtTAFB);
    request.input("CvtSeqPremTime", db_1.sql.NVarChar, crewSeqPos.CvtSeqPremTime);
    request.input("BidMonth", db_1.sql.NVarChar, crewSeqPos.BidMonth);
    request.input("PositionAppliedOn", db_1.sql.Int, position);
    request.input("PositionAppliedOnLetter", db_1.sql.Char, digit);
    request.input("L_R_Type", db_1.sql.Bit, l_r_type);
    // request.input("L_R_Type", sql.Bit, !!l_r_type);
    const query = `
  INSERT INTO UserSequence (
    UserSequenceID, UserID, UniqueSeqNo, RecordType, CrewCat, CrewBase, SeqCategory, DataVersion, EffDate,
    ThruDate, Frequency, SeqNo, SeqType, NBR_Legs, NBR_Days, NBR_Duty, SeqCrewPos, SeqFlyTime, SeqPC, TAFB,
    AutoExp, Pay, PriorSeq, DateRmvd, SeqPremTime, Language1, Language2, Reserved, B777300, B77W300, B772_200,
    B787_900, B787_800, B787P_900, A321_AK, A321_XLR, A321_NEO, A321, A320, A319, B737_MAX, B737, E190, CovidStationRestriction,
    Redeye, ODAN, IPDPremium, Charter,Satellite, CoTerminal, PremiumTranscon, Rocket, IPD, NIPD, Notes, CvtSeqFlyTime, CvtSeqPC,
    CvtTAFB, CvtSeqPremTime, BidMonth, PositionAppliedOn, PositionAppliedOnLetter, L_R_Type
    )
    VALUES (
      @UserSequenceID, @UserID, @UniqueSeqNo, @RecordType, @CrewCat, @CrewBase, @SeqCategory, @DataVersion, @EffDate,
      @ThruDate, @Frequency, @SeqNo, @SeqType, @NBR_Legs, @NBR_Days, @NBR_Duty, @SeqCrewPos, @SeqFlyTime, @SeqPC, @TAFB,
      @AutoExp,
      @Pay, @PriorSeq, @DateRmvd, @SeqPremTime, @Language1, @Language2, @Reserved, @B777300, @B77W300, @B772_200, @B787_900,
      @B787_800, @B787P_900, @A321_AK, @A321_XLR, @A321_NEO, @A321, @A320, @A319, @B737_MAX, @B737, @E190, @CovidStationRestriction,
      @Redeye, @ODAN, @IPDPremium, @Charter, @Satellite, @CoTerminal, @PremiumTranscon, @Rocket, @IPD, @NIPD, @Notes, @CvtSeqFlyTime, @CvtSeqPC,
      @CvtTAFB, @CvtSeqPremTime, @BidMonth, @PositionAppliedOn, @PositionAppliedOnLetter, @L_R_Type
    )`;
    await request.query(query);
    return userSequenceId;
};
exports.addSequenceDataInUserSequence = addSequenceDataInUserSequence;
const addLegDataInUserLeg = async (userId, uniqueSeqNo, bidMonth, effDate, newUserSequenceId) => {
    const pool = await (0, db_1.getPool)();
    // 1) Get all legs for this SeqNo + BidMonth
    const legs = await pool.request()
        // .input("seqNo", sql.Int, seqNo)
        .input("uniqueSeqNo", db_1.sql.VarChar, uniqueSeqNo)
        // .input("effDate", sql.NVarChar(50), effDate)
        .input("bidMonth", db_1.sql.NVarChar, bidMonth)
        .query(`
      SELECT *
      FROM Leg
      WHERE UniqueSeqNo = @uniqueSeqNo AND BidMonth = @bidMonth
      `);
    // WHERE SeqNo = @seqNo AND EffDate = @effDate
    if (legs.recordset.length === 0)
        return [];
    console.log("-->>", legs);
    // 2) Insert each leg into UserLeg
    for (const leg of legs.recordset) {
        // ✅ Generate unique ID for each insert
        const userLegId = crypto.createHash("sha1")
            .update((0, uuid_1.v4)())
            .digest("hex")
            .substring(0, 25);
        await pool.request()
            .input("UserLegID", db_1.sql.NVarChar, userLegId)
            .input("UserID", db_1.sql.UniqueIdentifier, userId)
            .input("UniqueSeqNo", db_1.sql.VarChar, leg.UniqueSeqNo)
            .input("EffDate", db_1.sql.Date, effDate)
            .input("ThruDate", db_1.sql.Date, leg.ThruDate)
            .input("Frequency", db_1.sql.VarChar, leg.Frequency)
            .input("SeqNo", db_1.sql.Int, leg.SeqNo)
            .input("SeqLegNo", db_1.sql.Int, leg.SeqLegNo)
            .input("DeptStn", db_1.sql.VarChar, leg.DeptStn)
            .input("ArrvStn", db_1.sql.VarChar, leg.ArrvStn)
            .input("DptTime", db_1.sql.Int, leg.DptTime)
            .input("DptZone", db_1.sql.Int, leg.DptZone)
            .input("ArvTime", db_1.sql.Int, leg.ArvTime)
            .input("ArvZone", db_1.sql.Int, leg.ArvZone)
            .input("FitNo", db_1.sql.Int, leg.FitNo)
            .input("FitLegNo", db_1.sql.Int, leg.FitLegNo)
            .input("EOD", db_1.sql.Bit, leg.EOD)
            .input("LegTotalFlying", db_1.sql.Int, leg.LegTotalFlying)
            .input("LegEqupType", db_1.sql.Int, leg.LegEqupType)
            .input("LegDeadheadCode", db_1.sql.Bit, leg.LegDeadheadCode)
            .input("LegMidnightCode", db_1.sql.Int, leg.LegMidnightCode)
            .input("LegPC", db_1.sql.Int, leg.LegPC)
            .input("PCCode", db_1.sql.Int, leg.PCCode)
            .input("SchedOverFlow", db_1.sql.Int, leg.SchedOverFlow)
            .input("DVSD", db_1.sql.Int, leg.DVSD)
            .input("DVLA", db_1.sql.Int, leg.DVLA)
            .input("LayoverTime", db_1.sql.Int, leg.Layover)
            .input("DPOnDutyTime", db_1.sql.Int, leg.DPOnDutyTime)
            .input("DPDeadheadTime", db_1.sql.Int, leg.DPDeadheadTime)
            .input("DVLA2", db_1.sql.Int, leg.DVLA2)
            .input("LegNiteFly", db_1.sql.Int, leg.LegNiteFly)
            .input("Unused", db_1.sql.Int, leg.Unused)
            .input("Calendar_40Day", db_1.sql.VarChar, leg.Calendar_40Day)
            .input("Terminal", db_1.sql.VarChar, leg.Terminal)
            .input("GateNumber", db_1.sql.VarChar, leg.GateNumber)
            .input("FlightStatus", db_1.sql.VarChar, leg.FlightStatus)
            .input("BookingCode", db_1.sql.VarChar, leg.BookingCode)
            .input("SeatNumber", db_1.sql.VarChar, leg.SeatNumber)
            .input("TailNumber", db_1.sql.VarChar, leg.TailNumber)
            .input("UserSequenceId", db_1.sql.UniqueIdentifier, newUserSequenceId)
            .input("LegEndDateLocal", db_1.sql.Date, leg.LegEndDateLocal)
            .input("LegEndDateUtc", db_1.sql.Date, leg.LegEndDateUtc)
            .input("LegStartDateLocal", db_1.sql.Date, leg.LegStartDateLocal)
            .input("LegStartDateUtc", db_1.sql.Date, leg.LegStartDateUtc)
            .input("LegEndTimeLocal", db_1.sql.NVarChar, leg.LegEndTimeLocal)
            .input("LegEndTimeUtc", db_1.sql.NVarChar, leg.LegEndTimeUtc)
            .input("LegStartTimeLocal", db_1.sql.NVarChar, leg.LegStartTimeLocal)
            .input("LegStartTimeUtc", db_1.sql.NVarChar, leg.LegStartTimeUtc)
            .input("CvtArvTime", db_1.sql.VarChar, leg.CvtArvTime)
            .input("CvtDPDeadheadTime", db_1.sql.VarChar, leg.CvtDPDeadheadTime)
            .input("CvtDPOnDutyTime", db_1.sql.VarChar, leg.CvtDPOnDutyTime)
            .input("CvtDptTime", db_1.sql.VarChar, leg.CvtDptTime)
            .input("CvtLegNiteFly", db_1.sql.VarChar, leg.CvtLegNiteFly)
            .input("CvtLegPC", db_1.sql.VarChar, leg.CvtLegPC)
            .input("CvtLegTotalFlying", db_1.sql.VarChar, leg.CvtLegTotalFlying)
            .input("CvtLayover", db_1.sql.VarChar, leg.CvtLayover)
            .input("BidMonth", db_1.sql.VarChar, leg.BidMonth)
            .query(`
        INSERT INTO UserLeg (
          UserLegID, UserID, UniqueSeqNo, EffDate, ThruDate, Frequency, SeqNo, SeqLegNo, DeptStn, ArrvStn, DptTime, DptZone, ArvTime, ArvZone,
          FitNo, FitLegNo, EOD, LegTotalFlying, LegEqupType, LegDeadheadCode, LegMidnightCode, LegPC, PCCode,
          SchedOverFlow, DVSD, DVLA, LayoverTime, DPOnDutyTime, DPDeadheadTime, DVLA2, LegNiteFly, Unused,
          Calendar_40Day, Terminal, GateNumber, FlightStatus, BookingCode, SeatNumber, TailNumber, UserSequenceId,
          LegEndDateLocal, LegEndDateUtc, LegStartDateLocal, LegStartDateUtc, LegEndTimeLocal, LegEndTimeUtc,
          LegStartTimeLocal, LegStartTimeUtc, CvtArvTime, CvtDPDeadheadTime, CvtDPOnDutyTime, CvtDptTime,
          CvtLegNiteFly, CvtLegPC, CvtLegTotalFlying, CvtLayover, BidMonth
        )
        VALUES (
          @UserLegID, @UserID, @UniqueSeqNo, @EffDate, @ThruDate, @Frequency, @SeqNo, @SeqLegNo, @DeptStn, @ArrvStn, @DptTime, @DptZone, @ArvTime, @ArvZone,
          @FitNo, @FitLegNo, @EOD, @LegTotalFlying, @LegEqupType, @LegDeadheadCode, @LegMidnightCode, @LegPC, @PCCode,
          @SchedOverFlow, @DVSD, @DVLA, @LayoverTime, @DPOnDutyTime, @DPDeadheadTime, @DVLA2, @LegNiteFly, @Unused,
          @Calendar_40Day, @Terminal, @GateNumber, @FlightStatus, @BookingCode, @SeatNumber, @TailNumber, @UserSequenceId,
          @LegEndDateLocal, @LegEndDateUtc, @LegStartDateLocal, @LegStartDateUtc, @LegEndTimeLocal, @LegEndTimeUtc,
          @LegStartTimeLocal, @LegStartTimeUtc, @CvtArvTime, @CvtDPDeadheadTime, @CvtDPOnDutyTime, @CvtDptTime,
          @CvtLegNiteFly, @CvtLegPC, @CvtLegTotalFlying, @CvtLayover, @BidMonth
        )
      `);
    }
    return legs.recordset;
};
exports.addLegDataInUserLeg = addLegDataInUserLeg;
const getAllCrews = async () => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
        SELECT 
            CrewID AS crewId,
            Base AS base,
            OccDate AS occDate
        FROM dbo.Users
        WHERE Base IS NOT NULL AND OccDate IS NOT NULL
    `);
    return result.recordset.map(row => ({
        crewId: row.crewId,
        base: row.base,
        occDate: row.occDate
    }));
};
exports.getAllCrews = getAllCrews;
// helper function
const getYearsOfService = (hireDate, today = new Date()) => {
    let years = today.getFullYear() - hireDate.getFullYear();
    const monthDiff = today.getMonth() - hireDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < hireDate.getDate())) {
        years--;
    }
    return years + 1;
};
// new
const getCrewPayDetails = async (crewId) => {
    const pool = await (0, db_1.getPool)();
    // 1️⃣ Get current crew details
    const crewResult = await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
        .query(`
      SELECT CrewId, OccDate, Base
      FROM Roster
      WHERE CrewId = @crewId
    `);
    const crew = crewResult.recordset[0];
    if (!crew || !crew.OccDate) {
        return {
            basePay: null,
            yearsOfService: null,
            companySeniority: null,
            aaSeniority: null,
            note: "Crew not found or OccDate missing"
        };
    }
    // 2️⃣ Compute current crew's years of service
    const yearsOfService = getYearsOfService(new Date(crew.OccDate));
    // 3️⃣ Get all crews (for company seniority)
    const allCrewResult = await pool.request().query(`
    SELECT CrewId, OccDate
    FROM Roster
    WHERE OccDate IS NOT NULL
  `);
    const allCrews = allCrewResult.recordset.map(c => ({
        crewId: c.CrewId,
        years: getYearsOfService(new Date(c.OccDate))
    }));
    // Sort descending (most experienced first)
    allCrews.sort((a, b) => b.years - a.years);
    const companyIndex = allCrews.findIndex(c => c.crewId === crew.CrewId);
    const totalCompany = allCrews.length;
    let companySeniorityPct = 0;
    if (companyIndex !== -1 && totalCompany > 1) {
        const below = totalCompany - companyIndex - 1;
        companySeniorityPct = Number(((below / (totalCompany - 1)) * 100).toFixed(2));
    }
    // 4️⃣ Get all crews in same base (for AA seniority)
    const baseCrewResult = await pool.request()
        .input("Base", db_1.sql.VarChar, crew.Base)
        .query(`
      SELECT CrewId, OccDate
      FROM Roster
      WHERE Base = @Base AND OccDate IS NOT NULL
    `);
    const baseCrews = baseCrewResult.recordset.map(c => ({
        crewId: c.CrewId,
        years: getYearsOfService(new Date(c.OccDate))
    }));
    baseCrews.sort((a, b) => b.years - a.years);
    const aaIndex = baseCrews.findIndex(c => c.crewId === crew.CrewId);
    const totalBase = baseCrews.length;
    let aaSeniorityPct = 0;
    if (aaIndex !== -1 && totalBase > 1) {
        const below = totalBase - aaIndex - 1;
        aaSeniorityPct = Number(((below / (totalBase - 1)) * 100).toFixed(2));
    }
    // 5️⃣ Get base pay based on capped years
    const cappedYears = Math.min(yearsOfService, 13);
    const basePayResult = await pool.request()
        .input("YearsOfService", db_1.sql.Int, cappedYears)
        .query(`
      SELECT TOP 1 *
      FROM BasePay
      WHERE YearsOfService = @YearsOfService
    `);
    const basePay = basePayResult.recordset[0] || null;
    // 6️⃣ Return final structured result
    return {
        basePay,
        yearsOfService,
        // aaSeniority: {
        //   rank: companyIndex + 1,
        //   totalInCompany: totalCompany,
        //   percentage: companySeniorityPct
        // },
        baseSeniority: {
            base: crew.Base,
            rank: aaIndex + 1,
            totalInBase: totalBase,
            percentage: aaSeniorityPct
        },
        note: basePay ? null : "Base pay not found for this level of service"
    };
};
exports.getCrewPayDetails = getCrewPayDetails;
const getCrewPayDetail = async (crewIds) => {
    if (!crewIds.length)
        return [];
    const pool = await (0, db_1.getPool)();
    // 1. Get crew info (OccDate)
    const crewResult = await pool.request().query(`
    SELECT CrewID, OccDate
    FROM Roster
    WHERE CrewID IN (${crewIds.join(",")})
  `);
    // 2. Compute years of service for each crew
    const today = new Date();
    const serviceMap = {};
    for (const row of crewResult.recordset) {
        if (!row.OccDate) {
            serviceMap[row.CrewID] = 0;
            continue;
        }
        const years = getYearsOfService(new Date(row.OccDate), today);
        serviceMap[row.CrewID] = Math.min(years, 13); // cap at 13
    }
    // 3. Get all relevant BasePay rows in one go
    const uniqueYears = [...new Set(Object.values(serviceMap))].filter(y => y > 0);
    let basePayMap = {};
    if (uniqueYears.length > 0) {
        const payResult = await pool.request().query(`
      SELECT * FROM BasePay
      WHERE YearsOfService IN (${uniqueYears.join(",")})
    `);
        basePayMap = payResult.recordset.reduce((acc, row) => {
            acc[row.YearsOfService] = row;
            return acc;
        }, {});
    }
    // 4. Map back to each crew
    return crewIds.map(id => {
        const years = serviceMap[id] ?? 0;
        return {
            crewId: id,
            basePay: basePayMap[years] || null,
            yearsOfService: years,
            moreThan13Years: years > 13
        };
    });
};
exports.getCrewPayDetail = getCrewPayDetail;
// old
// export const getUserLanguages = async (userId: string) => {
//   const pool = await getPool();
//   // 1. Get crew hireDate
//   const crewResult = await pool.request()
//     .input("userId", sql.UniqueIdentifier, userId)
//     .query(`
//       SELECT *
//       FROM UserLanguage
//       WHERE UserID = @userId
//     `);
//   const crewLanguages = crewResult.recordset;
//   return crewLanguages
// }
// new
const getUserLanguages = async (userId) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("userId", db_1.sql.UniqueIdentifier, userId)
        .query(`
      SELECT 
        UL.LanguageID,
        L.SpokenLanguage
      FROM UserLanguage UL
      INNER JOIN Language L
        ON UL.LanguageID = L.LanguageID
      WHERE UL.UserID = @userId
    `);
    return result.recordset; // array of languages with names
};
exports.getUserLanguages = getUserLanguages;
async function getDynamicBaseRate(yearsOfService) {
    const now = new Date();
    // const currentYear = now.getFullYear();
    // const nextOctober = new Date(`${currentYear}-10-01`);
    // console.log("🔍 Using column:", now);
    // // 🧠 Determine which pay column to use dynamically
    // const payColumn =
    //   now < nextOctober
    //     ? `Pay_10/1/${String(currentYear).slice(-2)}`
    //     : `Pay_10/1/${String(currentYear + 1).slice(-2)}`;
    let effectiveYear = now.getFullYear();
    // Get the Oct 1st of this year
    const currentOct = new Date(`${effectiveYear}-10-01`);
    // If we are before Oct 1 of this year, pay is based on last October
    if (now < currentOct) {
        effectiveYear = effectiveYear - 1;
    }
    // Now use the pay rate effective from October of `effectiveYear`
    const payColumn = `Pay_10/1/${String(effectiveYear).slice(-2)}`;
    console.log("🔍 Using column:", payColumn);
    try {
        const pool = await (0, db_1.getPool)();
        // 1. Get crew hireDate
        // const crewResult = await pool.request()
        const query = `
      SELECT [${payColumn}] AS baseRate
      FROM dbo.BasePay
      WHERE YearsOfService = @yearsOfService
    `;
        const result = await pool
            .request()
            .input("YearsOfService", db_1.sql.Int, yearsOfService)
            .query(query);
        return result.recordset.length ? Number(result.recordset[0].baseRate) : 0;
    }
    catch (err) {
        console.error("Error fetching dynamic base rate:", err);
        return 0;
    }
}
const deleteLanguages = async (userId) => {
    const pool = await (0, db_1.getPool)();
    console.log("Deleting languages for user:", userId);
    const request = pool.request();
    request.input('userId', db_1.sql.UniqueIdentifier, userId);
    const sqlQuery = `
    DELETE FROM dbo.UserLanguage 
    WHERE userId = @userId;
  `;
    try {
        const result = await request.query(sqlQuery);
        console.log(`Deleted ${result.rowsAffected[0]} record(s) for user ${userId}`);
    }
    catch (error) {
        console.error(`Error deleting for user '${userId}':`, error);
        throw error; // optional: rethrow if caller needs to handle
    }
};
exports.deleteLanguages = deleteLanguages;
