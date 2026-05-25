// old with duplicate response in terms of date
// export const transformScheduleData = (
//     raw: any,
//     calendarMonth?: string // Example: "MAR2026", "APR2026"
// ) => {

//     // Get calendarResponse safely
//     const calendarResponses = raw?.calendarResponse || [];

//     // Flatten all days from all calendarResponse items
//     const allDays = calendarResponses.flatMap(
//         (calendar: any) => calendar?.days || []
//     );

//     // Flatten all day events
//     const allEvents = allDays.flatMap(
//         (day: any) => day?.daysEvents || []
//     );

//     // Filter only valid sequence events
//     const filteredEvents = allEvents.filter((event: any) => {
//         const seq = event?.sequenceActivity;

//         if (!seq) return false;

//         // If month parameter provided, filter by contractMonth
//         if (calendarMonth) {
//             return (
//                 seq.contractMonth?.toUpperCase() ===
//                 calendarMonth.toUpperCase()
//             );
//         }

//         return true;
//     });

//     return filteredEvents.map((event: any) => {

//         const seq = event?.sequenceActivity || {};

//         return {

//             sequenceGeneralInformation: {
//                 addCode: seq?.addCode || null,
//                 airlineCode: seq?.airlineCode || null,
//                 base: seq?.base || null,
//                 contractMonth: seq?.contractMonth || null,
//                 division: seq?.division || null,
//                 durationInDays: seq?.durationInDays || null,
//                 employeeID: seq?.employeeID || null,
//                 equipmentGroup: seq?.equipmentGroup || null,
//                 failsContinuity: seq?.failsContinuity || false,
//                 firstLegDeadHeadIndicator:
//                     seq?.firstLegDeadHeadIndicator || false,
//                 firstLegDepartureAirport:
//                     seq?.firstLegDepartureAirport || null,
//                 positionCode: seq?.positionCode || null,
//                 sequenceNumber: seq?.sequenceNumber || null,
//                 sequenceOriginDate:
//                     seq?.sequenceOriginDate || null,
//                 sequenceStatus: seq?.sequenceStatus || null,
//                 timeAwayFromBase:
//                     seq?.timeAwayFromBase || null,
//                 multipleEquipments:
//                     seq?.multipleEquipments || false,
//                 ronCities: seq?.ronCities || [],
//                 international: seq?.international || false,
//                 redEye: seq?.isRedEye || false,
//                 trainingSequence:
//                     seq?.isTrainingSequence || false
//             },

//             sequenceCreditInformation: {
//                 creditThisMonth:
//                     seq?.creditThisMonth || 0,

//                 creditNextMonth:
//                     seq?.creditNextMonth || 0,

//                 scheduledFlightTime:
//                     seq?.scheduledFlight || 0,

//                 scheduledTotalCredit:
//                     seq?.sequencePayCredit
//                         ?.scheduledTotalCredit || 0
//             },

//             dutyPeriods: (seq?.flightDutyPeriods || []).map((dp: any) => ({

//                 dutyPeriodNumber:
//                     dp?.dutyPeriodNumber || null,

//                 startDateTimeLocal:
//                     dp?.startDateTime?.localTime || null,

//                 endDateTimeLocal:
//                     dp?.endDateTime?.localTime || null,

//                 duration:
//                     dp?.duration || 0,

//                 layoverAirport:
//                     dp?.layOverAirport || null,

//                 layoverInMinutes:
//                     dp?.layoverInMinutes || 0,

//                 numberOfLegs:
//                     dp?.numberOfLegs || 0,

//                 odMinutes:
//                     dp?.odMinutes || 0,

//                 payCreditActualScheduledTotal:
//                     dp?.payCredit
//                         ?.scheduledTotalCredit || 0,

//                 international:
//                     dp?.international || false,

//                 domesticDP:
//                     dp?.domesticDP || false,

//                 flightLegs: (dp?.flightLegs || []).map((leg: any) => ({

//                     flightNumber:
//                         leg?.flightNumber || null,

