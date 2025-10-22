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
exports.getUserLanguages = exports.getCrewPayDetail = exports.getCrewPayDetails = exports.getAllCrews = exports.addLegDataInUserLeg = exports.addSequenceDataInUserSequence = exports.updatePosition = exports.getBoardingPayByYears = exports.findByDateAndSeqNo = exports.findUserAppliedSequenceNo = exports.findBySequenceNo = exports.findByCrewId = exports.UpdatePassword = exports.findCrewById = exports.findCrewByEmail = void 0;
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
    SELECT * FROM Users WHERE crewId = @crewId
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
const findByDateAndSeqNo = async (seqNo, effDate) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("seqNo", db_1.sql.Int, seqNo)
        .input("effDate", db_1.sql.Date, effDate)
        .query(`
            SELECT *
            FROM Leg
            WHERE SeqNo = @seqNo 
            AND EffDate = @effDate
        `);
    return result.recordset.length > 0 ? result.recordset : null;
};
exports.findByDateAndSeqNo = findByDateAndSeqNo;
const getBoardingPayByYears = async (YearsOfService) => {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request()
        .input("YearsOfService", db_1.sql.Int, YearsOfService)
        .query(`
            SELECT *
            FROM BoardingPay
            WHERE YearsOfService = @YearsOfService 
        `);
    return result.recordset.length > 0 ? result.recordset[0] : null;
};
exports.getBoardingPayByYears = getBoardingPayByYears;
const updatePosition = async (seqNo, position, effDate) => {
    const pool = await (0, db_1.getPool)();
    // 1) Fetch the row
    const result = await pool.request()
        .input("seqNo", db_1.sql.Int, seqNo)
        .input("effDate", db_1.sql.NVarChar, effDate)
        .query(`
      SELECT *
      FROM Sequence
      WHERE SeqNo = @seqNo AND EffDate = @effDate
    `);
    if (result.recordset.length === 0)
        return null;
    // Get the row object
    let row = result.recordset[0];
    let seqCrewPos = row.SeqCrewPos;
    // 2) Update the SeqCrewPos string
    let seqCrewPosArr = seqCrewPos.split("");
    if (position > 0 && position <= seqCrewPosArr.length) {
        seqCrewPosArr[position - 1] = "0"; // mark position as taken
    }
    const updatedSeqCrewPos = seqCrewPosArr.join("");
    // 3) Update DB
    await pool.request()
        .input("seqNo", db_1.sql.Int, seqNo)
        .input("effDate", db_1.sql.NVarChar, effDate)
        .input("seqCrewPos", db_1.sql.VarChar, updatedSeqCrewPos)
        .query(`
      UPDATE Sequence
      SET SeqCrewPos = @seqCrewPos
      WHERE SeqNo = @seqNo AND EffDate = @effDate
    `);
    // 4) Return the updated row (with new SeqCrewPos)
    return {
        ...row,
        SeqCrewPos: updatedSeqCrewPos
    };
};
exports.updatePosition = updatePosition;
const addSequenceDataInUserSequence = async (userId, crewSeqPos) => {
    const userSequenceId = (0, uuid_1.v4)();
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    request.input("UserSequenceID", db_1.sql.NVarChar, userSequenceId);
    request.input("UserID", db_1.sql.UniqueIdentifier, userId);
    request.input("UniqueSeqNo", db_1.sql.NVarChar, crewSeqPos.UniqueSeqNo);
    request.input("RecordType", db_1.sql.Int, crewSeqPos.RecordType);
    request.input("CrewCat", db_1.sql.NVarChar, crewSeqPos.CrewCat);
    request.input("CrewBase", db_1.sql.NVarChar, crewSeqPos.CrewBase);
    request.input("SeqCategory", db_1.sql.NVarChar, crewSeqPos.SeqCategory);
    request.input("DataVersion", db_1.sql.NVarChar, crewSeqPos.DataVersion);
    request.input("EffDate", db_1.sql.Date, crewSeqPos.EffDate);
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
    request.input("BidMonth", db_1.sql.NVarChar, crewSeqPos.BidMonth);
    const query = `
    INSERT INTO UserSequence (
      UserSequenceID, UserID, UniqueSeqNo, RecordType, CrewCat, CrewBase, SeqCategory, DataVersion, EffDate,
      ThruDate, Frequency, SeqNo, SeqType, NBR_Legs, NBR_Days, NBR_Duty, SeqCrewPos, SeqFlyTime, SeqPC, TAFB,
      AutoExp, Pay, PriorSeq, DateRmvd, SeqPremTime, Language1, Language2, Reserved, B777300, B77W300, B772_200,
      B787_900, B787_800, B787P_900, A321_AK, A321_XLR, A321_NEO, A321, A320, A319, B737_MAX, B737, E190, CovidStationRestriction,
      Redeye, ODAN, IPDPremium, Charter,Satellite, CoTerminal, PremiumTranscon, Rocket, IPD, NIPD, Notes, BidMonth
    )
    VALUES (
      @UserSequenceID, @UserID, @UniqueSeqNo, @RecordType, @CrewCat, @CrewBase, @SeqCategory, @DataVersion, @EffDate,
      @ThruDate, @Frequency, @SeqNo, @SeqType, @NBR_Legs, @NBR_Days, @NBR_Duty, @SeqCrewPos, @SeqFlyTime, @SeqPC, @TAFB,
      @AutoExp,
      @Pay, @PriorSeq, @DateRmvd, @SeqPremTime, @Language1, @Language2, @Reserved, @B777300, @B77W300, @B772_200, @B787_900,
      @B787_800, @B787P_900, @A321_AK, @A321_XLR, @A321_NEO, @A321, @A320, @A319, @B737_MAX, @B737, @E190, @CovidStationRestriction,
      @Redeye, @ODAN, @IPDPremium, @Charter, @Satellite, @CoTerminal, @PremiumTranscon, @Rocket, @IPD, @NIPD, @Notes, @BidMonth
    )`;
    await request.query(query);
    return userSequenceId;
};
exports.addSequenceDataInUserSequence = addSequenceDataInUserSequence;
const addLegDataInUserLeg = async (seqNo, effDate, newUserSequenceId) => {
    const pool = await (0, db_1.getPool)();
    // 1) Get all legs for this SeqNo + BidMonth
    const legs = await pool.request()
        .input("seqNo", db_1.sql.Int, seqNo)
        .input("effDate", db_1.sql.NVarChar(50), effDate)
        .query(`
      SELECT *
      FROM Leg
      WHERE SeqNo = @seqNo AND EffDate = @effDate
    `);
    if (legs.recordset.length === 0)
        return [];
    // 2) Insert each leg into UserLeg
    for (const leg of legs.recordset) {
        // ✅ Generate unique ID for each insert
        const userLegId = crypto.createHash("sha1")
            .update((0, uuid_1.v4)())
            .digest("hex")
            .substring(0, 25);
        await pool.request()
            .input("UserLegID", db_1.sql.NVarChar(25), userLegId)
            .input("UniqueSeqNo", db_1.sql.VarChar(25), leg.UniqueSeqNo)
            .input("SeqNo", db_1.sql.Int, leg.SeqNo)
            .input("SeqLegNo", db_1.sql.Int, leg.SeqLegNo)
            .input("DeptStn", db_1.sql.VarChar(3), leg.DeptStn)
            .input("ArrvStn", db_1.sql.VarChar(3), leg.ArrvStn)
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
            .input("LayoverTime", db_1.sql.Int, leg.LayoverTime)
            .input("DPOnDutyTime", db_1.sql.Int, leg.DPOnDutyTime)
            .input("DPDeadheadTime", db_1.sql.Int, leg.DPDeadheadTime)
            .input("DVLA2", db_1.sql.Int, leg.DVLA2)
            .input("LegNiteFly", db_1.sql.Int, leg.LegNiteFly)
            .input("Unused", db_1.sql.Int, leg.Unused)
            .input("Calendar_40Day", db_1.sql.VarChar(50), leg.Calendar_40Day)
            .input("Terminal", db_1.sql.VarChar(25), leg.Terminal)
            .input("GateNumber", db_1.sql.VarChar(10), leg.GateNumber)
            .input("FlightStatus", db_1.sql.VarChar(50), leg.FlightStatus)
            .input("BookingCode", db_1.sql.VarChar(25), leg.BookingCode)
            .input("SeatNumber", db_1.sql.VarChar(3), leg.SeatNumber)
            .input("TailNumber", db_1.sql.VarChar(25), leg.TailNumber)
            .input("UserSequenceId", db_1.sql.UniqueIdentifier, newUserSequenceId)
            .input("LegEndDateLocal", db_1.sql.Date, leg.LegEndDateLocal)
            .input("LegEndDateUtc", db_1.sql.Date, leg.LegEndDateUtc)
            .input("LegStartDateLocal", db_1.sql.Date, leg.LegStartDateLocal)
            .input("LegStartDateUtc", db_1.sql.Date, leg.LegStartDateUtc)
            .input("LegEndTimeLocal", db_1.sql.NVarChar(1000), leg.LegEndTimeLocal)
            .input("LegEndTimeUtc", db_1.sql.NVarChar(1000), leg.LegEndTimeUtc)
            .input("LegStartTimeLocal", db_1.sql.NVarChar(1000), leg.LegStartTimeLocal)
            .input("LegStartTimeUtc", db_1.sql.NVarChar(1000), leg.LegStartTimeUtc)
            .input("CvtArvTime", db_1.sql.VarChar(5), leg.CvtArvTime)
            .input("CvtDPDeadheadTime", db_1.sql.VarChar(5), leg.CvtDPDeadheadTime)
            .input("CvtDPOnDutyTime", db_1.sql.VarChar(5), leg.CvtDPOnDutyTime)
            .input("CvtDptTime", db_1.sql.VarChar(5), leg.CvtDptTime)
            .input("CvtLegNiteFly", db_1.sql.VarChar(5), leg.CvtLegNiteFly)
            .input("CvtLegPC", db_1.sql.VarChar(5), leg.CvtLegPC)
            .input("CvtLegTotalFlying", db_1.sql.VarChar(5), leg.CvtLegTotalFlying)
            .input("CvtLayoverTime", db_1.sql.VarChar(7), leg.CvtLayoverTime)
            .input("BidMonth", db_1.sql.VarChar(7), leg.BidMonth)
            .query(`
        INSERT INTO UserLeg (
          UserLegID, UniqueSeqNo, SeqNo, SeqLegNo, DeptStn, ArrvStn, DptTime, DptZone, ArvTime, ArvZone,
          FitNo, FitLegNo, EOD, LegTotalFlying, LegEqupType, LegDeadheadCode, LegMidnightCode, LegPC, PCCode,
          SchedOverFlow, DVSD, DVLA, LayoverTime, DPOnDutyTime, DPDeadheadTime, DVLA2, LegNiteFly, Unused,
          Calendar_40Day, Terminal, GateNumber, FlightStatus, BookingCode, SeatNumber, TailNumber, UserSequenceId,
          LegEndDateLocal, LegEndDateUtc, LegStartDateLocal, LegStartDateUtc, LegEndTimeLocal, LegEndTimeUtc,
          LegStartTimeLocal, LegStartTimeUtc, CvtArvTime, CvtDPDeadheadTime, CvtDPOnDutyTime, CvtDptTime,
          CvtLegNiteFly, CvtLegPC, CvtLegTotalFlying, CvtLayoverTime, BidMonth
        )
        VALUES (
          @UserLegID, @UniqueSeqNo, @SeqNo, @SeqLegNo, @DeptStn, @ArrvStn, @DptTime, @DptZone, @ArvTime, @ArvZone,
          @FitNo, @FitLegNo, @EOD, @LegTotalFlying, @LegEqupType, @LegDeadheadCode, @LegMidnightCode, @LegPC, @PCCode,
          @SchedOverFlow, @DVSD, @DVLA, @LayoverTime, @DPOnDutyTime, @DPDeadheadTime, @DVLA2, @LegNiteFly, @Unused,
          @Calendar_40Day, @Terminal, @GateNumber, @FlightStatus, @BookingCode, @SeatNumber, @TailNumber, @UserSequenceId,
          @LegEndDateLocal, @LegEndDateUtc, @LegStartDateLocal, @LegStartDateUtc, @LegEndTimeLocal, @LegEndTimeUtc,
          @LegStartTimeLocal, @LegStartTimeUtc, @CvtArvTime, @CvtDPDeadheadTime, @CvtDPOnDutyTime, @CvtDptTime,
          @CvtLegNiteFly, @CvtLegPC, @CvtLegTotalFlying, @CvtLayoverTime, @BidMonth
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
// export const getCrewPayDetails = async (crewId: number) => {
//   const pool = await getPool();
//   // 1. Get crew hireDate
//   const crewResult = await pool.request()
//     .input("crewId", sql.Int, crewId)
//     .query(`
//       SELECT OccDate
//       FROM Roster
//       WHERE CrewId = @crewId
//     `);
//   const crew = crewResult.recordset[0];
//   if (!crew) {
//     return { basePay: null, yearsOfService: null, moreThan13Years: false, note: "Crew not found" };
//   }
//   if (!crew.OccDate) {
//     return { basePay: null, yearsOfService: null, moreThan13Years: false, note: "Hire date not provided" };
//   }
//   // 2. Calculate years of service
//   const yearsOfService = getYearsOfService(new Date(crew.OccDate));
//   const cappedYears = Math.min(yearsOfService, 13);
//   // 3. Get base pay for cappedYears
//   const basePayResult = await pool.request()
//     .input("YearsOfService", sql.Int, cappedYears)
//     .query(`
//       SELECT TOP 1 *
//       FROM BasePay
//       WHERE YearsOfService = @YearsOfService
//     `);
//   const basePay = basePayResult.recordset[0] || null;
//   return {
//     basePay,
//     yearsOfService,
//     moreThan13Years: yearsOfService > 13,
//     note: basePay ? null : "Base pay not found for this level of service"
//   };
// };
// old
// export const getCrewPayDetails = async (crewId: number) => {
//   const pool = await getPool();
//   // 1️⃣ Get current crew details
//   const crewResult = await pool.request()
//     .input("crewId", sql.Int, crewId)
//     .query(`
//       SELECT CrewId, OccDate, Base
//       FROM Roster
//       WHERE CrewId = @crewId
//     `);
//   const crew = crewResult.recordset[0];
//   if (!crew || !crew.OccDate) {
//     return {
//       basePay: null,
//       yearsOfService: null,
//       companySeniority: null,
//       aaSeniority: null,
//       note: "Crew not found or OccDate missing"
//     };
//   }
//   // 2️⃣ Compute this crew's years of service
//   const yearsOfService = getYearsOfService(new Date(crew.OccDate));
//   // 3️⃣ Compute Company Seniority (simple capped %)
//   const companySeniorityPct = Math.min((yearsOfService / 13) * 100, 100).toFixed(2);
//   // 4️⃣ Get all crews in the same base
//   const baseCrewResult = await pool.request()
//     .input("Base", sql.VarChar, crew.Base)
//     .query(`
//       SELECT CrewId, OccDate
//       FROM Roster
//       WHERE Base = @Base AND OccDate IS NOT NULL
//     `);
//   const baseCrews = baseCrewResult.recordset;
//   // 5️⃣ Compute each crew’s years of service
//   const allBaseYears = baseCrews.map(c => ({
//     crewId: c.CrewId,
//     years: getYearsOfService(new Date(c.OccDate))
//   }));
//   // Sort descending (most experienced first)
//   allBaseYears.sort((a, b) => b.years - a.years);
//   // Find position of current crew
//   const index = allBaseYears.findIndex(c => c.crewId === crew.CrewId);
//   // 6️⃣ Calculate AA seniority percentage
//   const total = allBaseYears.length;
//   let aaSeniorityPct = 0;
//   if (index !== -1 && total > 1) {
//     // How many people have less experience than this crew
//     const below = total - index - 1;
//     aaSeniorityPct = Number(((below / (total - 1)) * 100).toFixed(2));
//   }
//   // 7️⃣ Get base pay based on capped years
//   const cappedYears = Math.min(yearsOfService, 13);
//   const basePayResult = await pool.request()
//     .input("YearsOfService", sql.Int, cappedYears)
//     .query(`
//       SELECT TOP 1 *
//       FROM BasePay
//       WHERE YearsOfService = @YearsOfService
//     `);
//   const basePay = basePayResult.recordset[0] || null;
//   // 8️⃣ Return final structured result
//   return {
//     basePay,
//     yearsOfService,
//     companySeniority: {
//       percentage: companySeniorityPct,
//       moreThan13Years: yearsOfService > 13
//     },
//     aaSeniority: {
//       base: crew.Base,
//       rank: index + 1,
//       totalInBase: total,
//       percentage: aaSeniorityPct
//     },
//     note: basePay ? null : "Base pay not found for this level of service"
//   };
// };
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
        aaSeniority: {
            rank: companyIndex + 1,
            totalInCompany: totalCompany,
            percentage: companySeniorityPct
        },
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
const getUserLanguages = async (userId) => {
    const pool = await (0, db_1.getPool)();
    // 1. Get crew hireDate
    const crewResult = await pool.request()
        .input("userId", db_1.sql.UniqueIdentifier, userId)
        .query(`
      SELECT *
      FROM UserLanguage
      WHERE UserID = @userId
    `);
    const crewLanguages = crewResult.recordset;
    return crewLanguages;
};
exports.getUserLanguages = getUserLanguages;
