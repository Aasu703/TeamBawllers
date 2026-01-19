import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const detectionLogSchema = z.object({
  is_fake: z.boolean(),
  confidence: z.number().min(0).max(1),
  alert_msg: z.string().min(1).max(500),
  frame_timestamp: z.coerce.date(),
});