//                     originDestination:
//                         `${leg?.departureStation || ''} to ${leg?.arrivalStation || ''}`,

//                     flightOriginationDate:
//                         leg?.flightOriginationDate || null,

//                     departureLocal:
//                         leg?.scheduled
//                             ?.departureDateTime
//                             ?.localTime || null,

//                     arrivalLocal:
//                         leg?.scheduled
//                             ?.arrivalDateTime
//                             ?.localTime || null,

//                     blockTime:
//                         leg?.blockTime || 0,

//                     groundTime:
//                         leg?.groundTime || 0,

//                     legIndex:
//                         leg?.legIndex || null,

//                     legStatuses:
//                         leg?.legStatuses || [],

//                     endOfDutyPeriod:
//                         leg?.endOfDutyPeriod || false,

//                     endOfSequence:
//                         leg?.endOfSequence || false,

//                     changeInFlightTime:
//                         leg?.changeInFlightTime || false,

//                     departureGate:
//                         leg?.departureGate || null,

//                     departureTerminal:
//                         leg?.departureTerminal || null,

//                     arrivalGate:
//                         leg?.arrivalGate || null,

//                     arrivalTerminal:
//                         leg?.arrivalTerminal || null,

//                     flightStatus:
//                         leg?.flightStatusDisplayText ||
//                         leg?.flightStatus ||
//                         'UNKNOWN',

//                     equipment: {
//                         assignedTail:
//                             leg?.assignedTail || null,

//                         equipmentType:
//                             leg?.equipmentQuals
//                                 ?.equipmentType || null,

//                         equipmentGroup:
//                             leg?.equipmentQuals
//                                 ?.equipmentGroup || null,

//                         equipmentNumber:
//                             leg?.equipmentQuals
//                                 ?.equipmentNumber || null
//                     },

//                     aircraftRegistrationNbr:
//                         leg?.equipment
//                             ?.aircraftRegistrationNbr || null,

//                     totalShipTime:
//                         leg?.equipment
//                             ?.totalShipTime || null,

//                     totalShipCycles:
//                         leg?.equipment
//                             ?.totalShipCycles || null,

//                     wifiCapability:
//                         leg?.equipment
//                             ?.wifiCapability || null,

//                     fastWifi:
//                         leg?.equipment
//                             ?.fastWifi || null,

//                     powerPorts:
//                         leg?.equipment
//                             ?.powerPorts || null,

//                     crewData:
//                         leg?.crewData || null,

//                     international:
//                         leg?.international || false
//                 }))
//             }))
//         };
//     });
// };

// new without duplicate response in terms of date.

