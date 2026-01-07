import { z } from 'zod';

export const registerSchema = z.object({
  airline: z.string().min(1, "Airline is Required"),
  crewId: z.number().min(1, "crewId is Required"),
  firstName: z.string().min(1, "firstName is Required"),
  lastName: z.string().min(1, "lastName is Required"),
  telephone: z.string().min(1, "telephone is Required"),
  purser: z.string().min(1, "purser is Required").optional(),
  speaker: z.string().min(1, "speaker is Required").optional(),
  languages: z.array(z.number()).min(
    1,
    "At least one language is required" // FIX: Changed error message
  ).optional(),
  // commuterAirportCode: z.string().min(1, "commuterAirportCode is Required"),
  email: z.string().email().min(1, "email is Required"),
  sex: z.string().min(1, "sex is Required"),
  deviceToken: z.string().min(1, "device is Required"),
  // password: z.string().min(6).min(1, "Password is Required"),
});

export const loginSchema = registerSchema;

export const resetPasswordSchema = z.object({
  crewId: z.number().min(1, "Crew is Required"),
  // email: z.string().min(1, "Email is Required"),
  password: z.string().min(1, "Password is Required"),
});