import z from "zod";

// geofence radius ko default 20 meter (PDF requirement)
export const GEOFENCE_DEFAULT_RADIUS = 20;

const latitudeSchema = z
    .number()
    .min(-90, "Invalid latitude")
    .max(90, "Invalid latitude");

const longitudeSchema = z
    .number()
    .min(-180, "Invalid longitude")
    .max(180, "Invalid longitude");

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
const phoneSchema = z.preprocess(
    emptyToUndef,
    z
        .string()
        .regex(/^[0-9]+$/, "Phone must contain numbers only")
        .min(7, "Phone must be at least 7 digits")
        .max(15, "Phone must be at most 15 digits")
        .optional(),
);

export const CreateBranchDTO = z.object({
    name: z.string().min(2).max(100),
    code: z.string().min(2).max(20),
    address: z.string().min(2),
    phone: phoneSchema,
    latitude: latitudeSchema.optional().default(0),
    longitude: longitudeSchema.optional().default(0),
    geofenceRadius: z.number().min(10).max(1000).optional().default(GEOFENCE_DEFAULT_RADIUS),
});

export const UpdateBranchDTO = z.object({
    name: z.string().min(2).max(100).optional(),
    code: z.string().min(2).max(20).optional(),
    address: z.string().min(2).optional(),
    phone: phoneSchema,
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    geofenceRadius: z.number().min(10).max(1000).optional(),
    status: z.enum(["active", "inactive"]).optional(),
});
