export type FormSchema = Record<string, unknown>;

export function deserializeFormSchemas(value: unknown): Map<string, FormSchema> {
  const schemas = typeof value === 'string' ? JSON.parse(value) : value;
  if (!schemas || typeof schemas !== 'object' || Array.isArray(schemas)) {
    return new Map();
  }
  return new Map(Object.entries(schemas as Record<string, FormSchema>));
}

export function serializeFormSchemas(forms: Map<string, FormSchema>): Record<string, FormSchema> {
  return Object.fromEntries(forms);
}