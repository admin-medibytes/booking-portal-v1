import { createMiddleware } from "hono/factory";
import { type, type Type } from "arktype";
import { ValidationError } from "@/server/utils/errors";

declare module "hono" {
  interface ContextVariableMap {
    validatedData: unknown;
  }
}

export const validateMiddleware = <T>(
  schema: Type<T>,
  source: "body" | "query" | "params" = "body"
) =>
  createMiddleware(async (c, next) => {
    try {
      let data: unknown;

      switch (source) {
        case "body":
          data = await c.req.json();
          break;
        case "query":
          data = c.req.query();
          break;
        case "params":
          data = c.req.param();
          break;
      }

      const result = schema(data);

      if (result instanceof type.errors) {
        const firstError = result[0];
        throw new ValidationError(
          `Validation failed: ${firstError.message}`,
          firstError.path.join('.'),
          data
        );
      }

      c.set("validatedData", result);
      await next();
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError("Invalid request data");
    }
  });