export const transformScheduleData = (
    raw: any,
    calendarMonth?: string
) => {

    const bidStatuses = raw?.bidStatuses || [];

    const calendarResponses = raw?.calendarResponse || [];

    const allDays = calendarResponses.flatMap(
        (calendar: any) => calendar?.days || []
    );

    const allEvents = allDays.flatMap(
        (day: any) => day?.daysEvents || []
    );

    // Step 1: filter valid events
    const filteredEvents = allEvents.filter((event: any) => {
        const seq = event?.sequenceActivity;
        if (!seq) return false;

        if (calendarMonth) {
            return seq.contractMonth?.toUpperCase() === calendarMonth.toUpperCase();
        }

        return true;
    });

    // ✅ STEP 2: REMOVE DUPLICATE SEQUENCES
    // key = sequenceNumber + originDate (you can adjust if needed)
    const uniqueSequenceMap = new Map<string, any>();

    filteredEvents.forEach((event: any) => {
        const seq = event?.sequenceActivity;
        if (!seq?.sequenceNumber) return;

        const key = `${seq.sequenceNumber}_${seq.sequenceOriginDate}`;

        // keep first occurrence only
        if (!uniqueSequenceMap.has(key)) {
            uniqueSequenceMap.set(key, event);
        }
    });

    const uniqueEvents = Array.from(uniqueSequenceMap.values());

    // Step 3: transform
    return uniqueEvents.map((event: any) => {

        const seq = event?.sequenceActivity || {};

        const matchedBidStatus = bidStatuses.find(
            (b: any) =>
                b?.contractMonth?.toUpperCase() ===
                seq?.contractMonth?.toUpperCase()
        );

        return {
            sequenceGeneralInformation: {
                addCode: seq?.addCode || null,
                airlineCode: seq?.airlineCode || null,
                base: seq?.base || null,
                contractMonth: seq?.contractMonth || null,
                division: seq?.division || null,
                durationInDays: seq?.durationInDays || null,
                employeeID: seq?.employeeID || null,
                equipmentGroup: seq?.equipmentGroup || null,
                failsContinuity: seq?.failsContinuity || false,
                firstLegDeadHeadIndicator: seq?.firstLegDeadHeadIndicator || false,
                firstLegDepartureAirport: seq?.firstLegDepartureAirport || null,
                positionCode: seq?.positionCode || null,
                sequenceNumber: seq?.sequenceNumber || null,
                sequenceOriginDate: seq?.sequenceOriginDate || null,
                sequenceStatus: seq?.sequenceStatus || null,
                timeAwayFromBase: seq?.timeAwayFromBase || null,
                multipleEquipments: seq?.multipleEquipments || false,
                ronCities: seq?.ronCities || [],
                international: seq?.international || false,
                redEye: seq?.isRedEye || false,
                trainingSequence: seq?.isTrainingSequence || false,
                
                // ✅ ADD THIS
                totalPNC: matchedBidStatus?.totalPNC || 0,
                redFlag: seq?.isRedFlag || false,
                ipd: seq?.isIPD || false,
                odan: seq?.isODAN || false,
                layoverStations: seq?.layoverStations || false,
                legsPerDutyPeriods: seq?.legsPerDutyPeriod || false
            },

            sequenceCreditInformation: {
                creditThisMonth: seq?.creditThisMonth || 0,
                creditNextMonth: seq?.creditNextMonth || 0,
                scheduledFlightTime: seq?.scheduledFlight || 0,
                scheduledTotalCredit:
                    seq?.sequencePayCredit?.scheduledTotalCredit || 0,
                greaterTime:
                    seq?.sequencePayCredit?.greaterTime || 0
            },

            dutyPeriods: (seq?.flightDutyPeriods || []).map((dp: any) => ({

                dutyPeriodNumber: dp?.dutyPeriodNumber || null,
                startDateTimeLocal: dp?.startDateTime?.localTime || null,
                endDateTimeLocal: dp?.endDateTime?.localTime || null,
                duration: dp?.duration || 0,
                layoverAirport: dp?.layOverAirport || null,
                layoverInMinutes: dp?.layoverInMinutes || 0,
                numberOfLegs: dp?.numberOfLegs || 0,
                odMinutes: dp?.odMinutes || 0,
                payCreditActualScheduledTotal:
                    dp?.payCredit?.scheduledTotalCredit || 0,
                international: dp?.international || false,
                domesticDP: dp?.domesticDP || false,

                // ✅ REMOVE DUPLICATE LEGS INSIDE EACH DUTY PERIOD
                flightLegs: Array.from(
                    new Map(
                        (dp?.flightLegs || []).map((leg: any) => [
                            `${leg?.flightNumber}_${leg?.departureStation}_${leg?.flightOriginationDate}`,
                            leg
                        ])
                    ).values()
                ).map((leg: any) => ({

                    flightNumber: leg?.flightNumber || null,
                    originDestination: `${leg?.departureStation || ''} to ${leg?.arrivalStation || ''}`,
                    flightOriginationDate: leg?.flightOriginationDate || null,

                    departureLocal: leg?.scheduled?.departureDateTime?.localTime || null,
                    arrivalLocal: leg?.scheduled?.arrivalDateTime?.localTime || null,

                    blockTime: leg?.blockTime || 0,
                    groundTime: leg?.groundTime || 0,
                    legIndex: leg?.legIndex || null,
                    legStatuses: leg?.legStatuses || [],

                    endOfDutyPeriod: leg?.endOfDutyPeriod || false,
                    endOfSequence: leg?.endOfSequence || false,
                    changeInFlightTime: leg?.changeInFlightTime || false,

                    departureGate: leg?.departureGate || null,
                    departureTerminal: leg?.departureTerminal || null,
                    arrivalGate: leg?.arrivalGate || null,
                    arrivalTerminal: leg?.arrivalTerminal || null,

                    flightStatus:
                        leg?.flightStatusDisplayText ||
                        leg?.flightStatus ||
                        'UNKNOWN',

                    timeZoneDifference: leg?.timeZoneDifference || null,
                    mealCode: leg?.mealCode || null,

                    equipment: {
                        assignedTail: leg?.assignedTail || null,
                        equipmentType: leg?.equipmentQuals?.equipmentType || null,
                        equipmentGroup: leg?.equipmentQuals?.equipmentGroup || null,
                        equipmentNumber: leg?.equipmentQuals?.equipmentNumber || null
                    },

                    aircraftRegistrationNbr:
                        leg?.equipment?.aircraftRegistrationNbr || null,

                    totalShipTime: leg?.equipment?.totalShipTime || null,
                    totalShipCycles: leg?.equipment?.totalShipCycles || null,
                    wifiCapability: leg?.equipment?.wifiCapability || null,
                    fastWifi: leg?.equipment?.fastWifi || null,
                    powerPorts: leg?.equipment?.powerPorts || null,
                    crewData: leg?.crewData || null,
                    international: leg?.international || false
                }))
            }))
        };
    });
};

