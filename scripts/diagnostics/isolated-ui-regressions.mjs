import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

// Source and isolated hook tests only. No browser, credentials, or remote DB.
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
let passes = 0;
function test(name, fn) { fn(); passes++; console.log(`PASS ${name}`); }
function load(file, dependencies = {}, context = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, require: name => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; }, ...context });
  return module.exports;
}
const unwrap = node => {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
  return node;
};
function chain(node) {
  const calls = [];
  node = unwrap(node);
  while (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    calls.push({ method: node.expression.name.text, args: node.arguments });
    node = unwrap(node.expression.expression);
  }
  return calls;
}
const sources = [];
function collect(dir) {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.tsx?$/.test(file)) sources.push([file, ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)]);
  }
}
collect('src');
test('all active client receipt queries exclude reversed receipts on the correct table', () => {
  let checked = 0;
  for (const [file, source] of sources) {
    function walk(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'select') {
        const before = chain(node);
        const table = before.find(c => c.method === 'from')?.args[0]?.text;
        let outer = node;
        while (outer.parent && ((ts.isPropertyAccessExpression(outer.parent) && outer.parent.expression === outer)
          || (ts.isCallExpression(outer.parent) && outer.parent.expression === outer)
          || ts.isParenthesizedExpression(outer.parent) || ts.isAsExpression(outer.parent))) outer = outer.parent;
        const filters = chain(outer).filter(c => c.method === 'is' && c.args[0]?.text === 'reversed_at');
        if (table === 'client_payments' && !before.some(c => ['insert','update','delete','upsert'].includes(c.method))) {
          checked++;
          assert.ok(filters.some(c => c.args[1]?.kind === ts.SyntaxKind.NullKeyword), `${file}: active receipts missing reversal filter`);
        }
        if (filters.length) assert.ok(['client_payments','technician_payments'].includes(table), `${file}: reversal filter attached to ${table}`);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  assert.ok(checked >= 15, `Only ${checked} queries checked`);
  console.log(`  inspected ${checked} receipt queries`);
});
test('operation key survives retries and changes only on a new payload or successful reset', () => {
  const ref = { current: null };
  let sequence = 0;
  const { useOperationKey } = load('src/hooks/useOperationKey.ts', {
    react: { useRef: () => ref, useCallback: fn => fn }, '@/lib/uuid': { generateIdempotencyKey: () => `key-${++sequence}` },
  });
  const first = useOperationKey().getKey({ amount: 10 });
  assert.equal(useOperationKey().getKey({ amount: 10 }), first);
  assert.notEqual(useOperationKey().getKey({ amount: 11 }), first);
  const second = ref.current.key;
  useOperationKey().reset();
  assert.notEqual(useOperationKey().getKey({ amount: 11 }), second);
});
function guardHarness() {
  let index = 0, effects = [], states = [];
  const listeners = new Map(), navigations = [];
  const target = { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key), location: { href: 'http://test.local/projects/new', origin: 'http://test.local', pathname: '/projects/new', search: '' } };
  const { useUnsavedChangesGuard } = load('src/hooks/useUnsavedChangesGuard.ts', {
    react: { useState: initial => { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], value => states[i] = typeof value === 'function' ? value(states[i]) : value]; },
      useEffect: fn => effects.push(fn), useCallback: fn => fn },
    'react-router-dom': { useNavigate: () => (...args) => navigations.push(args) },
  }, { window: target, document: target, URL });
  return { listeners, navigations, render: options => { index = 0; effects = []; const guard = useUnsavedChangesGuard(options); for (const effect of effects) effect(); return guard; } };
}
test('dirty form stays until discard is confirmed, while a pending save blocks navigation', () => {
  const harness = guardHarness();
  const dirty = { isDirty: true };
  harness.render(dirty).requestNavigate('/clients');
  assert.equal(harness.navigations.length, 0);
  assert.equal(harness.render(dirty).showConfirmDialog, true);
  harness.render(dirty).cancelDiscard();
  assert.equal(harness.navigations.length, 0);
  harness.render(dirty).requestNavigate('/clients');
  harness.render(dirty).confirmDiscard();
  assert.equal(harness.navigations[0][0], '/clients');
  harness.render({ isDirty: true, isSubmitting: true }).requestNavigate('/suppliers');
  assert.equal(harness.navigations.length, 1);
});
test('pending save protects refresh even after dirty state becomes false', () => {
  const harness = guardHarness();
  harness.render({ isDirty: false, isSubmitting: true });
  let prevented = false;
  const event = { preventDefault: () => prevented = true };
  harness.listeners.get('beforeunload')(event);
  assert.ok(prevented);
  assert.equal(event.returnValue, '');
});
test('sidebar navigation is intercepted for a dirty form and resumed after confirmation', () => {
  const harness = guardHarness();
  const dirty = { isDirty: true };
  harness.render(dirty);
  let prevented = false;
  harness.listeners.get('click')({ button: 0, target: { closest: () => ({ href: 'http://test.local/clients', target: '', hasAttribute: () => false }) },
    preventDefault: () => prevented = true, stopImmediatePropagation: () => {} });
  assert.ok(prevented);
  assert.equal(harness.navigations.length, 0);
  harness.render(dirty).confirmDiscard();
  assert.equal(harness.navigations[0][0], '/clients');
});
function luminance(value) {
  const [h, s0, l0] = value.match(/[\d.]+/g).map(Number), s = s0 / 100, l = l0 / 100;
  const a = s * Math.min(l, 1 - l);
  const rgb = [0, 8, 4].map(n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); });
  const linear = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
for (const theme of [':root', '.dark']) test(`${theme} core text and button colors meet 4.5:1 contrast`, () => {
  const block = read('src/index.css').split(`${theme} {`)[1].split('}')[0];
  const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2]]));
  for (const [fg, bg] of [['foreground','background'],['card-foreground','card'],['primary-foreground','primary'],['sidebar-primary-foreground','sidebar-primary'],['muted-foreground','muted'],['destructive-foreground','destructive'],['destructive','background']]) {
    const values = [luminance(tokens[fg]), luminance(tokens[bg])].sort((a,b) => b-a);
    const ratio = (values[0] + .05) / (values[1] + .05);
    assert.ok(ratio >= 4.5, `${theme} ${fg}/${bg}: ${ratio.toFixed(2)}:1`);
  }
});
console.log(`\n${passes} isolated UI regression tests passed.`);
