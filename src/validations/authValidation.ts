import { z } from 'zod';

export const registerSchema = z.object({
  airline: z.string().min(1, "Airline is Required"),
  crewId: z.number().min(1, "crewId is Required"),
  firstName: z.string().min(1, "firstName is Required"),
  lastName: z.string().min(1, "lastName is Required"),
  telephone: z.string().min(1, "telephone is Required"),
  defaultLanguage: z.string().optional(),
  purser: z.string().min(1, "purser is Required").optional(),
  speaker: z.string().min(1, "speaker is Required").optional(),
  languages: z.array(z.number()).min(
    1,
    "At least one language is required" // FIX: Changed error message
  ).optional(),
  // commuterAirportCode: z.string().min(1, "commuterAirportCode is Required"),
  email: z.string().email().min(1, "email is Required"),
  // sex: z.string().min(1, "sex is Required"),
  deviceToken: z.string().min(1, "device is Required"),
  // password: z.string().min(6).min(1, "Password is Required"),
});

export const loginSchema = registerSchema;

export const resetPasswordSchema = z.object({
  crewId: z.number().min(1, "Crew is Required"),
  // email: z.string().min(1, "Email is Required"),
  password: z.string().min(1, "Password is Required"),
});

export const adminSignupSchema = z.object({
  crewId: z.number().int().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const adminListUsersQuerySchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  base: z.string().optional(),
  all: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(10),
});

export const adminUpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(1).optional(),
  base: z.string().min(1).optional(),
  isReserve: z.string().min(1).optional(),
  activeStatus: z.boolean().optional(),
});

export const adminBroadcastSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  message: z.string().min(1, 'Message is required').max(500),
  activeOnly: z.boolean().optional().default(true),
  base: z.string().optional(),
});