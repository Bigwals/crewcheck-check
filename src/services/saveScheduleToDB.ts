import sql from "mssql";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../config/db";
import { resourceUsage } from "process";

const formatTime = (dateTime: string | null) => {
    if (!dateTime) return null;

    // 2026-05-10T13:33:00 -> 13:33
    return new Date(dateTime)
        .toISOString()
        .substring(11, 16);
};

const getTimeInMinutes = (dt?: string | null): number | null => {
    if (!dt) return null;

    const date = new Date(dt);

    const hours = date.getHours();
    const minutes = date.getMinutes();

    return (hours * 60) + minutes;
};

const convertMinutesToHHMM = (minutes: number = 0) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${hrs.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}`;
};

const getTimeOnly = (dt?: string | null) => {
    if (!dt) return null;
    return new Date(dt).toISOString().substring(11, 16); // HH:mm
};

const getDateOnly = (dt?: string | null) => {
    if (!dt) return null;
    return new Date(dt).toISOString().substring(0, 10); // YYYY-MM-DD
};

// old
export const saveScheduleInDB = async (
    userId: string,
    sequences: any[]
) => {

    const pool = await getPool();

    for (const sequence of sequences) {
        const seq = sequence.sequenceGeneralInformation;
        const credit = sequence.sequenceCreditInformation;

        const existingSeq = await pool.request()
            .input("UserID", sql.UniqueIdentifier, userId)
            .input("SeqNo", sql.Int, seq.sequenceNumber)
            .input("EffDate", sql.Date, seq.sequenceOriginDate)
            .query(`
            SELECT UserSequenceId
            FROM UserSequence
            WHERE UserID = @UserID
            AND SeqNo = @SeqNo
            AND EffDate = @EffDate
        `);

        let userSequenceId = existingSeq.recordset[0]?.UserSequenceId;

        if (!userSequenceId) {
            userSequenceId = uuidv4();

            // const userSequenceId = uuidv4();

            // ================================
            // USER SEQUENCE INSERT
            // ================================

            const totalLegs = sequence.dutyPeriods.reduce(
                (sum: number, dp: any) => sum + dp.numberOfLegs,
                0
            );

            const seqPC =
                (credit.creditThisMonth || 0) -
                (credit.scheduledFlightTime || 0);

            // const totalDutyCredit = sequence.dutyPeriods.reduce(
            //     (sum: number, dp: any) =>
            //         sum + (dp.payCreditActualScheduledTotal || 0),
            //     0
            // );

            const totalDPOnDutyTime = sequence.dutyPeriods.reduce(
                (sum: number, dp: any) => sum + (dp.payCreditActualScheduledTotal || 0),
                0
            );

            // const bidMonth = parseInt(
            //     seq.contractMonth?.replace(/[A-Z]/g, "") || "0"
            // );

            await pool.request()

                .input("UserSequenceId", sql.UniqueIdentifier, userSequenceId)
                .input("UserID", sql.UniqueIdentifier, userId)

                .input("CrewBase", sql.VarChar(3), seq.base)

                .input("SeqCategory", sql.VarChar(4), null)

                .input("EffDate", sql.Date, seq.sequenceOriginDate)

                .input("SeqNo", sql.Int, seq.sequenceNumber)

                .input("NBR_Legs", sql.Int, totalLegs)

                .input("NBR_Days", sql.Int, seq.durationInDays)

                .input("NBR_Duty", sql.Int, sequence.dutyPeriods.length)

                // .input("DPOnDutyTime", sql.Int, totalDutyCredit.payCreditActualScheduledTotal)

                .input(
                    "DPOnDutyTime",
                    sql.Int,
                    totalDPOnDutyTime
                )

                .input(
                    "CvtDPOnDutyTime",
                    sql.VarChar(15),
                    convertMinutesToHHMM(
                        totalDPOnDutyTime
                    )
                )

                .input(
                    "SeqFlyTime",
                    sql.Int,
                    seq.greaterTime
                )

                .input("SeqPC", sql.Int, seqPC)

                .input("TAFB", sql.Int, seq.timeAwayFromBase)

                .input("SeqPremTime", sql.Int, 0)

                .input("Language1", sql.VarChar(20), null)

                .input("Language2", sql.VarChar(20), null)

                .input("Reversed", sql.VarChar(20), null)

                .input("Redeye", sql.Bit, seq.redEye)

                .input("IPDPremium", sql.Bit, false)

                .input("PremiumTranscon", sql.Bit, false)

                .input("IPD", sql.Bit, seq.isIPD || false)

                .input("NIPD", sql.Bit, !seq.international)

                // .input(
                //     "CvtDPOnDutyTime",
                //     sql.VarChar(15),
                //     convertMinutesToHHMM(totalDutyCredit)
                // )

                .input(
                    "CvtSeqFlyTime",
                    sql.VarChar(15),
                    convertMinutesToHHMM(
                        seq.greaterTime
                    )
                )

                .input(
                    "CvtSeqPC",
                    sql.VarChar(15),
                    convertMinutesToHHMM(seqPC)
                )

                .input(
                    "CvtTAFB",
                    sql.VarChar(15),
                    convertMinutesToHHMM(
                        seq.timeAwayFromBase
                    )
                )

                .input(
                    "CvtSeqPremTime",
                    sql.VarChar(15),
                    "00:00"
                )

                .input("BidMonth", sql.VarChar(10), seq.contractMonth)

                .input("L_R_Type", sql.Bit, false)

                .input("AirlineCode", sql.VarChar(5), seq.airlineCode)
                .input("Division", sql.VarChar(5), seq.division)
                .input("EmployeeID", sql.Int, seq.employeeID)

                .input("EquipmentGroup", sql.VarChar(10), seq.equipmentGroup)

                .input("FailsContinuity", sql.Bit, seq.failsContinuity)
                .input("FirstLegDeadHeadIndicator", sql.Bit, seq.firstLegDeadHeadIndicator)
                .input("FirstLegDepartureAirport", sql.VarChar(10), seq.firstLegDepartureAirport)

                .input("PositionCode", sql.VarChar(10), seq.positionCode)

                .input("SequenceStatus", sql.VarChar(30), seq.sequenceStatus)

                .input("MultipleEquipments", sql.Bit, seq.multipleEquipments)

                .input(
                    "RonCities",
                    sql.VarChar(200),
                    Array.isArray(seq.ronCities)
                        ? seq.ronCities.join(",")
                        : null
                )

                .input("International", sql.Bit, seq.international)

                .input("TrainingSequence", sql.Bit, seq.trainingSequence)

                .input("CreditNextMonth", sql.Int, credit.creditNextMonth)

                .input("ScheduledTotalCredit", sql.Int, credit.scheduledTotalCredit)

                .input("AddCode", sql.VarChar(15), seq.addCode)

                .input("GreaterTime", sql.Int, seq.greaterTime)
                .input("CvtGreaterTime", sql.VarChar(15),
                    convertMinutesToHHMM(
                        seq.greaterTime
                    )
                )
                .input("TotalPNC", sql.Int, seq.totalPNC)
                .input("CvtTotalPNC", sql.VarChar(15),
                    convertMinutesToHHMM(
                        seq.totalPNC
                    )
                )

                .input("RedFlag", sql.Bit, seq.redFlag)
                .input("Odan", sql.Bit, seq.odan)
                .input("LayoverStations", sql.VarChar(15), seq.layoverStations)
                .input("LegPerDutyPeriods", sql.VarChar(15), seq.legsPerDutyPeriod)

                .query(`
                    INSERT INTO UserSequence (
                    UserSequenceId,
                    UserID,
                    CrewBase,
                    SeqCategory,
                    EffDate,
                    SeqNo,
                    NBR_Legs,
                    NBR_Days,
                    NBR_Duty,
                    DPOnDutyTime,
                    SeqFlyTime,
                    SeqPC,
                    TAFB,
                    SeqPremTime,
                    Language1,
                    Language2,
                    Reversed,
                    Redeye,
                    IPDPremium,
                    PremiumTranscon,
                    IPD,
                    NIPD,
                    CvtDPOnDutyTime,
                    CvtSeqFlyTime,
                    CvtSeqPC,
                    CvtTAFB,
                    CvtSeqPremTime,
                    BidMonth,
                    L_R_Type,
                    AirlineCode,
                    Division,
                    EmployeeID,
                    EquipmentGroup,
                    FailsContinuity,
                    FirstLegDeadHeadIndicator,
                    FirstLegDepartureAirport,
                    PositionCode,
                    SequenceStatus,
                    MultipleEquipments,
                    RonCities,
                    International,
                    TrainingSequence,
                    CreditNextMonth,
                    ScheduledTotalCredit,
                    AddCode,
                    GreaterTime,
                    CvtGreaterTime,
                    TotalPNC,
                    CvtTotalPNC,
                    RedFlag,
                    Odan,
                    LayoverStations,
                    LegPerDutyPeriods
                )
                    VALUES (
                    @UserSequenceId,
                    @UserID,
                    @CrewBase,
                    @SeqCategory,
                    @EffDate,
                    @SeqNo,
                    @NBR_Legs,
                    @NBR_Days,
                    @NBR_Duty,
                    @DPOnDutyTime,
                    @SeqFlyTime,
                    @SeqPC,
                    @TAFB,
                    @SeqPremTime,
                    @Language1,
                    @Language2,
                    @Reversed,
                    @Redeye,
                    @IPDPremium,
                    @PremiumTranscon,
                    @IPD,
                    @NIPD,
                    @CvtDPOnDutyTime,
                    @CvtSeqFlyTime,
                    @CvtSeqPC,
                    @CvtTAFB,
                    @CvtSeqPremTime,
                    @BidMonth,
                    @L_R_Type,
                    @AirlineCode,
                    @Division,
                    @EmployeeID,
                    @EquipmentGroup,
                    @FailsContinuity,
                    @FirstLegDeadHeadIndicator,
                    @FirstLegDepartureAirport,
                    @PositionCode,
                    @SequenceStatus,
                    @MultipleEquipments,
                    @RonCities,
                    @International,
                    @TrainingSequence,
                    @CreditNextMonth,
                    @ScheduledTotalCredit,
                    @AddCode,
                    @GreaterTime,
                    @CvtGreaterTime,
                    @TotalPNC,
                    @CvtTotalPNC,
                    @RedFlag,
                    @Odan,
                    @LayoverStations,
                    @LegPerDutyPeriods
                )
            `);
        }
        // ================================
        // USER LEG INSERT
        // ================================

        for (const dp of sequence.dutyPeriods) {

            for (const leg of dp.flightLegs) {

                const existingLeg = await pool.request()
                    .input("UserSequenceId", sql.UniqueIdentifier, userSequenceId)
                    .input("SeqLegNo", sql.Int, leg.legIndex)
                    .input("EffDate", sql.Date, leg.flightOriginationDate)
                    .query(`
                SELECT UserLegId
                FROM UserLeg
                WHERE UserSequenceId = @UserSequenceId
                AND SeqLegNo = @SeqLegNo
                AND EffDate = @EffDate
            `);

                let userLegId = existingLeg.recordset[0]?.UserLegId;

                if (!userLegId) {

                    const [deptStn, arrvStn] =
                        leg.originDestination.split(" to ");

                    const userLegId = uuidv4();

                    await pool.request()

                        .input("UserLegId", sql.UniqueIdentifier, userLegId)

                        .input(
                            "UserSequenceId",
                            sql.UniqueIdentifier,
                            userSequenceId
                        )

                        .input("UserID", sql.UniqueIdentifier, userId)

                        .input(
                            "EffDate",
                            sql.Date,
                            leg.flightOriginationDate
                        )

                        .input("SeqNo", sql.Int, seq.sequenceNumber)

                        .input("SeqLegNo", sql.Int, leg.legIndex)

                        .input("DeptStn", sql.VarChar(3), deptStn)

                        .input("ArrvStn", sql.VarChar(3), arrvStn)

                        .input(
                            "DeptTime",
                            sql.Int,
                            getTimeInMinutes(leg.departureLocal)
                        )

                        .input(
                            "ArrvTime",
                            sql.Int,
                            getTimeInMinutes(leg.arrivalLocal)
                        )

                        .input(
                            "FitNo",
                            sql.Int,
                            leg.flightNumber
                        )

                        .input(
                            "FlightLegNo",
                            sql.Int,
                            leg.legIndex
                        )

                        .input(
                            "LegTotalFlying",
                            sql.Int,
                            leg.blockTime
                        )

                        // .input(
                        //     "LegEqupType",
                        //     sql.Int,
                        //     parseInt(
                        //         leg.equipment?.equipmentNumber+0 || "0"
                        //     )
                        // )

                        .input(
                            "LegEqupType",
                            sql.Int,
                            leg.equipment?.equipmentNumber != null
                                ? Number(`${leg.equipment.equipmentNumber}0`)
                                : 0
                        )

                        .input(
                            "LegPC",
                            sql.Int,
                            leg.blockTime
                        )

                        .input(
                            "LayoverTime",
                            sql.Int,
                            dp.layoverInMinutes
                        )

                        .input(
                            "DPOnDutyTime",
                            sql.Int,
                            dp.payCreditActualScheduledTotal
                        )

                        .input(
                            "CvtDPOnDutyTime",
                            sql.VarChar(15),
                            convertMinutesToHHMM(
                                dp.payCreditActualScheduledTotal
                            )
                        )

                        .input(
                            "CvtDptTime",
                            sql.VarChar(15),
                            formatTime(leg.departureLocal)
                        )

                        .input(
                            "CvtArvTime",
                            sql.VarChar(15),
                            formatTime(leg.arrivalLocal)
                        )

                        .input(
                            "CvtLegTotalFlying",
                            sql.VarChar(15),
                            convertMinutesToHHMM(
                                leg.blockTime
                            )
                        )

                        .input(
                            "CvtLegPC",
                            sql.VarChar(15),
                            convertMinutesToHHMM(
                                leg.blockTime
                            )
                        )

                        .input(
                            "CvtLayover",
                            sql.VarChar(15),
                            convertMinutesToHHMM(
                                dp.layoverInMinutes
                            )
                        )

                        .input(
                            "CvtSeqPremTime",
                            sql.VarChar(15),
                            "00:00"
                        )

                        .input("BidMonth", sql.VarChar(15), seq.contractMonth)

                        .input(
                            "Date",
                            sql.Date,
                            leg.flightOriginationDate
                        )

                        .input("L_R_Type", sql.Bit, false)

                        .input("GroundTime", sql.Int, leg.groundTime || 0)

                        .input(
                            "LegStatuses",
                            sql.VarChar(500),
                            Array.isArray(leg.legStatuses)
                                ? leg.legStatuses.join(",")
                                : null
                        )

                        .input("EndOfDutyPeriod", sql.Bit, leg.endOfDutyPeriod)
                        .input("EndOfSequence", sql.Bit, leg.endOfSequence)
                        .input("ChangeInFlightTime", sql.Bit, leg.changeInFlightTime)

                        .input("FlightStatus", sql.VarChar(50), leg.flightStatus)

                        .input("EquipmentType", sql.VarChar(20), leg.equipment?.equipmentType)
                        .input("EquipmentGroup", sql.VarChar(20), leg.equipment?.equipmentGroup)

                        .input("TimeZoneDifference", sql.VarChar(10), leg.timeZoneDifference)
                        .input("MealCode", sql.VarChar(10), leg.mealCode)

                        .input("International", sql.Bit, leg.international)

                        .input("DutyPeriodNumber", sql.Int, dp.dutyPeriodNumber)
                        .input("DutyStartDateTimeLocal", sql.DateTime, dp.startDateTimeLocal)
                        .input("DutyEndDateTimeLocal", sql.DateTime, dp.endDateTimeLocal)
                        .input("DutyDuration", sql.Int, dp.duration)
                        .input("LayoverAirport", sql.VarChar(10), dp.layoverAirport)
                        .input("ODMinutes", sql.Int, dp.odMinutes)
                        .input("DomesticDP", sql.Bit, dp.domesticDP)

                        .query(`
                        INSERT INTO UserLeg (
                            UserLegId,
                            UserSequenceId,
                            UserID,
                            EffDate,
                            SeqNo,
                            SeqLegNo,
                            DeptStn,
                            ArrvStn,
                            DeptTime,
                            ArrvTime,
                            FitNo,
                            FlightLegNo,
                            LegTotalFlying,
                            LegEqupType,
                            LegPC,
                            LayoverTime,
                            DPOnDutyTime,
                            CvtDPOnDutyTime,
                            CvtDptTime,
                            CvtArvTime,
                            CvtLegTotalFlying,
                            CvtLegPC,
                            CvtLayover,
                            CvtSeqPremTime,
                            BidMonth,
                            Date,
                            L_R_Type,
                            GroundTime,
                            LegStatuses,
                            EndOfDutyPeriod,
                            EndOfSequence,
                            ChangeInFlightTime,
                            FlightStatus,
                            EquipmentType,
                            EquipmentGroup,
                            TimeZoneDifference,
                            MealCode,
                            International,
                            DutyPeriodNumber,
                            DutyStartDateTimeLocal,
                            DutyEndDateTimeLocal,
                            DutyDuration,
                            LayoverAirport,
                            ODMinutes,
                            DomesticDP
                        )
                        VALUES (
                            @UserLegId,
                            @UserSequenceId,
                            @UserID,
                            @EffDate,
                            @SeqNo,
                            @SeqLegNo,
                            @DeptStn,
                            @ArrvStn,
                            @DeptTime,
                            @ArrvTime,
                            @FitNo,
                            @FlightLegNo,
                            @LegTotalFlying,
                            @LegEqupType,
                            @LegPC,
                            @LayoverTime,
                            @DPOnDutyTime,
                            @CvtDPOnDutyTime,
                            @CvtDptTime,
                            @CvtArvTime,
                            @CvtLegTotalFlying,
                            @CvtLegPC,
                            @CvtLayover,
                            @CvtSeqPremTime,
                            @BidMonth,
                            @Date,
                            @L_R_Type,
                            @GroundTime,
                            @LegStatuses,
                            @EndOfDutyPeriod,
                            @EndOfSequence,
                            @ChangeInFlightTime,
                            @FlightStatus,
                            @EquipmentType,
                            @EquipmentGroup,
                            @TimeZoneDifference,
                            @MealCode,
                            @International,
                            @DutyPeriodNumber,
                            @DutyStartDateTimeLocal,
                            @DutyEndDateTimeLocal,
                            @DutyDuration,
                            @LayoverAirport,
                            @ODMinutes,
                            @DomesticDP
                        )
                    `);
                }
            }
        }
    }

    return true;
};

// new

// export const saveScheduleInDB = async (userId: string, sequences: any[]) => {
//     const pool = await getPool();
//     const transaction = new sql.Transaction(pool);

//     await transaction.begin();

//     try {
//         const request = new sql.Request(transaction);

//         // =====================================================
//         // STEP 1: LOAD EXISTING DATA (FAST, NO LOOP QUERIES)
//         // =====================================================

//         const existingSeqs = await request
//             .input("UserID", sql.UniqueIdentifier, userId)
//             .query(`
//                 SELECT UserSequenceId, SeqNo, EffDate
//                 FROM UserSequence
//                 WHERE UserID = @UserID
//             `);