type ApiResponse = {
    data: any[];
};

// export const transformScheduleData = (
//     raw: any,
//     contractMonth: string
// ) => {
//     const normalize = (v: any) =>
//         (v ?? "").toString().trim().toUpperCase();

//     const month = normalize(contractMonth);

//     const calendarResponses = raw?.calendarResponse || [];

//     const allDays = calendarResponses.flatMap(
//         (c: any) => c?.days || []
//     );

//     const allEvents = allDays.flatMap(
//         (d: any) => d?.daysEvents || []
//     );

//     // =========================
//     // FILTER VALID SEQUENCES
//     // =========================
//     const filtered = allEvents
//         .map((event: any) => event?.sequenceActivity)
//         .filter((seq: any) => {
//             if (!seq?.sequenceNumber) return false;
//             if (!seq?.contractMonth) return false;

//             return normalize(seq.contractMonth) === month;
//         });

//     const userSequences: any[] = [];
//     const userLegs: any[] = [];

//     for (const seq of filtered) {
//         // =========================
//         // SEQUENCE TABLE
//         // =========================
//         userSequences.push({
//             addCode: seq?.addCode,
//             airlineCode: seq?.airlineCode,
//             base: seq?.base,
//             contractMonth: seq?.contractMonth,
//             division: seq?.division,
//             durationInDays: seq?.durationInDays,
//             employeeID: seq?.employeeID,
//             equipmentGroup: seq?.equipmentGroup,
//             failsContinuity: seq?.failsContinuity,
//             firstLegDeadHeadIndicator: seq?.firstLegDeadHeadIndicator,
//             firstLegDepartureAirport: seq?.firstLegDepartureAirport,
//             positionCode: seq?.positionCode,
//             sequenceNumber: seq?.sequenceNumber,
//             sequenceOriginDate: seq?.sequenceOriginDate,
//             sequenceStatus: seq?.sequenceStatus,
//             timeAwayFromBase: seq?.timeAwayFromBase,
//             multipleEquipments: seq?.multipleEquipments,
//             ronCities: seq?.ronCities,
//             international: seq?.international,
//             redEye: seq?.redEye,
//             trainingSequence: seq?.trainingSequence,

