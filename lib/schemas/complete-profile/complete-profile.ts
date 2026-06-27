import { z } from "zod";

export const CompleteProfileSchema = z.object({
  firstName: z.string().min(1, "name_required"),
  lastName: z.string().min(1, "last_name_required"),
  password: z.string().min(8, "password_min"),
});