//         const existingLegs = await request.query(`
//                 SELECT UserSequenceId, SeqNo, SeqLegNo, FitNo, EffDate
//                 FROM UserLeg
//             `);

//         const seqMap = new Map();
//         for (const s of existingSeqs.recordset) {
//             seqMap.set(`${s.SeqNo}_${s.EffDate}`, s.UserSequenceId);
//         }

//         const legSet = new Set(
//             existingLegs.recordset.map(
//                 (l) =>
//                     `${l.UserSequenceId}_${l.SeqNo}_${l.SeqLegNo}_${l.FitNo}_${l.EffDate}`
//             )
//         );

//         // =====================================================
//         // STEP 2: PROCESS SEQUENCES
//         // =====================================================

//         for (const sequence of sequences) {
//             const seq = sequence.sequenceGeneralInformation;
//             const credit = sequence.sequenceCreditInformation;

//             const seqKey = `${seq.sequenceNumber}_${seq.sequenceOriginDate}`;

//             let userSequenceId = seqMap.get(seqKey);

//             const totalLegs = sequence.dutyPeriods.reduce(
//                 (sum: number, dp: any) => sum + dp.numberOfLegs,
//                 0
//             );

//             const seqPC =
//                 (credit.creditThisMonth || 0) -
//                 (credit.scheduledFlightTime || 0);

