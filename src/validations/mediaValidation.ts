import { z } from 'zod';

export const mediaSchema = z.object({
  crewId: z.string().min(1, "Crew ID is required"),
  media: z.string().min(1, "Media is required"),
});