/**
 * Shared test helpers for contract tests: JSON Schema (ajv 2020-12) validators
 * plus record-type -> schema-name mapping.
 */

import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'node:fs';
import type { SchemaName } from '../../src/contracts';

const ajv = new Ajv2020({
  strict: false,
  allErrors: true,
});
addFormats(ajv);

const SCHEMA_BY_RECORD_TYPE: Record<string, SchemaName> = {
  SourceArtifact: 'source-artifact',
  ClaimRecord: 'claim',
  EntityRecord: 'entity',
  TopicRecord: 'topic',
  RelationshipRecord: 'relationship',
  SemanticGraph: 'semantic-graph',
  OverviewPlan: 'overview-plan',
  AudioTurn: 'audio-turn',
  VideoScene: 'video-scene',
  GeneratedArtifact: 'generated-artifact',
  ExperimentRecord: 'experiment-record',
};

const compiled = new Map<string, (data: unknown) => boolean>();

function loadSchema(name: SchemaName): (data: unknown) => boolean {
  const hit = compiled.get(name);
  if (hit !== undefined) return hit;
  const schema = JSON.parse(
    readFileSync(`src/contracts/schemas/${name}.schema.json`, 'utf8'),
  ) as object;
  const validate = ajv.compile(schema);
  compiled.set(name, validate);
  return validate;
}

/** Validate a record by its recordType discriminator. Throws for unknown types. */
export function validateWithJsonSchema(record: unknown): boolean {
  if (typeof record !== 'object' || record === null) {
    throw new Error('record is not an object');
  }
  const recordType = (record as { recordType?: unknown }).recordType;
  if (typeof recordType !== 'string') {
    throw new Error('record is missing recordType');
  }
  const schemaName = SCHEMA_BY_RECORD_TYPE[recordType];
  if (schemaName === undefined) {
    throw new Error(`unknown recordType ${recordType}`);
  }
  return loadSchema(schemaName)(record);
}

export function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}