//             const totalDutyCredit = sequence.dutyPeriods.reduce(
//                 (sum: number, dp: any) =>
//                     sum + (dp.payCreditActualScheduledTotal || 0),
//                 0
//             );

//             // =====================================================
//             // UPSERT USER SEQUENCE
//             // =====================================================

//             if (!userSequenceId) {
//                 userSequenceId = uuidv4();
//                 seqMap.set(seqKey, userSequenceId);

//                 const request = new sql.Request(transaction)
//                 request
//                     .input("UserSequenceId", sql.UniqueIdentifier, userSequenceId)
//                     .input("UserID", sql.UniqueIdentifier, userId)
//                     .input("CrewBase", sql.VarChar(3), seq.base)
//                     .input("SeqCategory", sql.VarChar(4), null)
//                     .input("EffDate", sql.Date, seq.sequenceOriginDate)
//                     .input("SeqNo", sql.Int, seq.sequenceNumber)
//                     .input("NBR_Legs", sql.Int, totalLegs)
//                     .input("NBR_Days", sql.Int, seq.durationInDays)
//                     .input("NBR_Duty", sql.Int, sequence.dutyPeriods.length)
//                     .input("DPOnDutyTime", sql.Int, totalDutyCredit)
//                     .input("SeqFlyTime", sql.Int, credit.scheduledFlightTime)
//                     .input("SeqPC", sql.Int, seqPC)
//                     .input("TAFB", sql.Int, seq.timeAwayFromBase)
//                     .input("SeqPremTime", sql.Int, 0)
//                     .input("Language1", sql.VarChar(20), null)
//                     .input("Language2", sql.VarChar(20), null)
//                     .input("Reversed", sql.VarChar(20), null)
//                     .input("Redeye", sql.Bit, seq.redEye)
//                     .input("IPDPremium", sql.Bit, false)
//                     .input("PremiumTranscon", sql.Bit, false)
//                     .input("IPD", sql.Bit, seq.international)
//                     .input("NIPD", sql.Bit, !seq.international)
//                     .input("CvtDPOnDutyTime", sql.VarChar(15), String(totalDutyCredit))
//                     .input("CvtSeqFlyTime", sql.VarChar(15), String(credit.scheduledFlightTime))
//                     .input("CvtSeqPC", sql.VarChar(15), String(seqPC))
//                     .input("CvtTAFB", sql.VarChar(15), String(seq.timeAwayFromBase))
//                     .input("CvtSeqPremTime", sql.VarChar(15), "00:00")
//                     .input("BidMonth", sql.VarChar(10), seq.contractMonth)
//                     .input("L_R_Type", sql.Bit, false)
//                     .input("AirlineCode", sql.VarChar(5), seq.airlineCode)
//                     .input("Division", sql.VarChar(5), seq.division)
//                     .input("EmployeeID", sql.Int, seq.employeeID)
//                     .input("EquipmentGroup", sql.VarChar(10), seq.equipmentGroup)
//                     .input("FailsContinuity", sql.Bit, seq.failsContinuity)
//                     .input("FirstLegDeadHeadIndicator", sql.Bit, seq.firstLegDeadHeadIndicator)
//                     .input("FirstLegDepartureAirport", sql.VarChar(10), seq.firstLegDepartureAirport)
//                     .input("PositionCode", sql.VarChar(10), seq.positionCode)
//                     .input("SequenceStatus", sql.VarChar(30), seq.sequenceStatus)
//                     .input("MultipleEquipments", sql.Bit, seq.multipleEquipments)
//                     .input("RonCities", sql.VarChar(200), (seq.ronCities || []).join(","))
//                     .input("International", sql.Bit, seq.international)
//                     .input("TrainingSequence", sql.Bit, seq.trainingSequence)
//                     .input("CreditNextMonth", sql.Int, credit.creditNextMonth)
//                     .input("ScheduledTotalCredit", sql.Int, credit.scheduledTotalCredit)
//                     .input("AddCode", sql.VarChar(15), seq.addCode)
//                     .query(`
//                     INSERT INTO UserSequence (
//                         UserSequenceId,
//                         UserID,
//                         CrewBase,
//                         SeqCategory,
//                         EffDate,
//                         SeqNo,
//                         NBR_Legs,
//                         NBR_Days,
//                         NBR_Duty,
//                         DPOnDutyTime,
//                         SeqFlyTime,
//                         SeqPC,
//                         TAFB,
//                         SeqPremTime,
//                         Language1,
//                         Language2,
//                         Reversed,
//                         Redeye,
//                         IPDPremium,
//                         PremiumTranscon,
//                         IPD,
//                         NIPD,
//                         CvtDPOnDutyTime,
//                         CvtSeqFlyTime,
//                         CvtSeqPC,
//                         CvtTAFB,
//                         CvtSeqPremTime,
//                         BidMonth,
//                         L_R_Type,
//                         AirlineCode,
//                         Division,
//                         EmployeeID,
//                         EquipmentGroup,
//                         FailsContinuity,
//                         FirstLegDeadHeadIndicator,
//                         FirstLegDepartureAirport,
//                         PositionCode,
//                         SequenceStatus,
//                         MultipleEquipments,
//                         RonCities,
//                         International,
//                         TrainingSequence,
//                         CreditNextMonth,
//                         ScheduledTotalCredit,
//                         AddCode
//                     )
//                     VALUES (
//                         @UserSequenceId,
//                         @UserID,
//                         @CrewBase,
//                         @SeqCategory,
//                         @EffDate,
//                         @SeqNo,
//                         @NBR_Legs,
//                         @NBR_Days,
//                         @NBR_Duty,
//                         @DPOnDutyTime,
//                         @SeqFlyTime,
//                         @SeqPC,
//                         @TAFB,
//                         @SeqPremTime,
//                         @Language1,
//                         @Language2,
//                         @Reversed,
//                         @Redeye,
//                         @IPDPremium,
//                         @PremiumTranscon,
//                         @IPD,
//                         @NIPD,
//                         @CvtDPOnDutyTime,
//                         @CvtSeqFlyTime,
//                         @CvtSeqPC,
//                         @CvtTAFB,
//                         @CvtSeqPremTime,
//                         @BidMonth,
//                         @L_R_Type,
//                         @AirlineCode,
//                         @Division,
//                         @EmployeeID,
//                         @EquipmentGroup,
//                         @FailsContinuity,
//                         @FirstLegDeadHeadIndicator,
//                         @FirstLegDepartureAirport,
//                         @PositionCode,
//                         @SequenceStatus,
//                         @MultipleEquipments,
//                         @RonCities,
//                         @International,
//                         @TrainingSequence,
//                         @CreditNextMonth,
//                         @ScheduledTotalCredit,
//                         @AddCode
//                     )
//              `);
//             }

