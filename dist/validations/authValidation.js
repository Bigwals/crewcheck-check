"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    airline: zod_1.z.string().min(1, "Airline is Required"),
    crewId: zod_1.z.number().min(1, "crewId is Required"),
    firstName: zod_1.z.string().min(1, "firstName is Required"),
    lastName: zod_1.z.string().min(1, "lastName is Required"),
    telephone: zod_1.z.string().min(1, "telephone is Required"),
    commuterAirportCode: zod_1.z.string().min(1, "commuterAirportCode is Required"),
    email: zod_1.z.string().email().min(1, "email is Required"),
    // password: z.string().min(6).min(1, "Password is Required"),
});
exports.loginSchema = exports.registerSchema;
exports.resetPasswordSchema = zod_1.z.object({
    crewId: zod_1.z.number().min(1, "Crew is Required"),
    // email: z.string().min(1, "Email is Required"),
    password: zod_1.z.string().min(1, "Password is Required"),
});
