
import { NewCrew } from '../models/newCrewModel';
import { BasePay } from '../models/BasePay';
import { getPool, sql } from "../config/db";
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Types } from 'mongoose';
import { UserSequence } from '../models/UserSequence';
import * as crypto from "crypto";

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

export const findBySequenceNo = async (seqNo: number, bidMonth: string) => {
  const pool = await getPool();

  const request = pool.request();
  request.input("seqNo", sql.Int, seqNo);
  request.input("bidMonth", sql.NVarChar, bidMonth);

  const result = await request.query(`
    SELECT *
    FROM dbo.Sequence
    WHERE SeqNo = @seqNo
      AND BidMonth = @bidMonth
  `);

  return result.recordset;
};

export const findUserAppliedSequenceNo = async (seqNo: number, bidMonth: string, userId: string) => {
  const pool = await getPool();

  const request = pool.request();
  request.input("seqNo", sql.Int, seqNo);
  // request.input("bidMonth", sql.NVarChar, bidMonth);
  request.input("userId", sql.UniqueIdentifier, userId);

  const result = await request.query(`
    SELECT *
    FROM dbo.UserSequence
    WHERE SeqNo = @seqNo
    AND UserID = @userId
    `);
  // AND BidMonth = @bidMonth

  return result.recordset;
};

