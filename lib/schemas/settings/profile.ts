import { z } from "zod";

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1, "name_required"),
  lastName: z.string().min(1, "last_name_required"),
});
