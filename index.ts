import Fastify, { FastifyInstance } from "fastify";
import { validate } from "./rules";

const server: FastifyInstance = Fastify({
  logger: true,
});

function success(message: string, status: "error" | "success", data: unknown) {
  return { message, status, data };
}

const myProfile = {
  name: process.env.AUTHOR_NAME,
  github: process.env.AUTHOR_GITHUB,
  email: process.env.AUTHOR_EMAIL,
  mobile: process.env.AUTHOR_PHONE,
};

server.get("/", async () => {
  return success("My Rule-Validation API", "success", myProfile);
});

class ValidationResponse {
  constructor(
    public message: string,
    public status: "error" | "success",
    public data: any
  ) {}
}

class FailedValidation extends ValidationResponse {
  constructor(public message: string, data?: any) {
    super(message, "error", data || null);
  }
}

server.post("/validate-rule", async (req) => {
  const body: any = req.body;
  const result = validate(body);
  switch (result.type) {
    case "completed": {
      const status: "error" | "success" = result.value.error
        ? "error"
        : "success";
      const message = `field ${result.value.field} ${
        result.value.error ? "failed validation" : "successfully validated"
      }.`;
      if (result.value.error) {
        throw new FailedValidation(message, result.value);
      }
      return new ValidationResponse(message, status, result.value);
    }
    default:
      throw new FailedValidation(result.value);
  }
});

server.setErrorHandler((error, _request, reply) => {
  if (
    error instanceof SyntaxError ||
    error.code === "FST_ERR_CTP_EMPTY_JSON_BODY"
  ) {
    return reply.status(error.statusCode || 400).send({
      message: "Invalid JSON payload passed.",
      status: "error",
      data: null,
    });
  }
  if (error instanceof FailedValidation) {
    return reply.status(400).send(error);
  }
  return reply
    .status(error.statusCode || 500)
    .send(new FailedValidation(error.message));
});

server.setNotFoundHandler((_, reply) => {
  reply
    .status(404)
    .send(new FailedValidation(`Route ${_.method} ${_.url} not found`));
});

const start = async () => {
  try {
    await server.listen(process.env.PORT || 3000);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
start();
