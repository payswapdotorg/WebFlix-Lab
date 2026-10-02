/**
 * Minimal YAML subset parser + deterministic emitter (WFLX-P3 / EV-023).
 *
 * The repo carries NO yaml dependency (see tools/experiments/records.ts —
 * "hand-rolled emitter; the record schema is fixed"), so the comparison
 * program uses the same discipline: a hand-rolled, FAIL-LOUD subset
 * implementation.
 *
 * PARSER — understands exactly the constructs present in the committed
 * record estate (docs/experiments/records/*.yaml, LAB-01..09) and in this
 * module's own emitted output:
 *   - nested maps (indentation-based, any depth);
 *   - lists of scalars (`- value`);
 *   - lists of maps (`- key: value` + continuation keys at item indent + 2);
 *   - double-quoted strings (with \\ \" \n \r \t escapes), single-quoted
 *     strings ('' doubling), plain scalars, `null`, `true`, `false`,
 *     integers/decimals;
 *   - flow-empty `[]` and `{}`;
 *   - trailing `# comments` (never inside quotes).
 * Anything else (block scalars |, >, anchors &, aliases *, flow collections
 * with content, multi-document `---`) throws — the lab never silently
 * mis-parses a record.
 *
 * EMITTER — a pure function of the value: fixed key order (insertion order),
 * 2-space indents, every string double-quoted. parseYaml(emitYaml(v)) === v
 * and emitYaml(parseYaml(emitYaml(v))) byte-identical (round-trip proofs are
 * asserted by tests/integration/comparison-schema.test.ts).
 */

export type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { readonly [key: string]: YamlValue };

const KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;

export class YamlParseError extends Error {
  constructor(message: string, readonly line: number, readonly text: string) {
    super(`YAML parse error at line ${line}: ${message}\n  >> ${text}`);
    this.name = 'YamlParseError';
  }
}

interface SourceLine {
  readonly indent: number;
  readonly text: string; // content AFTER indentation, comment stripped
  readonly number: number; // 1-based original line number
}

/** Strip a trailing comment that starts outside of any quoted span. */
function stripComment(raw: string): string {
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i] as string;
    if (inDouble) {
      if (char === '\\') i += 1;
      else if (char === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      if (char === "'") inSingle = false;
      continue; // a double quote inside single quotes is literal
    }
    if (char === '"') inDouble = true;
    else if (char === "'") inSingle = true;
    else if (char === '#' && (i === 0 || raw[i - 1] === ' ' || raw[i - 1] === '\t')) {
      return raw.slice(0, i).trimEnd();
    }
  }
  return raw.trimEnd();
}

function indentWidth(line: string): number {
  let width = 0;
  while (width < line.length && line[width] === ' ') width += 1;
  if (line[width] === '\t') throw new YamlParseError('tabs are not allowed for indentation', 0, line);
  return width;
}

/** Split the raw document into significant (non-blank, non-comment) lines. */
function significantLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const rawLines = text.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i] as string;
    const stripped = stripComment(raw);
    if (stripped.trim() === '') continue;
    lines.push({ indent: indentWidth(stripped), text: stripped.trim(), number: i + 1 });
  }
  return lines;
}

function unescapeDouble(quoted: string, line: number): string {
  // quoted includes the surrounding double quotes
  let out = '';
  for (let i = 1; i < quoted.length - 1; i += 1) {
    const char = quoted[i] as string;
    if (char !== '\\') {
      out += char;
      continue;
    }
    const next = quoted[i + 1];
    if (next === undefined) throw new YamlParseError('dangling backslash', line, quoted);
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === '"' || next === '\\') out += next;
    else throw new YamlParseError(`unsupported escape \\${next}`, line, quoted);
    i += 1;
  }
  return out;
}

function unescapeSingle(quoted: string): string {
  return quoted.slice(1, -1).replace(/''/g, "'");
}

/** Parse one scalar token (a full line-segment after `key:` or `- `). */
function parseScalar(token: string, line: number): string | number | boolean | null {
  const trimmed = token.trim();
  if (trimmed === '') return null;
  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"') || trimmed.length < 2) {
      throw new YamlParseError('unterminated double-quoted string', line, trimmed);
    }
    return unescapeDouble(trimmed, line);
  }
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'") || trimmed.length < 2) {
      throw new YamlParseError('unterminated single-quoted string', line, trimmed);
    }
    return unescapeSingle(trimmed);
  }
  if (trimmed === 'null' || trimmed === '~') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

