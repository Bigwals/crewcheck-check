
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
    SELECT * FROM Users WHERE CrewID = @crewId
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

export const UpdateDeviceToken = async (crewId: number, deviceToken: string) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("crewId", sql.Int, crewId)
    .input("deviceToken", sql.NVarChar, deviceToken)
    .query(`
    UPDATE Users SET DeviceToken = @deviceToken WHERE crewId = @crewId 
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

export const findByBidMonth = async (crewBase: string, bidMonth: string) => {

  const pool = await getPool();

  const request = pool.request();
  request.input("crewBase", sql.VarChar, crewBase.trim());
  request.input("bidMonth", sql.NVarChar, bidMonth.trim());
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

// export const findByDateAndUniqueSeqNo = async (uniqueSeqNo: number, frequency_date: String) => {
export const findByDateAndSeqNo = async (uniqueSeqNo: string, frequency_date: String) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
    .input("frequency_date", sql.Date, frequency_date)
    .query(`
            SELECT *
            FROM Frequency
            WHERE UniqueSeqNo = @uniqueSeqNo 
            AND frequency_date = @frequency_date
        `);

  return result.recordset.length > 0 ? result.recordset : null;
};

// export const checkAlreadyApplied = async (seqNo: number, bidMonth: string, effDate: string, userId: string) => {
export const checkAlreadyApplied = async (uniqueSeqNo: string, bidMonth: string, effDate: string, userId: string) => {
  const pool = await getPool();
  const result = await pool.request()
    // .input("seqNo", sql.Int, seqNo)
    .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
    .input("bidMonth", sql.VarChar, bidMonth)
    .input("effDate", sql.VarChar, effDate)
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`
            SELECT *
            FROM UserSequence
            WHERE UniqueSeqNo = @uniqueSeqNo 
            AND BidMonth = @bidMonth
            AND EffDate = @effDate
            AND UserID = @userId
        `);

  return result.recordset.length > 0 ? result.recordset : null;
}

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

// new
export const updatePosition = async (
  uniqueSeqNo: string,
  position: number,
  effDate: string,
  bidMonth: string
) => {
  const pool = await getPool();

  // 1️⃣ ALWAYS get base Sequence row (MASTER DATA)
  const seqBaseResult = await pool.request()
    .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
    .input("bidMonth", sql.NVarChar, bidMonth)
    .query(`
      SELECT * 
      FROM Sequence
      WHERE UniqueSeqNo = @uniqueSeqNo 
        AND BidMonth = @bidMonth
    `);

  if (seqBaseResult.recordset.length === 0) return null;

  const baseRow = seqBaseResult.recordset[0];

  // 2️⃣ Check if effDate exists in Sequence
  const seqEffDateResult = await pool.request()
    .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
    .input("effDate", sql.NVarChar, effDate)
    .query(`
      SELECT 1
      FROM Sequence
      WHERE UniqueSeqNo = @uniqueSeqNo 
        AND EffDate = @effDate
    `);

  const seqEffExists = seqEffDateResult.recordset.length > 0;

  // 3️⃣ Check Frequency table
  const freqResult = await pool.request()
    .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
    .input("effDate", sql.NVarChar, effDate)
    .query(`
      SELECT *
      FROM Frequency
      WHERE UniqueSeqNo = @uniqueSeqNo 
        AND frequency_date = @effDate
    `);

  const freqExists = freqResult.recordset.length > 0;

  // 4️⃣ Update SeqCrewPos string
  const updateSeqCrewPosString = (seqCrewPos: string) => {
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
  let sourceSeqCrewPos: string;

  if (seqEffExists) {
    // ✅ exact date exists in Sequence
    const seqRow = await pool.request()
      .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
      .input("effDate", sql.NVarChar, effDate)
      .query(`
      SELECT SeqCrewPos
      FROM Sequence
      WHERE UniqueSeqNo = @uniqueSeqNo 
        AND EffDate = @effDate
    `);

    sourceSeqCrewPos = seqRow.recordset[0].SeqCrewPos;

  } else if (freqExists) {
    // ✅ only exists in Frequency
    sourceSeqCrewPos = freqResult.recordset[0].SeqCrewPos;

  } else {
    // ⚠️ fallback (rare case)
    sourceSeqCrewPos = baseRow.SeqCrewPos;
  }

  // ✅ NOW apply logic on correct source
  const { updated, originalDigit } = updateSeqCrewPosString(sourceSeqCrewPos);

  // 5️⃣ APPLY UPDATE LOGIC

  // ✅ Case 1: effDate exists in Sequence → update BOTH
  if (seqEffExists) {
    await pool.request()
      .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
      .input("effDate", sql.NVarChar, effDate)
      .input("seqCrewPos", sql.VarChar(20), updated)
      .query(`
        UPDATE Sequence
        SET SeqCrewPos = @seqCrewPos
        WHERE UniqueSeqNo = @uniqueSeqNo 
          AND EffDate = @effDate
      `);

    if (freqExists) {
      await pool.request()
        .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
        .input("effDate", sql.NVarChar, effDate)
        .input("seqCrewPos", sql.VarChar(20), updated)
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
      .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
      .input("effDate", sql.NVarChar, effDate)
      .input("seqCrewPos", sql.VarChar(20), updated)
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

// export const updateCrewProfile = async (crewId: number, base: string, occ_date: string, aa_seniority: string, speaker: string,) => {
export const updateCrewProfile = async (
  crewId: number,
  base: string,
  occ_date: string,
  aa_seniority: string,
  purser: string,
  speaker: string
) => {
  const pool = await getPool();

  // Update query
  await pool.request()
    .input("crewId", sql.Int, crewId)
    .input("base", sql.VarChar, base)
    .input("occ_date", sql.VarChar, occ_date)
    .input("aa_seniority", sql.VarChar, aa_seniority)
    .input("purser", sql.NVarChar, purser)
    .input("speaker", sql.NVarChar, speaker)
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
    .input("crewId", sql.Int, crewId)
    .query(`
      SELECT 
        crewId, FirstName, LastName, Email, ImageUrl, 
        Base, OccDate, Seniority, Purser, Speaker
      FROM Users
      WHERE crewId = @crewId
    `);

  return result.recordset[0];
};

export const addSequenceDataInUserSequence = async (
  userId: string,
  crewSeqPos: any,
  position: number,
  effDate: Date,
  digit: string,
  l_r_type: boolean
) => {
  const userSequenceId = uuidv4();
  const pool = await getPool();
  const request = pool.request();

  // return l_r_type;

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
  request.input("L_R_Type", sql.Bit, l_r_type);
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

export const addLegDataInUserLeg = async (
  userId: string,
  uniqueSeqNo: string,
  bidMonth: string,
  effDate: Date,
  newUserSequenceId: string,
) => {
  const pool = await getPool();

  // 1) Get all legs for this SeqNo + BidMonth
  const legs = await pool.request()
    // .input("seqNo", sql.Int, seqNo)
    .input("uniqueSeqNo", sql.VarChar, uniqueSeqNo)
    // .input("effDate", sql.NVarChar(50), effDate)
    .input("bidMonth", sql.NVarChar, bidMonth)
    .query(`
      SELECT *
      FROM Leg
      WHERE UniqueSeqNo = @uniqueSeqNo AND BidMonth = @bidMonth
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
      .input("UserLegID", sql.NVarChar, userLegId)
      .input("UserID", sql.UniqueIdentifier, userId)
      .input("UniqueSeqNo", sql.VarChar, leg.UniqueSeqNo)
      .input("EffDate", sql.Date, effDate)
      .input("ThruDate", sql.Date, leg.ThruDate)
      .input("Frequency", sql.VarChar, leg.Frequency)
      .input("SeqNo", sql.Int, leg.SeqNo)
      .input("SeqLegNo", sql.Int, leg.SeqLegNo)
      .input("DeptStn", sql.VarChar, leg.DeptStn)
      .input("ArrvStn", sql.VarChar, leg.ArrvStn)
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
      .input("LayoverTime", sql.Int, leg.Layover)
      .input("DPOnDutyTime", sql.Int, leg.DPOnDutyTime)
      .input("DPDeadheadTime", sql.Int, leg.DPDeadheadTime)
      .input("DVLA2", sql.Int, leg.DVLA2)
      .input("LegNiteFly", sql.Int, leg.LegNiteFly)
      .input("Unused", sql.Int, leg.Unused)
      .input("Calendar_40Day", sql.VarChar, leg.Calendar_40Day)
      .input("Terminal", sql.VarChar, leg.Terminal)
      .input("GateNumber", sql.VarChar, leg.GateNumber)
      .input("FlightStatus", sql.VarChar, leg.FlightStatus)
      .input("BookingCode", sql.VarChar, leg.BookingCode)
      .input("SeatNumber", sql.VarChar, leg.SeatNumber)
      .input("TailNumber", sql.VarChar, leg.TailNumber)
      .input("UserSequenceId", sql.UniqueIdentifier, newUserSequenceId)
      .input("LegEndDateLocal", sql.Date, leg.LegEndDateLocal)
      .input("LegEndDateUtc", sql.Date, leg.LegEndDateUtc)
      .input("LegStartDateLocal", sql.Date, leg.LegStartDateLocal)
      .input("LegStartDateUtc", sql.Date, leg.LegStartDateUtc)
      .input("LegEndTimeLocal", sql.NVarChar, leg.LegEndTimeLocal)
      .input("LegEndTimeUtc", sql.NVarChar, leg.LegEndTimeUtc)
      .input("LegStartTimeLocal", sql.NVarChar, leg.LegStartTimeLocal)
      .input("LegStartTimeUtc", sql.NVarChar, leg.LegStartTimeUtc)
      .input("CvtArvTime", sql.VarChar, leg.CvtArvTime)
      .input("CvtDPDeadheadTime", sql.VarChar, leg.CvtDPDeadheadTime)
      .input("CvtDPOnDutyTime", sql.VarChar, leg.CvtDPOnDutyTime)
      .input("CvtDptTime", sql.VarChar, leg.CvtDptTime)
      .input("CvtLegNiteFly", sql.VarChar, leg.CvtLegNiteFly)
      .input("CvtLegPC", sql.VarChar, leg.CvtLegPC)
      .input("CvtLegTotalFlying", sql.VarChar, leg.CvtLegTotalFlying)
      .input("CvtLayover", sql.VarChar, leg.CvtLayover)
      .input("BidMonth", sql.VarChar, leg.BidMonth)
      .input("Date", sql.Date, leg.Date)
      .query(`
        INSERT INTO UserLeg (
          UserLegID, UserID, UniqueSeqNo, EffDate, ThruDate, Frequency, SeqNo, SeqLegNo, DeptStn, ArrvStn, DptTime, DptZone, ArvTime, ArvZone,
          FitNo, FitLegNo, EOD, LegTotalFlying, LegEqupType, LegDeadheadCode, LegMidnightCode, LegPC, PCCode,
          SchedOverFlow, DVSD, DVLA, LayoverTime, DPOnDutyTime, DPDeadheadTime, DVLA2, LegNiteFly, Unused,
          Calendar_40Day, Terminal, GateNumber, FlightStatus, BookingCode, SeatNumber, TailNumber, UserSequenceId,
          LegEndDateLocal, LegEndDateUtc, LegStartDateLocal, LegStartDateUtc, LegEndTimeLocal, LegEndTimeUtc,
          LegStartTimeLocal, LegStartTimeUtc, CvtArvTime, CvtDPDeadheadTime, CvtDPOnDutyTime, CvtDptTime,
          CvtLegNiteFly, CvtLegPC, CvtLegTotalFlying, CvtLayover, BidMonth, Date
        )
        VALUES (
          @UserLegID, @UserID, @UniqueSeqNo, @EffDate, @ThruDate, @Frequency, @SeqNo, @SeqLegNo, @DeptStn, @ArrvStn, @DptTime, @DptZone, @ArvTime, @ArvZone,
          @FitNo, @FitLegNo, @EOD, @LegTotalFlying, @LegEqupType, @LegDeadheadCode, @LegMidnightCode, @LegPC, @PCCode,
          @SchedOverFlow, @DVSD, @DVLA, @LayoverTime, @DPOnDutyTime, @DPDeadheadTime, @DVLA2, @LegNiteFly, @Unused,
          @Calendar_40Day, @Terminal, @GateNumber, @FlightStatus, @BookingCode, @SeatNumber, @TailNumber, @UserSequenceId,
          @LegEndDateLocal, @LegEndDateUtc, @LegStartDateLocal, @LegStartDateUtc, @LegEndTimeLocal, @LegEndTimeUtc,
          @LegStartTimeLocal, @LegStartTimeUtc, @CvtArvTime, @CvtDPDeadheadTime, @CvtDPOnDutyTime, @CvtDptTime,
          @CvtLegNiteFly, @CvtLegPC, @CvtLegTotalFlying, @CvtLayover, @BidMonth, @Date
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

// new
export const getCrewPayDetails = async (crewId: number) => {
  const pool = await getPool();

  // 1️⃣ Get current crew details
  const crewResult = await pool.request()
    .input("crewId", sql.Int, crewId)
    .query(`
      SELECT CrewId, OccDate, Base, HireDate
      FROM Roster
      WHERE CrewId = @crewId
    `);

  const crew = crewResult.recordset[0];
  if (!crew || !crew.HireDate) {
    return {
      basePay: null,
      yearsOfService: null,
      companySeniority: null,
      aaSeniority: null,
      note: "Crew not found or OccDate missing"
    };
  }

  // 2️⃣ Compute current crew's years of service
  const yearsOfService = getYearsOfService(new Date(crew.HireDate));

  // 3️⃣ Get all crews (for company seniority)
  const allCrewResult = await pool.request().query(`
    SELECT CrewId, OccDate, HireDate
    FROM Roster
    WHERE OccDate IS NOT NULL
  `);
  const allCrews = allCrewResult.recordset.map(c => ({
    crewId: c.CrewId,
    years: getYearsOfService(new Date(c.HireDate))
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
      SELECT CrewId, OccDate, HireDate
      FROM Roster
      WHERE Base = @Base AND OccDate IS NOT NULL
    `);

  const baseCrews = baseCrewResult.recordset.map(c => ({
    crewId: c.CrewId,
    years: getYearsOfService(new Date(c.HireDate))
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

export const getUserLanguages = async (userId: string) => {
  const pool = await getPool();

  const result = await pool.request()
    .input("userId", sql.UniqueIdentifier, userId)
    .query(`
      SELECT DISTINCT
        UL.LanguageID,
        L.SpokenLanguage
      FROM UserLanguage UL
      INNER JOIN Language L
        ON UL.LanguageID = L.LanguageID
      WHERE UL.UserID = @userId
      ORDER BY UL.LanguageID
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

export const deleteLanguages = async (userId: string) => {
  const pool = await getPool();
  console.log("Deleting languages for user:", userId);

  const request = pool.request();
  request.input('userId', sql.UniqueIdentifier, userId);

  const sqlQuery = `
    DELETE FROM dbo.UserLanguage 
    WHERE userId = @userId;
  `;

  try {
    const result = await request.query(sqlQuery);
    console.log(`Deleted ${result.rowsAffected[0]} record(s) for user ${userId}`);
  } catch (error) {
    console.error(`Error deleting for user '${userId}':`, error);
    throw error; // optional: rethrow if caller needs to handle
  }
};