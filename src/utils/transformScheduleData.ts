export const transformScheduleData = (raw: any) => {

    return raw.daysEvents.map((event: any) => {

        const seq = event.sequenceActivity;

        return {

            sequenceGeneralInformation: {
                addCode: seq.addCode,
                airlineCode: seq.airlineCode,
                base: seq.base,
                contractMonth: seq.contractMonth,
                division: seq.division,
                durationInDays: seq.durationInDays,
                employeeID: seq.employeeID,
                equipmentGroup: seq.equipmentGroup,
                failsContinuity: seq.failsContinuity,
                firstLegDeadHeadIndicator: seq.firstLegDeadHeadIndicator,
                firstLegDepartureAirport: seq.firstLegDepartureAirport,
                positionCode: seq.positionCode,
                sequenceNumber: seq.sequenceNumber,
                sequenceOriginDate: seq.sequenceOriginDate,
                sequenceStatus: seq.sequenceStatus,
                timeAwayFromBase: seq.timeAwayFromBase,
                multipleEquipments: seq.multipleEquipments,
                ronCities: seq.ronCities,
                international: seq.international,
                redEye: seq.isRedEye,
                trainingSequence: seq.isTrainingSequence
            },

            sequenceCreditInformation: {
                creditThisMonth: seq.creditThisMonth,
                creditNextMonth: seq.creditNextMonth,
                scheduledFlightTime: seq.scheduledFlight,
                scheduledTotalCredit:
                    seq.sequencePayCredit?.scheduledTotalCredit
            },

            dutyPeriods: seq.flightDutyPeriods.map((dp: any) => ({

                dutyPeriodNumber: dp.dutyPeriodNumber,

                startDateTimeLocal:
                    dp.startDateTime?.localTime,

                endDateTimeLocal:
                    dp.endDateTime?.localTime,

                duration: dp.duration,

                layoverAirport: dp.layOverAirport,

                layoverInMinutes: dp.layoverInMinutes,

                numberOfLegs: dp.numberOfLegs,

                odMinutes: dp.odMinutes,

                payCreditActualScheduledTotal:
                    dp.payCredit?.scheduledTotalCredit,

                international: dp.international,

                domesticDP: dp.domesticDP,

                flightLegs: dp.flightLegs.map((leg: any) => ({

                    flightNumber: leg.flightNumber,

                    originDestination:
                        `${leg.departureStation} to ${leg.arrivalStation}`,

                    flightOriginationDate:
                        leg.flightOriginationDate,

                    departureLocal:
                        leg.scheduled?.departureDateTime?.localTime,

                    arrivalLocal:
                        leg.scheduled?.arrivalDateTime?.localTime,

                    blockTime: leg.blockTime,

                    groundTime: leg.groundTime,

                    legIndex: leg.legIndex,

                    legStatuses: leg.legStatuses,

                    endOfDutyPeriod: leg.endOfDutyPeriod,

                    endOfSequence: leg.endOfSequence,

                    changeInFlightTime:
                        leg.changeInFlightTime,

                    departureGate: leg.departureGate,

                    departureTerminal: leg.departureTerminal,

                    arrivalGate: leg.arrivalGate,

                    arrivalTerminal: leg.arrivalTerminal,

                    flightStatus:
                        leg.flightStatusDisplayText ||
                        leg.flightStatus ||
                        'UNKNOWN',

                    equipment: {
                        assignedTail: leg.assignedTail,

                        equipmentType:
                            leg.equipmentQuals?.equipmentType,

                        equipmentGroup:
                            leg.equipmentQuals?.equipmentGroup,

                        equipmentNumber:
                            leg.equipmentQuals?.equipmentNumber
                    },

                    aircraftRegistrationNbr:
                        leg.equipment?.aircraftRegistrationNbr || null,

                    totalShipTime:
                        leg.equipment?.totalShipTime || null,

                    totalShipCycles:
                        leg.equipment?.totalShipCycles || null,

                    wifiCapability:
                        leg.equipment?.wifiCapability || null,

                    fastWifi:
                        leg.equipment?.fastWifi || null,

                    powerPorts:
                        leg.equipment?.powerPorts || null,

                    crewData:
                        leg.crewData || null,

                    international:
                        leg.international
                }))
            }))
        };
    });
};