interface ParseState {
  readonly lines: readonly SourceLine[];
  index: number;
}

function peek(state: ParseState): SourceLine | undefined {
  return state.lines[state.index];
}

/** Split a `key: value` / `key:` line. Returns null when not a mapping entry. */
function splitEntry(text: string): { key: string; rest: string } | null {
  // Keys in the estate are bare identifiers followed by ': ' or ':' EOL.
  const match = /^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/.exec(text);
  if (match === null) return null;
  return { key: match[1] as string, rest: (match[2] ?? '').trim() };
}

function parseBlock(state: ParseState, indent: number): YamlValue {
  const first = peek(state);
  if (first === undefined || first.indent < indent) return null;
  if (first.text.startsWith('- ')) return parseList(state, first.indent);
  return parseMap(state, first.indent);
}

function parseMap(state: ParseState, indent: number): { [key: string]: YamlValue } {
  const result: { [key: string]: YamlValue } = {};
  for (;;) {
    const line = peek(state);
    if (line === undefined || line.indent < indent) break;
    if (line.indent > indent) {
      throw new YamlParseError(
        `unexpected deeper indent (${line.indent} > ${indent})`,
        line.number,
        line.text,
      );
    }
    if (line.text.startsWith('- ')) {
      throw new YamlParseError('list item where a mapping key was expected', line.number, line.text);
    }
    const entry = splitEntry(line.text);
    if (entry === null) {
      throw new YamlParseError('expected a `key: value` mapping entry', line.number, line.text);
    }
    if (!KEY_PATTERN.test(entry.key)) {
      throw new YamlParseError(`unsupported key characters: ${entry.key}`, line.number, line.text);
    }
    if (Object.prototype.hasOwnProperty.call(result, entry.key)) {
      throw new YamlParseError(`duplicate mapping key: ${entry.key}`, line.number, line.text);
    }
    state.index += 1;
    if (entry.rest === '') {
      // Nested block (deeper indent) or explicit null (nothing deeper).
      const next = peek(state);
      result[entry.key] =
        next !== undefined && next.indent > indent ? parseBlock(state, indent + 1) : null;
    } else if (entry.rest === '[]') {
      result[entry.key] = [];
    } else if (entry.rest === '{}') {
      result[entry.key] = {};
    } else {
      result[entry.key] = parseScalar(entry.rest, line.number);
    }
  }
  return result;
}

function parseList(state: ParseState, indent: number): YamlValue[] {
  const result: YamlValue[] = [];
  for (;;) {
    const line = peek(state);
    if (line === undefined || line.indent < indent) break;
    if (line.indent > indent) {
      throw new YamlParseError(
        `unexpected deeper indent (${line.indent} > ${indent})`,
        line.number,
        line.text,
      );
    }
    if (!line.text.startsWith('- ')) break; // caller continues with the map at this indent
    const content = line.text.slice(2).trim();
    state.index += 1;
    if (content === '') {
      const next = peek(state);
      result.push(
        next !== undefined && next.indent > indent ? parseBlock(state, indent + 1) : null,
      );
      continue;
    }
    const inlineEntry = splitEntry(content);
    if (inlineEntry === null) {
      result.push(parseScalar(content, line.number));
      continue;
    }
    // Map item: first pair inline; continuation pairs at item indent + 2.
    const itemIndent = indent + 2;
    const item: { [key: string]: YamlValue } = {};
    const applyEntry = (key: string, rest: string, at: SourceLine): void => {
      if (!KEY_PATTERN.test(key)) {
        throw new YamlParseError(`unsupported key characters: ${key}`, at.number, at.text);
      }
      if (rest === '') {
        const next = peek(state);
        item[key] =
          next !== undefined && next.indent > itemIndent
            ? parseBlock(state, itemIndent + 1)
            : null;
      } else if (rest === '[]') {
        item[key] = [];
      } else if (rest === '{}') {
        item[key] = {};
      } else {
        item[key] = parseScalar(rest, at.number);
      }
    };
    applyEntry(inlineEntry.key, inlineEntry.rest, line);
    for (;;) {
      const cont = peek(state);
      if (cont === undefined || cont.indent < itemIndent) break;
      if (cont.indent > itemIndent) {
        throw new YamlParseError(
          `unexpected deeper indent (${cont.indent} > ${itemIndent}) in list item`,
          cont.number,
          cont.text,
        );
      }
      if (cont.text.startsWith('- ')) break; // next item of the outer list
      const contEntry = splitEntry(cont.text);
      if (contEntry === null) {
        throw new YamlParseError('expected a continuation `key: value` entry', cont.number, cont.text);
      }
      state.index += 1;
      applyEntry(contEntry.key, contEntry.rest, cont);
    }
    result.push(item);
  }
  return result;
}