export const findByDateAndSeqNo = async (seqNo: number, effDate: String) => {
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
            FROM boarding_pay
            WHERE YearsOfService = @YearsOfService 
        `);

  return result.recordset.length > 0 ? result.recordset[0] : null;
}

// export const updatePosition = async (seqNo: number, position: number, effDate: Date) => {
export const updatePosition = async (seqNo: number, position: number, bidMonth: string) => {
  const pool = await getPool();

  // 1) Fetch the row
  const result = await pool.request()
    .input("seqNo", sql.Int, seqNo)
    // .input("effDate", sql.NVarChar, effDate)
    .input("bidMonth", sql.NVarChar, bidMonth)
    .query(`
      SELECT *
      FROM Sequence
      WHERE SeqNo = @seqNo AND BidMonth = @bidMonth
    `);

  if (result.recordset.length === 0) return null;

  // Get the row object
  let row = result.recordset[0];
  let seqCrewPos: string = row.SeqCrewPos;

  // 2) Update the SeqCrewPos string
  let seqCrewPosArr = seqCrewPos.split("");

  let originalDigit = seqCrewPosArr[position - 1];

  if (position > 0 && position <= seqCrewPosArr.length) {
    seqCrewPosArr[position - 1] = "0"; // mark position as taken
  }

  const updatedSeqCrewPos = seqCrewPosArr.join("");

  // 3) Update DB
  await pool.request()
    .input("seqNo", sql.Int, seqNo)
    // .input("effDate", sql.NVarChar, effDate)
    .input("bidMonth", sql.NVarChar, bidMonth)
    .input("seqCrewPos", sql.VarChar, updatedSeqCrewPos)
    .query(`
      UPDATE Sequence
      SET SeqCrewPos = @seqCrewPos
      WHERE SeqNo = @seqNo AND BidMonth = @bidMonth
    `);

  // 4) Return the updated row (with new SeqCrewPos)
  return {
    ...row,
    SeqCrewPos: updatedSeqCrewPos,
    originalDigit
  };
};

export const addSequenceDataInUserSequence = async (
  userId: string,
  crewSeqPos: any,
  position: number,
  effDate: Date,
  digit: string,
  // effDate: string
) => {
  const userSequenceId = uuidv4();
  const pool = await getPool();
  const request = pool.request();

  request.input("UserSequenceID", sql.NVarChar, userSequenceId);
  request.input("UserID", sql.UniqueIdentifier, userId);
  request.input("UniqueSeqNo", sql.NVarChar, crewSeqPos.UniqueSeqNo);
  request.input("RecordType", sql.Int, crewSeqPos.RecordType);
  request.input("CrewCat", sql.NVarChar, crewSeqPos.CrewCat);
  request.input("CrewBase", sql.NVarChar, crewSeqPos.CrewBase);
  request.input("SeqCategory", sql.NVarChar, crewSeqPos.SeqCategory);
  request.input("DataVersion", sql.NVarChar, crewSeqPos.DataVersion);
  // request.input("EffDate", sql.Date, crewSeqPos.EffDate);
  request.input("EffDate", sql.Date, effDate);
  request.input("ThruDate", sql.Date, crewSeqPos.ThruDate);
  request.input("Frequency", sql.NVarChar, crewSeqPos.Frequency);
  request.input("SeqNo", sql.Int, crewSeqPos.SeqNo);
  request.input("SeqType", sql.Int, crewSeqPos.SeqType);
  request.input("NBR_Legs", sql.Int, crewSeqPos.NBR_Legs);
  request.input("NBR_Days", sql.Int, crewSeqPos.NBR_Days);
  request.input("NBR_Duty", sql.Int, crewSeqPos.NBR_Duty);
  request.input("SeqCrewPos", sql.NVarChar, crewSeqPos.SeqCrewPos);
  request.input("SeqFlyTime", sql.Int, crewSeqPos.SeqFlyTime);
  request.input("SeqPC", sql.Int, crewSeqPos.SeqPC);
  request.input("TAFB", sql.Int, crewSeqPos.TAFB);
  request.input("AutoExp", sql.Int, crewSeqPos.AutoExp);
  request.input("Pay", sql.Decimal, crewSeqPos.Pay);
  request.input("PriorSeq", sql.NVarChar, crewSeqPos.PriorSeq);
  request.input("DateRmvd", sql.Date, crewSeqPos.DateRmvd);
  request.input("SeqPremTime", sql.Int, crewSeqPos.SeqPremTime);
  request.input("Language1", sql.NVarChar, crewSeqPos.Language1);
  request.input("Language2", sql.NVarChar, crewSeqPos.Language2);
  request.input("Reserved", sql.NVarChar, crewSeqPos.Reserved);
  request.input("B777300", sql.Bit, crewSeqPos.B777300);
  request.input("B77W300", sql.Bit, crewSeqPos.B77W300);
  request.input("B772_200", sql.Bit, crewSeqPos.B772_200);
  request.input("B787_900", sql.Bit, crewSeqPos.B787_900);
  request.input("B787_800", sql.Bit, crewSeqPos.B787_800);
  request.input("B787P_900", sql.Bit, crewSeqPos.B787P_900);
  request.input("A321_AK", sql.Bit, crewSeqPos.A321_AK);
  request.input("A321_XLR", sql.Bit, crewSeqPos.A321_XLR);
  request.input("A321_NEO", sql.Bit, crewSeqPos.A321_NEO);
  request.input("A321", sql.Bit, crewSeqPos.A321);
  request.input("A320", sql.Bit, crewSeqPos.A320);
  request.input("A319", sql.Bit, crewSeqPos.A319);
  request.input("B737_MAX", sql.Bit, crewSeqPos.B737_MAX);
  request.input("B737", sql.Bit, crewSeqPos.B737);
  request.input("E190", sql.Bit, crewSeqPos.E190);
  request.input("CovidStationRestriction", sql.NVarChar, crewSeqPos.CovidStationRestriction);
  request.input("Redeye", sql.Bit, crewSeqPos.Redeye);
  request.input("ODAN", sql.Bit, crewSeqPos.ODAN);
  request.input("IPDPremium", sql.Bit, crewSeqPos.IPDPremium);
  request.input("Charter", sql.Bit, crewSeqPos.Charter);
  request.input("Satellite", sql.Bit, crewSeqPos.Satellite);
  request.input("CoTerminal", sql.NVarChar, crewSeqPos.CoTerminal);
  request.input("PremiumTranscon", sql.Bit, crewSeqPos.PremiumTranscon);
  request.input("Rocket", sql.Bit, crewSeqPos.Rocket);
  request.input("IPD", sql.Bit, crewSeqPos.IPD);
  request.input("NIPD", sql.Bit, crewSeqPos.NIPD);
  request.input("Notes", sql.NVarChar, crewSeqPos.Notes);
  request.input("CvtSeqFlyTime", sql.NVarChar, crewSeqPos.CvtSeqFlyTime);
  request.input("CvtSeqPC", sql.NVarChar, crewSeqPos.CvtSeqPC);
  request.input("CvtTAFB", sql.NVarChar, crewSeqPos.CvtTAFB);
  request.input("CvtSeqPremTime", sql.NVarChar, crewSeqPos.CvtSeqPremTime);
  request.input("BidMonth", sql.NVarChar, crewSeqPos.BidMonth);
  request.input("PositionAppliedOn", sql.Int, position);
  request.input("PositionAppliedOnLetter", sql.Char, digit);

  const query = `
    INSERT INTO UserSequence (
      UserSequenceID, UserID, UniqueSeqNo, RecordType, CrewCat, CrewBase, SeqCategory, DataVersion, EffDate,
      ThruDate, Frequency, SeqNo, SeqType, NBR_Legs, NBR_Days, NBR_Duty, SeqCrewPos, SeqFlyTime, SeqPC, TAFB,
      AutoExp, Pay, PriorSeq, DateRmvd, SeqPremTime, Language1, Language2, Reserved, B777300, B77W300, B772_200,
      B787_900, B787_800, B787P_900, A321_AK, A321_XLR, A321_NEO, A321, A320, A319, B737_MAX, B737, E190, CovidStationRestriction,
      Redeye, ODAN, IPDPremium, Charter,Satellite, CoTerminal, PremiumTranscon, Rocket, IPD, NIPD, Notes, CvtSeqFlyTime, CvtSeqPC,
      CvtTAFB, CvtSeqPremTime, BidMonth, PositionAppliedOn, PositionAppliedOnLetter
    )
    VALUES (
      @UserSequenceID, @UserID, @UniqueSeqNo, @RecordType, @CrewCat, @CrewBase, @SeqCategory, @DataVersion, @EffDate,
      @ThruDate, @Frequency, @SeqNo, @SeqType, @NBR_Legs, @NBR_Days, @NBR_Duty, @SeqCrewPos, @SeqFlyTime, @SeqPC, @TAFB,
      @AutoExp,
      @Pay, @PriorSeq, @DateRmvd, @SeqPremTime, @Language1, @Language2, @Reserved, @B777300, @B77W300, @B772_200, @B787_900,
      @B787_800, @B787P_900, @A321_AK, @A321_XLR, @A321_NEO, @A321, @A320, @A319, @B737_MAX, @B737, @E190, @CovidStationRestriction,
      @Redeye, @ODAN, @IPDPremium, @Charter, @Satellite, @CoTerminal, @PremiumTranscon, @Rocket, @IPD, @NIPD, @Notes, @CvtSeqFlyTime, @CvtSeqPC,
      @CvtTAFB, @CvtSeqPremTime, @BidMonth, @PositionAppliedOn, @PositionAppliedOnLetter
    )`;

  await request.query(query);

  return userSequenceId;
};

export const addLegDataInUserLeg = async (
  seqNo: number,
  bidMonth: string,
  // effDate: Date,
  newUserSequenceId: string,
) => {
  const pool = await getPool();

  // 1) Get all legs for this SeqNo + BidMonth
  const legs = await pool.request()
    .input("seqNo", sql.Int, seqNo)
    // .input("effDate", sql.NVarChar(50), effDate)
    .input("bidMonth", sql.NVarChar, bidMonth)
    .query(`
      SELECT *
      FROM Leg
      WHERE SeqNo = @seqNo AND BidMonth = @bidMonth
      `);
  // WHERE SeqNo = @seqNo AND EffDate = @effDate

  if (legs.recordset.length === 0) return [];

  console.log("-->>", legs);
  // 2) Insert each leg into UserLeg
  for (const leg of legs.recordset) {
    // ✅ Generate unique ID for each insert
    const userLegId = crypto.createHash("sha1")
      .update(uuidv4())
      .digest("hex")
      .substring(0, 25);

    await pool.request()
      .input("UserLegID", sql.NVarChar(25), userLegId)
      .input("UniqueSeqNo", sql.VarChar(25), leg.UniqueSeqNo)
      .input("SeqNo", sql.Int, leg.SeqNo)
      .input("SeqLegNo", sql.Int, leg.SeqLegNo)
      .input("DeptStn", sql.VarChar(3), leg.DeptStn)
      .input("ArrvStn", sql.VarChar(3), leg.ArrvStn)
      .input("DptTime", sql.Int, leg.DptTime)
      .input("DptZone", sql.Int, leg.DptZone)
      .input("ArvTime", sql.Int, leg.ArvTime)
      .input("ArvZone", sql.Int, leg.ArvZone)
      .input("FitNo", sql.Int, leg.FitNo)
      .input("FitLegNo", sql.Int, leg.FitLegNo)
      .input("EOD", sql.Bit, leg.EOD)
      .input("LegTotalFlying", sql.Int, leg.LegTotalFlying)
      .input("LegEqupType", sql.Int, leg.leg_equip_type)
      .input("LegDeadheadCode", sql.Bit, leg.LegDeadheadCode)
      .input("LegMidnightCode", sql.Int, leg.LegMidnightCode)
      .input("LegPC", sql.Int, leg.LegPC)
      .input("PCCode", sql.Int, leg.PCCode)
      .input("SchedOverFlow", sql.Int, leg.SchedOverFlow)
      .input("DVSD", sql.Int, leg.DVSD)
      .input("DVLA", sql.Int, leg.DVLA)
      .input("LayoverTime", sql.Int, leg.Layover)
      .input("DPOnDutyTime", sql.Int, leg.DPOnDutyTime)
      .input("DPDeadheadTime", sql.Int, leg.DPDeadheadTime)
      .input("DVLA2", sql.Int, leg.DVLA2)
      .input("LegNiteFly", sql.Int, leg.LegNiteFly)
      .input("Unused", sql.Int, leg.Unused)
      .input("Calendar_40Day", sql.VarChar(50), leg.Calendar_40Day)
      .input("Terminal", sql.VarChar(25), leg.Terminal)
      .input("GateNumber", sql.VarChar(10), leg.GateNumber)
      .input("FlightStatus", sql.VarChar(50), leg.FlightStatus)
      .input("BookingCode", sql.VarChar(25), leg.BookingCode)
      .input("SeatNumber", sql.VarChar(3), leg.SeatNumber)
      .input("TailNumber", sql.VarChar(25), leg.TailNumber)
      .input("UserSequenceId", sql.UniqueIdentifier, newUserSequenceId)
      .input("LegEndDateLocal", sql.Date, leg.LegEndDateLocal)
      .input("LegEndDateUtc", sql.Date, leg.LegEndDateUtc)
      .input("LegStartDateLocal", sql.Date, leg.LegStartDateLocal)
      .input("LegStartDateUtc", sql.Date, leg.LegStartDateUtc)
      .input("LegEndTimeLocal", sql.NVarChar(1000), leg.LegEndTimeLocal)
      .input("LegEndTimeUtc", sql.NVarChar(1000), leg.LegEndTimeUtc)
      .input("LegStartTimeLocal", sql.NVarChar(1000), leg.LegStartTimeLocal)
      .input("LegStartTimeUtc", sql.NVarChar(1000), leg.LegStartTimeUtc)
      .input("CvtArvTime", sql.VarChar(5), leg.CvtArvTime)
      .input("CvtDPDeadheadTime", sql.VarChar(5), leg.CvtDPDeadheadTime)
      .input("CvtDPOnDutyTime", sql.VarChar(5), leg.CvtDPOnDutyTime)
      .input("CvtDptTime", sql.VarChar(5), leg.CvtDptTime)
      .input("CvtLegNiteFly", sql.VarChar(5), leg.CvtLegNiteFly)
      .input("CvtLegPC", sql.VarChar(5), leg.CvtLegPC)
      .input("CvtLegTotalFlying", sql.VarChar(5), leg.CvtLegTotalFlying)
      .input("CvtLayoverTime", sql.VarChar(7), leg.CvtLayover)
      .input("BidMonth", sql.VarChar(7), leg.BidMonth)
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

export const getAllCrews = async () => {
  const pool = await getPool();

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

// helper function
const getYearsOfService = (hireDate: Date, today = new Date()): number => {
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
export const getCrewPayDetails = async (crewId: number) => {
  const pool = await getPool();

  // 1️⃣ Get current crew details
  const crewResult = await pool.request()
    .input("crewId", sql.Int, crewId)
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
    .input("Base", sql.VarChar, crew.Base)
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
    .input("YearsOfService", sql.Int, cappedYears)
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

export const getCrewPayDetail = async (crewIds: number[]) => {
  if (!crewIds.length) return [];

  const pool = await getPool();

  // 1. Get crew info (OccDate)
  const crewResult = await pool.request().query(`
    SELECT CrewID, OccDate
    FROM Roster
    WHERE CrewID IN (${crewIds.join(",")})
  `);

  // 2. Compute years of service for each crew
  const today = new Date();
  const serviceMap: Record<number, number> = {};
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
  let basePayMap: Record<number, any> = {};

  if (uniqueYears.length > 0) {
    const payResult = await pool.request().query(`
      SELECT * FROM BasePay
      WHERE YearsOfService IN (${uniqueYears.join(",")})
    `);

    basePayMap = payResult.recordset.reduce((acc: any, row: any) => {
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

export const getUserLanguages = async (userId: string) => {
  const pool = await getPool();

  const result = await pool.request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`
      SELECT 
        UL.LanguageID,
        L.SpokenLanguage
      FROM UserLanguage UL
      INNER JOIN Language L
        ON UL.LanguageID = L.LanguageID
      WHERE UL.UserID = @userId
    `);

  return result.recordset;  // array of languages with names
};

export async function getDynamicBaseRate(yearsOfService: number): Promise<number> {
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
    const pool = await getPool();

    // 1. Get crew hireDate
    // const crewResult = await pool.request()
    const query = `
      SELECT [${payColumn}] AS baseRate
      FROM dbo.BasePay
      WHERE YearsOfService = @yearsOfService
    `;

    const result = await pool
      .request()
      .input("YearsOfService", sql.Int, yearsOfService)
      .query(query);

    return result.recordset.length ? Number(result.recordset[0].baseRate) : 0;
  } catch (err) {
    console.error("Error fetching dynamic base rate:", err);
    return 0;
  }
}