//             creditThisMonth: seq?.creditThisMonth,
//             creditNextMonth: seq?.creditNextMonth,
//             scheduledFlightTime: seq?.scheduledFlightTime,
//             scheduledTotalCredit:
//                 seq?.sequencePayCredit?.scheduledTotalCredit
//         });

//         // =========================
//         // DUTY PERIODS → LEGS
//         // =========================
//         for (const dp of seq?.flightDutyPeriods || []) {
//             for (const leg of dp?.flightLegs || []) {
//                 userLegs.push({
//                     sequenceNumber: seq?.sequenceNumber,
//                     contractMonth: seq?.contractMonth,

//                     dutyPeriodNumber: dp?.dutyPeriodNumber,
//                     startDateTimeLocal:
//                         dp?.startDateTime?.localTime,
//                     endDateTimeLocal:
//                         dp?.endDateTime?.localTime,

//                     duration: dp?.duration,
//                     layoverAirport: dp?.layOverAirport,
//                     layoverInMinutes: dp?.layoverInMinutes,
//                     numberOfLegs: dp?.numberOfLegs,
//                     odMinutes: dp?.odMinutes,

//                     payCreditActualScheduledTotal:
//                         dp?.payCredit?.scheduledTotalCredit,

//                     flightNumber: leg?.flightNumber,
//                     originDestination: `${leg?.departureStation} to ${leg?.arrivalStation}`,
//                     flightOriginationDate: leg?.flightOriginationDate,
//                     departureLocal:
//                         leg?.scheduled?.departureDateTime?.localTime,
//                     arrivalLocal:
//                         leg?.scheduled?.arrivalDateTime?.localTime,

//                     blockTime: leg?.blockTime,
//                     groundTime: leg?.groundTime,
//                     legIndex: leg?.legIndex,
//                     legStatuses: leg?.legStatuses,

//                     endOfDutyPeriod: leg?.endOfDutyPeriod,
//                     endOfSequence: leg?.endOfSequence,
//                     changeInFlightTime: leg?.changeInFlightTime,

//                     departureGate: leg?.departureGate,
//                     departureTerminal: leg?.departureTerminal,
//                     arrivalGate: leg?.arrivalGate,
//                     arrivalTerminal: leg?.arrivalTerminal,

//                     flightStatus:
//                         leg?.flightStatusDisplayText ||
//                         leg?.flightStatus ||
//                         "UNKNOWN",

//                     equipmentType: leg?.equipmentQuals?.equipmentType,
//                     equipmentGroup: leg?.equipmentQuals?.equipmentGroup,
//                     equipmentNumber: leg?.equipmentQuals?.equipmentNumber,
//                     assignedTail: leg?.assignedTail
//                 });
//             }
//         }
//     }

//     return {
//         userSequences,
//         userLegs
//     };
// };

// new working
// export const transformScheduleData = (
//   raw: any,
//   contractMonth: string
// ) => {
//   const normalize = (v: any) =>
//     (v ?? "").toString().trim().toUpperCase();

//   const month = normalize(contractMonth);

//   const calendarResponses = raw?.calendarResponse || [];

//   const allDays = calendarResponses.flatMap((c: any) => c?.days || []);
//   const allEvents = allDays.flatMap((d: any) => d?.daysEvents || []);

//   const sequenceMap = new Map<string, any>();
//   const legMap = new Map<string, any>();

//   for (const event of allEvents) {
//     const seq = event?.sequenceActivity;
//     if (!seq) continue;

//     if (normalize(seq.contractMonth) !== month) continue;
//     if (!seq.sequenceNumber) continue;

//     // =========================
//     // SEQUENCE DEDUPE KEY
//     // =========================
//     const seqKey = `${seq.sequenceNumber}-${seq.contractMonth}`;