/** Parse a YAML document. The top level must be a mapping. */
export function parseYaml(text: string): { [key: string]: YamlValue } {
  if (/^---\s*$/m.test(text)) {
    throw new YamlParseError('multi-document streams are not supported', 0, '---');
  }
  const lines = significantLines(text);
  if (lines.length === 0) return {};
  const state: ParseState = { lines, index: 0 };
  const value = parseMap(state, lines[0]?.indent ?? 0);
  if (state.index !== lines.length) {
    const leftover = peek(state);
    throw new YamlParseError(
      `trailing content after the top-level mapping (${lines.length - state.index} line(s))`,
      leftover?.number ?? 0,
      leftover?.text ?? '',
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Deterministic emitter
// ---------------------------------------------------------------------------

function escapeDouble(value: string): string {
  let out = '"';
  for (const char of value) {
    if (char === '\\') out += '\\\\';
    else if (char === '"') out += '\\"';
    else if (char === '\n') out += '\\n';
    else if (char === '\r') out += '\\r';
    else if (char === '\t') out += '\\t';
    else out += char;
  }
  return `${out}"`;
}

function scalarToken(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return escapeDouble(value);
  return String(value);
}

function emitValue(value: YamlValue, indent: number): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return value
      .map((item) => {
        if (item === null || typeof item !== 'object') {
          return `${pad}- ${scalarToken(item as string | number | boolean | null)}`;
        }
        if (Array.isArray(item)) {
          throw new Error('emitYaml: nested arrays are not supported by this subset');
        }
        return emitMapAsListItem(item as { [key: string]: YamlValue }, indent);
      })
      .join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '';
    return entries.map(([key, child]) => emitPair(key, child, indent)).join('\n');
  }
  return `${pad}${scalarToken(value)}`;
}

function emitPair(key: string, value: YamlValue, indent: number): string {
  const pad = ' '.repeat(indent);
  if (!KEY_PATTERN.test(key)) throw new Error(`emitYaml: unsupported key: ${key}`);
  if (value === null) return `${pad}${key}: null`;
  if (typeof value !== 'object') return `${pad}${key}: ${scalarToken(value)}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}${key}: []`;
    return `${pad}${key}:\n${emitValue(value, indent + 2)}`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return `${pad}${key}: {}`;
  return `${pad}${key}:\n${emitValue(value, indent + 2)}`;
}

function emitMapAsListItem(item: { [key: string]: YamlValue }, indent: number): string {
  const entries = Object.entries(item);
  if (entries.length === 0) return `${' '.repeat(indent)}- {}`;
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  entries.forEach(([key, value], position) => {
    const prefix = position === 0 ? `${pad}- ` : `${pad}  `;
    if (value === null) lines.push(`${prefix}${key}: null`);
    else if (typeof value !== 'object') lines.push(`${prefix}${key}: ${scalarToken(value)}`);
    else if (Array.isArray(value)) {
      if (value.length === 0) lines.push(`${prefix}${key}: []`);
      else lines.push(`${prefix}${key}:\n${emitValue(value, indent + 4)}`);
    } else {
      const childEntries = Object.entries(value);
      if (childEntries.length === 0) lines.push(`${prefix}${key}: {}`);
      else lines.push(`${prefix}${key}:\n${emitValue(value, indent + 4)}`);
    }
  });
  return lines.join('\n');
}

/** Deterministic YAML emission (fixed key order, 2-space indents, quoted strings). */
export function emitYaml(value: { readonly [key: string]: YamlValue }): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}\n';
  return `${entries.map(([key, child]) => emitPair(key, child, 0)).join('\n')}\n`;
}