//             // =====================================================
//             // STEP 3: LEG INSERT (DEDUP + UPSERT SAFE)
//             // =====================================================

//             for (const dp of sequence.dutyPeriods) {
//                 for (const leg of dp.flightLegs) {

//                     const [deptStn, arrvStn] =
//                         leg.originDestination.split(" to ");

//                     const legKey =
//                         `${userSequenceId}_${seq.sequenceNumber}_${leg.legIndex}_${leg.flightNumber}_${leg.flightOriginationDate}`;

//                     if (legSet.has(legKey)) continue;

//                     legSet.add(legKey);

//                     const userLegId = uuidv4();

//                     const request = new sql.Request(transaction)
//                         request
//                         .input("UserLegId", sql.UniqueIdentifier, userLegId)
//                         .input("UserSequenceId", sql.UniqueIdentifier, userSequenceId)
//                         .input("UserID", sql.UniqueIdentifier, userId)
//                         .input("EffDate", sql.Date, leg.flightOriginationDate)
//                         .input("SeqNo", sql.Int, seq.sequenceNumber)
//                         .input("SeqLegNo", sql.Int, leg.legIndex)
//                         .input("DeptStn", sql.VarChar(3), deptStn)
//                         .input("ArrvStn", sql.VarChar(3), arrvStn)
//                         .input("DeptTime", sql.VarChar(5), leg.departureLocal?.substring(11, 16))
//                         .input("ArrvTime", sql.VarChar(5), leg.arrivalLocal?.substring(11, 16))
//                         .input("FitNo", sql.Int, leg.flightNumber)
//                         .input("FlightLegNo", sql.Int, leg.legIndex)
//                         .input("LegTotalFlying", sql.Int, leg.blockTime)
//                         .input("LegEqupType", sql.Int, parseInt(leg.equipment?.equipmentNumber || "0"))
//                         .input("LegPC", sql.Int, leg.blockTime)
//                         .input("LayoverTime", sql.Int, dp.layoverInMinutes)
//                         .input("DPOnDutyTime", sql.Int, dp.payCreditActualScheduledTotal)
//                         .input("GroundTime", sql.Int, leg.groundTime || 0)
//                         .input("LegStatuses", sql.VarChar(500), (leg.legStatuses || []).join(","))
//                         .input("EndOfDutyPeriod", sql.Bit, leg.endOfDutyPeriod)
//                         .input("EndOfSequence", sql.Bit, leg.endOfSequence)
//                         .input("ChangeInFlightTime", sql.Bit, leg.changeInFlightTime)
//                         .input("FlightStatus", sql.VarChar(50), leg.flightStatus)
//                         .input("EquipmentType", sql.VarChar(20), leg.equipment?.equipmentType)
//                         .input("EquipmentGroup", sql.VarChar(20), leg.equipment?.equipmentGroup)
//                         .input("TimeZoneDifference", sql.VarChar(10), leg.timeZoneDifference)
//                         .input("MealCode", sql.VarChar(10), leg.mealCode)
//                         .input("International", sql.Bit, leg.international)
// .input("DutyPeriodNumber", sql.Int, dp.dutyPeriodNumber)
// .input("DutyStartDateTimeLocal", sql.DateTime, dp.startDateTimeLocal)
// .input("DutyEndDateTimeLocal", sql.DateTime, dp.endDateTimeLocal)
// .input("DutyDuration", sql.Int, dp.duration)
// .input("LayoverAirport", sql.VarChar(10), dp.layoverAirport)
// .input("ODMinutes", sql.Int, dp.odMinutes)
// .input("DomesticDP", sql.Bit, dp.domesticDP)
//                         .query(`
//                         INSERT INTO UserLeg (
//                             UserLegId,
//                             UserSequenceId,
//                             UserID,
//                             EffDate,
//                             SeqNo,
//                             SeqLegNo,
//                             DeptStn,
//                             ArrvStn,
//                             DeptTime,
//                             ArrvTime,
//                             FitNo,
//                             FlightLegNo,
//                             LegTotalFlying,
//                             LegEqupType,
//                             LegPC,
//                             LayoverTime,
//                             DPOnDutyTime,
//                             CvtDPOnDutyTime,
//                             CvtDptTime,
//                             CvtArvTime,
//                             CvtLegTotalFlying,
//                             CvtLegPC,
//                             CvtLayover,
//                             CvtSeqPremTime,
//                             BidMonth,
//                             Date,
//                             L_R_Type,
//                             GroundTime,
//                             LegStatuses,
//                             EndOfDutyPeriod,
//                             EndOfSequence,
//                             ChangeInFlightTime,
//                             FlightStatus,
//                             EquipmentType,
//                             EquipmentGroup,
//                             TimeZoneDifference,
//                             MealCode,
//                             International,
//                             DutyPeriodNumber,
//                             DutyStartDateTimeLocal,
//                             DutyEndDateTimeLocal,
//                             DutyDuration,
//                             LayoverAirport,
//                             ODMinutes,
//                             DomesticDP
//                         )
//                         VALUES (
//                             @UserLegId,
//                             @UserSequenceId,
//                             @UserID,
//                             @EffDate,
//                             @SeqNo,
//                             @SeqLegNo,
//                             @DeptStn,
//                             @ArrvStn,
//                             @DeptTime,
//                             @ArrvTime,
//                             @FitNo,
//                             @FlightLegNo,
//                             @LegTotalFlying,
//                             @LegEqupType,
//                             @LegPC,
//                             @LayoverTime,
//                             @DPOnDutyTime,
//                             @CvtDPOnDutyTime,
//                             @CvtDptTime,
//                             @CvtArvTime,
//                             @CvtLegTotalFlying,
//                             @CvtLegPC,
//                             @CvtLayover,
//                             @CvtSeqPremTime,
//                             @BidMonth,
//                             @Date,
//                             @L_R_Type,
//                             @GroundTime,
//                             @LegStatuses,
//                             @EndOfDutyPeriod,
//                             @EndOfSequence,
//                             @ChangeInFlightTime,
//                             @FlightStatus,
//                             @EquipmentType,
//                             @EquipmentGroup,
//                             @TimeZoneDifference,
//                             @MealCode,
//                             @International,
//                             @DutyPeriodNumber,
//                             @DutyStartDateTimeLocal,
//                             @DutyEndDateTimeLocal,
//                             @DutyDuration,
//                             @LayoverAirport,
//                             @ODMinutes,
//                             @DomesticDP
//                         )
//                     `);
//                 }
//             }
//         }

//         await transaction.commit();
//         return true;

//     } catch (err) {
//         await transaction.rollback();
//         throw err;
//     }
// };