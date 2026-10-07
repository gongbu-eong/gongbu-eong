/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node tests with no browser, network or production data. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, dependencies, globals = {}, extra = '') {
  const filename = path.join(__dirname, '..', relativePath);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8') + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports, console, URL, URLSearchParams, Blob,
    process: { env: {} }, ...globals,
    require(id) {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      throw new Error(`Unexpected import: ${id}`);
    },
  }, { filename });
  return loadedModule.exports;
}

test('all six tools serialize named, private activity payloads and preserve browser session identity', async () => {
  const sent = [];
  const store = new Map();
  const api = load('features/analytics/analytics.api.ts', {
    '@/shared/session/anonymous-id': { getAnonymousId: () => 'anonymous-browser' },
  }, {
    window: {
      location: { pathname: '/ai-tools/job-tools', search: '?tool=salary', origin: 'https://test.invalid' },
      sessionStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) },
      localStorage: { getItem: () => null },
    },
    document: { title: 'Test', referrer: '' },
    crypto: { randomUUID: () => 'browser-session' },
    fetch: async (url, options) => { sent.push(JSON.parse(options.body)); return { ok: true }; },
  });
  for (const [key, name] of Object.entries(api.JOB_TOOL_NAMES)) {
    for (const action of ['view', 'use', 'calculate', 'copy']) {
      await api.trackJobToolEvent(key, action);
      const event = sent.at(-1);
      assert.equal(event.eventType, `job_tool_${action}`);
      assert.equal(event.properties.tool_name, name);
      assert.equal(event.properties.screen_key, `job_tool_${key}`);
      assert.equal(event.properties.path, `/ai-tools/job-tools?tool=${key}`);
      assert.equal(event.properties.session_id, 'browser-session');
      assert.equal(event.anonymousId, 'anonymous-browser');
      assert.equal(event.properties.input_text, undefined);
      assert.equal(event.properties.salary, undefined);
      assert.equal(api.getScreenBucket(event.properties.path).key, `job_tool_${key}`);
    }
  }
  await api.trackProductEvent({ eventType: 'interview_coaching_result_view', properties: { session_id: 'wrong-domain-id', interview_session_id: 'interview-id' } });
  assert.equal(sent.at(-1).properties.session_id, 'browser-session');
  assert.equal(sent.at(-1).properties.interview_session_id, 'interview-id');
  assert.equal(api.getScreenBucket('/ai-tools/coaching/result/id').key, 'resume_coaching');
  assert.equal(api.getScreenBucket('/ai-tools/interview-coaching/result/id').key, 'interview_coaching');
  assert.equal(api.getScreenBucket('/ai-tools/job-tools?tool=invalid').key, 'job_tool_salary');
});

test('blocked storage or a rejected analytics request never rejects a user action', async () => {
  for (const blockedStorage of [true, false]) {
    const api = load('features/analytics/analytics.api.ts', {
      '@/shared/session/anonymous-id': { getAnonymousId: () => 'anonymous-browser' },
    }, {
      window: {
        location: { pathname: '/', search: '' },
        sessionStorage: { getItem() { if (blockedStorage) throw new Error('blocked'); return 'session'; } },
        localStorage: { getItem: () => null },
      },
      document: { title: '', referrer: '' },
      fetch: async () => { throw new Error('offline'); },
    });
    await assert.doesNotReject(api.trackJobToolEvent('salary', 'calculate'));
  }
});

test('navigation tracking starts immediately and waits for the event request', async () => {
  let requestStarted = false;
  let finishRequest;
  const api = load('features/analytics/analytics.api.ts', {
    '@/shared/session/anonymous-id': { getAnonymousId: () => 'anonymous-browser' },
  }, {
    window: {
      location: { pathname: '/jobs/job-id', search: '', origin: 'https://test.invalid' },
      sessionStorage: { getItem: () => 'session' },
      localStorage: { getItem: () => null },
    },
    document: { title: 'Job', referrer: '' },
    setTimeout,
    clearTimeout,
    fetch: () => {
      requestStarted = true;
      return new Promise((resolve) => { finishRequest = resolve; });
    },
  });

  const tracking = api.trackProductEventBeforeNavigation({
    eventType: 'banner_click',
    properties: { banner_key: 'site_banner_test' },
  });
  assert.equal(requestStarted, true, 'the request must start before navigation can unmount the page');

  let trackingFinished = false;
  tracking.then(() => { trackingFinished = true; });
  await Promise.resolve();
  assert.equal(trackingFinished, false, 'navigation must wait while the request is still pending');

  finishRequest({ ok: true });
  await tracking;
  assert.equal(trackingFinished, true);
});

