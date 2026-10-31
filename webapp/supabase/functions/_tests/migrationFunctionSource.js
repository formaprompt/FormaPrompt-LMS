// Test support only: select the last real top-level function definition in migration order.
// This reads repository SQL; it never proves which migrations a database has applied.
export function sqlStatements(source, delimiter = ';') {
  const result = [];
  let start = 0, index = 0, depth = 0;
  while (index < source.length) {
    if (source.startsWith('--', index)) {
      const end = source.indexOf('\n', index + 2); index = end < 0 ? source.length : end + 1;
    } else if (source.startsWith('/*', index)) {
      let depth = 1; index += 2;
      while (index < source.length && depth) {
        if (source.startsWith('/*', index)) { depth += 1; index += 2; }
        else if (source.startsWith('*/', index)) { depth -= 1; index += 2; }
        else index += 1;
      }
      if (depth) throw new Error('Unterminated SQL comment');
    } else if (source[index] === "'" || source[index] === '"') {
      const quote = source[index++]; let closed = false;
      while (index < source.length) {
        if (source[index++] !== quote) continue;
        if (source[index] === quote) { index += 1; continue; }
        closed = true; break;
      }
      if (!closed) throw new Error('Unterminated SQL quote');
    } else if (source[index] === '$' && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(source.slice(index))) {
      const tag = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)[0];
      const end = source.indexOf(tag, index + tag.length);
      if (end < 0) throw new Error('Unterminated SQL dollar quote');
      index = end + tag.length;
    } else if (source[index] === '(') { depth += 1; index += 1;
    } else if (source[index] === ')') { depth -= 1; index += 1;
    } else if (source[index] === delimiter && depth === 0) {
      result.push(source.slice(start, ++index)); start = index;
    } else index += 1;
  }
  if (source.slice(start).trim()) result.push(source.slice(start));
  return result;
}

function withoutLeadingComments(statement) {
  let text = statement.trimStart();
  for (;;) {
    if (text.startsWith('--')) {
      const end = text.indexOf('\n'); text = end < 0 ? '' : text.slice(end + 1).trimStart();
    } else if (text.startsWith('/*')) {
      let depth = 1, index = 2;
      while (index < text.length && depth) {
        if (text.startsWith('/*', index)) { depth += 1; index += 2; }
        else if (text.startsWith('*/', index)) { depth -= 1; index += 2; }
        else index += 1;
      }
      if (depth) throw new Error('Unterminated leading SQL comment');
      text = text.slice(index).trimStart();
    } else return text;
  }
}

export function latestFunctionMigration(migrations, qualifiedName, expectedArguments = ['uuid', 'text', 'text']) {
  if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(qualifiedName)) throw new Error('Invalid qualified function name');
  const name = qualifiedName.replace('.', '\\.');
  const definition = new RegExp(`^CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${name}\\s*\\(`, 'i');
  let latest = null;
  for (const migration of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    const statements = sqlStatements(migration.source).map(withoutLeadingComments);
    for (let index = 0; index < statements.length; index += 1) {
      if (definition.test(statements[index])) {
        const header = statements[index].match(/\(([\s\S]*?)\)\s*RETURNS\b/i);
        if (!header) throw new Error('Unrecognized function signature');
        const actualArguments = sqlStatements(header[1], ',').map(argument => {
          const declaration = argument.replace(/,\s*$/, '').split(/\s+DEFAULT\b/i)[0].trim();
          const type = declaration.match(/^(?:IN\s+)?(?:[a-z_][a-z0-9_]*\s+)?(?:pg_catalog\.)?(uuid|text)$/i);
          if (!type) throw new Error('Unsupported or unexpected function overload');
          return type[1].toLowerCase();
        });
        if (actualArguments.join(',') !== expectedArguments.join(',')) throw new Error('Unexpected function overload');
        latest = { name: migration.name, source: statements.slice(index).join('\n') };
      }
    }
  }
  return latest;
}

// Restricted source analysis for this RPC's literal IF allowlist; not a PostgreSQL interpreter.
// Strings and dollar-quoted values stay opaque, and comments never become executable tokens.
function tokens(source) {
  const result = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) { index += 1; continue; }
    if (source.startsWith('--', index)) {
      const end = source.indexOf('\n', index + 2); index = end < 0 ? source.length : end + 1; continue;
    }
    if (source.startsWith('/*', index)) {
      let depth = 1; index += 2;
      while (index < source.length && depth) {
        if (source.startsWith('/*', index)) { depth += 1; index += 2; }
        else if (source.startsWith('*/', index)) { depth -= 1; index += 2; }
        else index += 1;
      }
      if (depth) throw new Error('Unterminated allowlist comment');
      continue;
    }
    const escaped = /[Ee]/.test(source[index]) && source[index + 1] === "'";
    if (escaped) index += 1;
    if (source[index] === "'" || source[index] === '"') {
      const quote = source[index++]; let value = '', closed = false;
      while (index < source.length) {
        const character = source[index++];
        if (escaped && character === '\\') {
          if (index >= source.length) throw new Error('Unterminated escaped string');
          value += character + source[index++]; continue;
        }
        if (character !== quote) { value += character; continue; }
        if (source[index] === quote) { value += quote; index += 1; continue; }
        closed = true; break;
      }
      if (!closed) throw new Error('Unterminated allowlist quote');
      result.push({ kind: quote === '"' ? 'quoted-identifier' : escaped ? 'escaped-string' : 'string', value });
      continue;
    }
    const dollar = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
    if (dollar) {
      const begin = index + dollar[0].length, end = source.indexOf(dollar[0], begin);
      if (end < 0) throw new Error('Unterminated allowlist dollar quote');
      result.push({ kind: 'dollar', value: source.slice(begin, end) }); index = end + dollar[0].length; continue;
    }
    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/);
    if (word) { result.push({ kind: 'word', value: word[0].toLowerCase() }); index += word[0].length; continue; }
    result.push({ kind: 'symbol', value: source[index++] });
  }
  return result;
}

export function adminGiftAllowlist(functionSource) {
  const statement = sqlStatements(functionSource)[0];
  if (!statement) throw new Error('Missing gift function');
  const outer = tokens(statement);
  const bodies = outer.flatMap((token, index) => token.kind === 'word' && token.value === 'as' && outer[index + 1]?.kind === 'dollar' ? [outer[index + 1].value] : []);
  if (bodies.length !== 1) throw new Error('Expected one dollar-quoted gift function body');
  const body = tokens(bodies[0]);
  const lists = [];
  const isWord = (index, value) => body[index]?.kind === 'word' && body[index].value === value;
  for (let index = 0; index < body.length; index += 1) {
    if (!isWord(index, 'if') || !isWord(index + 1, 'v_course_id') || !isWord(index + 2, 'not') || !isWord(index + 3, 'in') || body[index + 4]?.value !== '(') continue;
    const ids = []; let cursor = index + 5;
    for (;;) {
      if (body[cursor]?.kind !== 'string') throw new Error('Gift allowlist requires literal strings');
      ids.push(body[cursor++].value);
      if (body[cursor]?.value === ')') { cursor += 1; break; }
      if (body[cursor++]?.value !== ',') throw new Error('Malformed gift allowlist separator');
    }
    if (!isWord(cursor, 'then')) throw new Error('Gift allowlist must be the executable IF condition');
    lists.push(ids);
  }
  if (lists.length !== 1) throw new Error('Expected exactly one executable gift allowlist');
  return lists[0];
}