//     if (!sequenceMap.has(seqKey)) {
//       sequenceMap.set(seqKey, {
//         addCode: seq?.addCode,
//         airlineCode: seq?.airlineCode,
//         base: seq?.base,
//         contractMonth: seq?.contractMonth,
//         division: seq?.division,
//         durationInDays: seq?.durationInDays,
//         employeeID: seq?.employeeID,
//         equipmentGroup: seq?.equipmentGroup,
//         failsContinuity: seq?.failsContinuity,
//         firstLegDeadHeadIndicator: seq?.firstLegDeadHeadIndicator,
//         firstLegDepartureAirport: seq?.firstLegDepartureAirport,
//         positionCode: seq?.positionCode,
//         sequenceNumber: seq?.sequenceNumber,
//         sequenceOriginDate: seq?.sequenceOriginDate,
//         sequenceStatus: seq?.sequenceStatus,
//         timeAwayFromBase: seq?.timeAwayFromBase,
//         multipleEquipments: seq?.multipleEquipments,
//         ronCities: seq?.ronCities,
//         international: seq?.international,
//         redEye: seq?.redEye,
//         trainingSequence: seq?.trainingSequence,

//         creditThisMonth: seq?.creditThisMonth,
//         creditNextMonth: seq?.creditNextMonth,
//         scheduledFlightTime: seq?.scheduledFlightTime,
//         scheduledTotalCredit:
//           seq?.sequencePayCredit?.scheduledTotalCredit
//       });
//     }

//     // =========================
//     // LEG EXTRACTION (DEDUPED)
//     // =========================
//     for (const dp of seq?.flightDutyPeriods || []) {
//       for (const leg of dp?.flightLegs || []) {
//         const legKey = `${seq.sequenceNumber}-${dp.dutyPeriodNumber}-${leg.flightNumber}-${leg.departureStation}-${leg.arrivalStation}`;

//         if (legMap.has(legKey)) continue;

//         legMap.set(legKey, {
//           sequenceNumber: seq.sequenceNumber,
//           contractMonth: seq.contractMonth,

//           dutyPeriodNumber: dp?.dutyPeriodNumber,
//           startDateTimeLocal: dp?.startDateTime?.localTime,
//           endDateTimeLocal: dp?.endDateTime?.localTime,
//           duration: dp?.duration,
//           layoverAirport: dp?.layOverAirport,
//           layoverInMinutes: dp?.layoverInMinutes,
//           numberOfLegs: dp?.numberOfLegs,
//           odMinutes: dp?.odMinutes,
//           payCreditActualScheduledTotal:
//             dp?.payCredit?.scheduledTotalCredit,

//           flightNumber: leg?.flightNumber,
//           originDestination: `${leg?.departureStation} to ${leg?.arrivalStation}`,
//           flightOriginationDate: leg?.flightOriginationDate,
//           departureLocal:
//             leg?.scheduled?.departureDateTime?.localTime,
//           arrivalLocal:
//             leg?.scheduled?.arrivalDateTime?.localTime,

//           blockTime: leg?.blockTime,
//           groundTime: leg?.groundTime,
//           legIndex: leg?.legIndex,
//           legStatuses: leg?.legStatuses,

//           endOfDutyPeriod: leg?.endOfDutyPeriod,
//           endOfSequence: leg?.endOfSequence,
//           changeInFlightTime: leg?.changeInFlightTime,

//           departureGate: leg?.departureGate,
//           departureTerminal: leg?.departureTerminal,
//           arrivalGate: leg?.arrivalGate,
//           arrivalTerminal: leg?.arrivalTerminal,

//           flightStatus:
//             leg?.flightStatusDisplayText ||
//             leg?.flightStatus ||
//             "UNKNOWN",

//           equipmentType: leg?.equipmentQuals?.equipmentType,
//           equipmentGroup: leg?.equipmentQuals?.equipmentGroup,
//           equipmentNumber: leg?.equipmentQuals?.equipmentNumber,
//           assignedTail: leg?.assignedTail
//         });
//       }
//     }
//   }

//   return {
//     userSequences: Array.from(sequenceMap.values()),
//     userLegs: Array.from(legMap.values())
//   };
// };