function toolHarness() {
  let cursor = 0;
  const slots = [];
  const events = [];
  let effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { return react.useState(() => ({ current: initial }))[0]; },
    useId: () => 'test-id',
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!(index in slots) || dependencies.some((value, i) => value !== slots[index][i])) effects.push(effect);
      slots[index] = dependencies;
    },
  };
  const jsx = (type, props) => ({ type, props });
  const components = load('features/ai-tools/components/AiJobToolsPage.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    'react-dom': { createPortal: value => value },
    '@/features/analytics/analytics.api': { trackJobToolEvent: (tool, action) => { events.push({ tool, action }); return Promise.resolve(); } },
    '@/features/home/home.api': { getCurrentUser: async () => ({ authenticated: false }) },
    '@/features/layout/components/AppChrome': {},
    '@/features/layout/components/ComingSoonAlert': {},
    './AiJobToolsPage.module.css': { default: {} },
  }, {}, '\nexport const testTools = { AiJobToolsPage, SalaryTool, TextTool, SeveranceTool, VacationTool, UnemploymentTool, GradeTool };').testTools;
  let tree;
  function render(name, props) {
    cursor = 0;
    effects = [];
    tree = components[name](props);
    effects.forEach(effect => effect());
  }
  function find(type, predicate = () => true) {
    function walk(node) {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) return node.map(walk).find(Boolean);
      if ((typeof node.type === 'function' ? node.type.name : node.type) === type && predicate(node.props)) return node.props;
      return walk(node.props?.children);
    }
    const result = walk(tree);
    assert.ok(result, `Missing ${type}`);
    return result;
  }
  return { events, render, find };
}

test('calculator handlers emit only after successful validation, including recalculation', () => {
  for (const [component, tool] of [['SalaryTool', 'salary'], ['SeveranceTool', 'severance'], ['VacationTool', 'vacation'], ['UnemploymentTool', 'unemployment']]) {
    const h = toolHarness();
    h.render(component);
    h.find('PrimaryButton').onClick();
    assert.equal(h.events.length, 0, `${tool}: empty input must not count as a calculation`);
    if (tool === 'salary') {
      h.find('MoneyField', p => p.label === '연봉').onChange('50000000');
    } else if (tool === 'vacation') {
      h.find('DateField').onChange('2020-01-01');
    } else {
      const date = h.find('DateRangeField');
      date.onStart('2020-01-01');
      date.onEnd('2025-01-01');
      if (tool === 'unemployment') h.find('BirthDateField').onChange('19900910');
      h.render(component);
      if (tool === 'severance') h.find('MonthPayRows').setBasePay('3000000');
      else h.find('PayLine').onChange('3000000');
    }
    h.render(component);
    h.find('PrimaryButton').onClick();
    assert.deepEqual(h.events, [{ tool, action: 'calculate' }]);
    h.render(component);
    h.find('PrimaryButton').onClick();
    assert.equal(h.events.length, 2);
  }
});

test('live text and grade tools count first real input, not every keystroke or initial empty render', () => {
  for (const [component, tool, input] of [['TextTool', 'text', 'textarea'], ['GradeTool', 'grade', 'input']]) {
    const h = toolHarness();
    h.render(component);
    assert.equal(h.events.length, 0);
    for (const value of ['', '3', '3.5']) {
      h.find(input).onChange({ target: { value } });
      h.render(component);
    }
    assert.deepEqual(h.events, [{ tool, action: 'use' }]);
    if (tool === 'grade') {
      h.find('PrimaryButton').onClick();
      assert.deepEqual(h.events.at(-1), { tool, action: 'calculate' });
    }
  }
});

test('direct tool entry and tab switches are logged without duplicate views on rerender', () => {
  const h = toolHarness();
  h.render('AiJobToolsPage', { initialTool: 'grade' });
  h.render('AiJobToolsPage', { initialTool: 'grade' });
  assert.deepEqual(h.events, [{ tool: 'grade', action: 'view' }]);
  h.find('button', props => props.children === '글자수세기').onClick();
  h.render('AiJobToolsPage', { initialTool: 'grade' });
  h.find('button', props => props.children === '글자수세기').onClick();
  h.render('AiJobToolsPage', { initialTool: 'grade' });
  assert.deepEqual(h.events, [{ tool: 'grade', action: 'view' }, { tool: 'text', action: 'view' }]);
});
