import { z } from "zod";

/**
 * Schema for PATCH bodies: every field optional and, unlike a bare
 * `.partial()`, no `.default()` applied. Since zod 4, defaults still fire on
 * optional fields, so `schema.partial()` would turn a missing field into its
 * default and a PATCH would silently reset it (e.g. a task's notes or members).
 */
export function patchSchema<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [key, field instanceof z.ZodDefault ? field.unwrap() : field]),
  );
  return z.object(shape).partial() as unknown as ReturnType<z.ZodObject<Shape>["partial"]>;
}
