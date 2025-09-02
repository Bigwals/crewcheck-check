"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCrewPayDetails = exports.findCrewAndUpdate = exports.findByCrewId = exports.UpdatePassword = exports.findCrewById = exports.findCrewByEmail = void 0;
const newCrewModel_1 = require("../models/newCrewModel");
const db_1 = require("../config/db");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// export const findCrewByEmail = async (email: string) => {
//   return await NewCrew.findOne({ email });
// };
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
    return result.recordset.length > 0 ? result.recordset[0] : null;
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
const findCrewAndUpdate = async (id, avatar) => {
    const crew = await newCrewModel_1.NewCrew.findByIdAndUpdate(id, { $set: { avatar } }, { new: true }).populate({ path: "avatar", select: "_id media" });
    return crew;
};
exports.findCrewAndUpdate = findCrewAndUpdate;
// helper function
const getYearsOfService = (hireDate, today = new Date()) => {
    let years = today.getFullYear() - hireDate.getFullYear();
    const monthDiff = today.getMonth() - hireDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < hireDate.getDate())) {
        years--;
    }
    return years + 1;
};
const getCrewPayDetails = async (crewId) => {
    const pool = await (0, db_1.getPool)();
    // 1. Get crew hireDate
    const crewResult = await pool.request()
        .input("crewId", db_1.sql.Int, crewId)
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
        .input("YearsOfService", db_1.sql.Int, cappedYears)
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
exports.getCrewPayDetails = getCrewPayDetails;
