import { expect, Test, TestCase, TestSuite } from "testyts";
import { Data, Rule, Request, validate } from "./rules";

const validRule: Rule = {
  condition: "eq",
  condition_value: 2,
  field: "length",
};

const validData: Data = {
  length: 2,
};

const ex1NestedField: Request = {
  rule: {
    field: "missions.count",
    condition: "gte",
    condition_value: 30,
  },
  data: {
    name: "James Holden",
    crew: "Rocinante",
    age: 34,
    position: "Captain",
    missions: {
      count: 45,
      successful: 44,
      failed: 1,
    },
  },
};

const ex2UnequalValues: Request = {
  rule: {
    field: "0",
    condition: "eq",
    condition_value: "a",
  },
  data: "damien-marley",
};

const ex3MissingArrayValue: Request = {
  rule: {
    field: "5",
    condition: "contains",
    condition_value: "rocinante",
  },
  data: ["The Nauvoo", "The Razorback", "The Roci", "Tycho"],
};

const invalidRuleConditions = ({
  rule: {
    field: "5",
    condition: "invalid",
    condition_value: "rocinante",
  },
  data: ["The Nauvoo", "The Razorback", "The Roci", "Tycho"],
} as unknown) as Request;

@TestSuite()
export class RuleValidationRequestBodyTests {
  @Test("required request fields")
  @TestCase(
    "field 'rule' is required",
    {},
    "missing_required_field",
    "rule is required."
  )
  @TestCase(
    "field 'data' is required",
    { rule: validRule },
    "missing_required_field",
    "data is required."
  )
  failsOnMissingRequiredRequestFields(
    request: any,
    expectedType: string,
    expectedValue: string
  ) {
    const result = validate(request);
    expect.toBeEqual(result.type, expectedType);
    expect.toBeEqual(result.value, expectedValue);
  }

  @Test("rejects invalid JSON payloads")
  @TestCase(
    "Apostrophe as JSON value",
    "'",
    "invalid_schema",
    "Invalid JSON payload passed."
  )
  rejectsInvalidJSONPayload(
    request: any,
    expectedType: string,
    expectedValue: string
  ) {
    const result = validate(request);
    expect.toBeEqual(result.type, expectedType);
    expect.toBeEqual(result.value, expectedValue);
  }

  @Test("checks valid type for rule and data")
  @TestCase(
    "valid data, invalid rule",
    { rule: "", data: validData },
    "type_error",
    "rule should be an object."
  )
  @TestCase(
    "invalid data, valid rule",
    { rule: validRule, data: 1 },
    "type_error",
    "data should be an array, an object, or a string."
  )
  checksValidTypesForRuleAndData(
    request: any,
    expectedType: string,
    expectedValue: string
  ) {
    const result = validate(request);
    expect.toBeEqual(result.type, expectedType);
    expect.toBeEqual(result.value, expectedValue);
  }

  @Test("errors on missing field in data")
  @TestCase(
    "missing top-level field",
    { rule: validRule, data: {} },
    "missing_data_field",
    "field length is missing from data."
  )
  @TestCase(
    "missing nested field",
    { rule: { ...validRule, field: "person.age" }, data: {} },
    "missing_data_field",
    "field person.age is missing from data."
  )
  errorOnMissingFieldInData(
    request: any,
    expectedType: string,
    expectedValue: string
  ) {
    const result = validate(request);
    expect.toBeEqual(result.type, expectedType);
    expect.toBeEqual(result.value, expectedValue);
  }

  @Test("validating correct requests")
  @TestCase(
    "Single top-level field",
    {
      data: validData,
      rule: validRule,
    },
    "completed",
    {
      condition: "eq",
      condition_value: 2,
      error: false,
      field: "length",
      field_value: 2,
    }
  )
  @TestCase("EX1: Nested field", ex1NestedField, "completed", {
    condition: "gte",
    condition_value: 30,
    error: false,
    field: "missions.count",
    field_value: 45,
  })
  @TestCase("EX2: Unequal value", ex2UnequalValues, "completed", {
    condition: "eq",
    condition_value: "a",
    error: true,
    field: "0",
    field_value: "damien-marley",
  })
  @TestCase("EX3: Missing array value", ex3MissingArrayValue, "completed", {
    condition: "contains",
    condition_value: "rocinante",
    error: true,
    field: "5",
    field_value: ["The Nauvoo", "The Razorback", "The Roci", "Tycho"],
  })
  successFullyValidatesCorrectRequests(
    request: any,
    expectedType: string,
    expectedValue: any
  ) {
    const result = validate(request);
    expect.toBeEqual(result.type, expectedType);
    expect.toBeEqual(
      JSON.stringify(result.value),
      JSON.stringify(expectedValue)
    );
  }

  @Test()
  @TestCase(
    "Invalid rule conditions",
    invalidRuleConditions,
    "type_error",
    "rule.condition must be one of eq, neq, gt, gte, or contains"
  )
  rejectsInvalidRuleConditions(
    request: any,
    expectedType: string,
    expectedValue: any
  ) {
    const result = validate(request);
    expect.toBeEqual(result.type, expectedType);
    expect.toBeEqual(
      JSON.stringify(result.value),
      JSON.stringify(expectedValue)
    );
  }
}
