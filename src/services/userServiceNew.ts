
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

export const updatePosition = async (seqNo: number, position: number, bidMonth: string) => {
  const pool = await getPool();

  // 1) Fetch the row
  const result = await pool.request()
    .input("seqNo", sql.Int, seqNo)
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

  if (position > 0 && position <= seqCrewPosArr.length) {
    seqCrewPosArr[position - 1] = "0"; // mark position as taken
  }

  const updatedSeqCrewPos = seqCrewPosArr.join("");

  // 3) Update DB
  await pool.request()
    .input("seqNo", sql.Int, seqNo)
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
    SeqCrewPos: updatedSeqCrewPos
  };
};

export const addSequenceDataInUserSequence = async (
  userId: string,
  crewSeqPos: any,   // this is the row from Sequence (with 59+ columns)
  bidMonth: string
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
  request.input("EffDate", sql.Date, crewSeqPos.EffDate);
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
  request.input("BidMonth", sql.NVarChar, bidMonth);

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

export const addLegDataInUserLeg = async (
  seqNo: number,
  bidMonth: string,
  newUserSequenceId: string,
) => {
  const pool = await getPool();

  // 1) Get all legs for this SeqNo + BidMonth
  const legs = await pool.request()
    .input("seqNo", sql.Int, seqNo)
    .input("bidMonth", sql.NVarChar(50), bidMonth)
    .query(`
      SELECT *
      FROM Leg
      WHERE SeqNo = @seqNo AND BidMonth = @bidMonth
    `);

  if (legs.recordset.length === 0) return [];

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
      .input("LegEqupType", sql.Int, leg.LegEqupType)
      .input("LegDeadheadCode", sql.Bit, leg.LegDeadheadCode)
      .input("LegMidnightCode", sql.Int, leg.LegMidnightCode)
      .input("LegPC", sql.Int, leg.LegPC)
      .input("PCCode", sql.Int, leg.PCCode)
      .input("SchedOverFlow", sql.Int, leg.SchedOverFlow)
      .input("DVSD", sql.Int, leg.DVSD)
      .input("DVLA", sql.Int, leg.DVLA)
      .input("LayoverTime", sql.Int, leg.LayoverTime)
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
      .input("CvtLayoverTime", sql.VarChar(7), leg.CvtLayoverTime)
      .input("BidMonth", sql.VarChar(7), bidMonth)
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
