/**
 * Emitted JSON Schema tests: committed schema files stay byte-identical to the
 * deterministic emission and compile as valid draft-2020-12 schemas.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020';
import { buildJsonSchemas, serializeSchema } from '../../src/contracts';

describe('emitted JSON schemas', () => {
  test('committed schema files are byte-identical to the emission', () => {
    const built = buildJsonSchemas();
    const names = Object.keys(built);
    expect(names.length).toBe(11);
    for (const [name, schema] of Object.entries(built)) {
      const file = `src/contracts/schemas/${name}.schema.json`;
      expect(readFileSync(file, 'utf8')).toBe(serializeSchema(schema));
    }
  });

  test('every schema compiles as draft-2020-12 with a root $id', () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    for (const [name, schema] of Object.entries(buildJsonSchemas())) {
      const validate = ajv.compile(schema);
      expect(typeof validate).toBe('function');
      expect((schema as { $id?: string }).$id).toBe(
        `https://webflix-lab.dev/contracts/${name}.schema.json`,
      );
    }
  });

  test('schemas are self-contained (no external $refs)', () => {
    const text = JSON.stringify(buildJsonSchemas());
    const externalRefs = /"\$ref"\s*:\s*"([^"#][^"]*)"/g.exec(text);
    expect(externalRefs).toBeNull();
  });
});
