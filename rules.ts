import Joi from "joi";

export interface Rule {
  field: string;
  condition: Condition;
  condition_value: any;
}

export type Data = { [x: string]: any } | any[] | string;

export type Request = { data: Data; rule: Rule };

type CompareFn = <T>(value: T, other: T) => boolean;
type ComparisonRule = "eq" | "neq" | "gt" | "gte";

function containsValidator(
  value: string,
  substr: string,
  index?: number
): boolean;
function containsValidator(value: any[], element: any, index?: number): boolean;
function containsValidator(
  value: string | any[],
  element: any,
  index?: number
) {
  if (index != null && !Number.isNaN(index)) {
    return value?.[index] === element;
  }
  return value.includes(element);
}

const conditions: { [x in ComparisonRule]: CompareFn } & {
  contains: typeof containsValidator;
} = {
  eq: (value, other) => value === other,
  neq: (value, other) => value !== other,
  gt: (value, other) => value > other,
  gte: (value, other) => value >= other,
  contains: containsValidator,
};

type Condition = keyof typeof conditions;

const ruleSchema = Joi.object({
  field: Joi.string().exist().messages({
    "any.required": "rule.field is required",
    "string.base": "rule.field should be a string",
  }),
  condition: Joi.valid(...Object.keys(conditions))
    .exist()
    .messages({
      "any.only": "rule.condition must be one of eq, neq, gt, gte, or contains",
      "any.required": "rule.condition is required",
    }),
  condition_value: Joi.any().exist().messages({
    "any.required": "rule.condition_value is required",
  }),
}).messages({
  "object.base": "rule should be an object.",
});

const dataSchema = Joi.alternatives(Joi.array(), Joi.object(), Joi.string());

const validatorSchema = Joi.object({
  rule: ruleSchema.exist().messages({ "any.required": "rule is required." }),
  data: dataSchema.exist().messages({
    "any.required": "data is required.",
    "alternatives.types": "data should be an array, an object, or a string.",
  }),
}).id("");

export type EarlyAbortReason =
  | "invalid_schema"
  | "type_error"
  | "missing_required_field"
  | "missing_data_field";

export type EarlyAbort = {
  type: EarlyAbortReason;
  value: string;
};

export type ValidationCompleted = {
  error: boolean;
  field: string;
  field_value: Data;
  condition: Condition;
  condition_value: any;
};

export type ValidationResult =
  | EarlyAbort
  | { type: "completed"; value: ValidationCompleted };

export function validate(req: unknown): ValidationResult {
  const result = parseRequest(req);
  if (result.type !== "request") {
    return result;
  }
  const { data, rule } = result.value;
  let comparison: boolean;
  let dataFieldValue;
  if (typeof data === "string" || Array.isArray(data)) {
    dataFieldValue = data;
    comparison = conditions[rule.condition](
      dataFieldValue,
      rule.condition_value,
      Number.parseInt(rule.field)
    );
  } else {
    dataFieldValue = indexOn(data, rule.field);
  }
  if (dataFieldValue === undefined) {
    return {
      type: "missing_data_field",
      value: `field ${rule.field} is missing from data.`,
    };
  }
  comparison = conditions[rule.condition](dataFieldValue, rule.condition_value);
  return {
    type: "completed",
    value: {
      condition: rule.condition,
      condition_value: rule.condition_value,
      error: !comparison,
      field: rule.field,
      field_value: dataFieldValue as Data,
    },
  };
}

function parseRequest(
  req: unknown
): { type: "request"; value: Request } | EarlyAbort {
  const result = validatorSchema.validate(req);
  if (result.error) {
    const details = result.error.details[0];
    const path = String(details?.path);
    if (["data", "rule"].includes(path) && details?.type === "any.required") {
      return { type: "missing_required_field", value: details.message };
    }
    if (path == "" && details?.type === "object.base") {
      return { type: "invalid_schema", value: "Invalid JSON payload passed." };
    }
    switch (details?.type) {
      case "any.required": {
        return { type: "missing_required_field", value: details.message };
      }
      default:
        return { type: "type_error", value: details?.message || "" };
    }
  }

  return { type: "request", value: req as Request };
}

type Indexable = {
  [x: string]: any;
};

function indexOn(obj: Indexable, path: string): unknown | undefined {
  let parts = typeof path === "string" ? path.split(".") : [path];
  parts = parts.filter((v) => v.trim() !== "");
  return parts.reduce((prev, current) => {
    return prev?.[current];
  }, obj);
}
