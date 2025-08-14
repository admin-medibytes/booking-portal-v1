import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { type, type Type } from "arktype";

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
        throw new HTTPException(400, {
          message: "Validation failed",
          cause: {
            errors: result.map((error) => ({
              path: error.path,
              message: error.message,
            })),
          },
        });
      }

      c.set("validatedData", result);
      await next();
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }

      throw new HTTPException(400, {
        message: "Invalid request data",
      });
    }
  });
