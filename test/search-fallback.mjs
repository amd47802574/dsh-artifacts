// End-to-end test for the search fallback: load the real client.js in a fake
// browser shell (window + __ModuleLoader__ + stub react), shim `fetch` to
// serve the REAL host routes from index.js, and exercise the fallback walk.
// Run from anywhere: node test/search-fallback.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

const ROOT = join(import.meta.dirname, '..')
const TMP = join(ROOT, '_dsha_client_root')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(join(TMP, '模板库', '子目录'), { recursive: true })
writeFileSync(join(TMP, '模板库', 'PPT模板.pptx'), 'x')
writeFileSync(join(TMP, '模板库', '子目录', '报告模板.md'), '# 模板')
writeFileSync(join(TMP, '无关文件.txt'), 'hello')
mkdirSync(join(TMP, '无匹配目录'), { recursive: true })

// --- host routes served through the same harness as the host test -------------
const routes = new Map()
const fakeConnection = {
  fetch: { register: (route) => { routes.set(route.path, route); return () => {} } },
}
const fakeCtx = {
  get: (key) => (key === 'connection' ? fakeConnection : undefined),
  effect() {},
}
const host = await import(new URL('../index.js', import.meta.url).href)
host.apply(fakeCtx, { root: TMP })

async function serveRoute(pathWithQuery, method = 'GET') {
  const route = routes.get(pathWithQuery.split('?')[0])
  if (route === undefined) return new Response('not found', { status: 404 })
  return route.fetch(new Request(new URL(`http://local.test${pathWithQuery}`), { method }))
}

// --- fake browser shell ---------------------------------------------------------
const hooks = {
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (value) => ({ current: value }),
}
const fakeReact = hooks
const fakeJsx = {
  jsx: (type, props, key) => ({ type, props, key }),
  jsxs: (type, props, key) => ({ type, props, key }),
  Fragment: 'fragment',
}
let registration = null
globalThis.window = {
  location: { origin: 'http://local.test' },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout: (fn) => 0,
  clearTimeout: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  __ModuleLoader__: { load: (reg) => { registration = reg } },
}
const code = readFileSync(join(ROOT, 'client.js'), 'utf8')
new Function('window', 'require', code)(globalThis.window, (name) => {
  if (name === 'react') return fakeReact
  if (name === 'react/jsx-runtime') return fakeJsx
  throw new Error(`unexpected require: ${name}`)
})
if (registration === null) throw new Error('client.js did not register with __ModuleLoader__')
const client = registration.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react/jsx-runtime') return fakeJsx
  throw new Error(`unexpected require: ${name}`)
})
if (typeof client.fetchSearchByWalk !== 'function') throw new Error('fetchSearchByWalk not exported')

// Shim fetch: client URLs -> real route handlers.
globalThis.fetch = async (input) => {
  const url = new URL(String(input))
  return serveRoute(`${url.pathname}${url.search}`, 'GET')
}

let failures = 0
const check = (label, condition, extra = '') => {
  if (condition) console.log(`  ok  ${label}`)
  else { failures += 1; console.log(`FAIL  ${label} ${extra}`) }
}

// 1. The dedicated route IS registered here — the plain client search works.
const direct = await client.fetchSearch('模板', 200)
check('direct search hits .search route', direct.count === 3, JSON.stringify(direct).slice(0, 200))

// 2. Simulate the stale host (no .search route): the walk fallback finds the same set.
routes.delete('/api/dsh-artifacts.search')
const walked = await client.fetchSearchByWalk('模板', 200, () => false)
check('fallback finds all 模板 hits', walked.count === 3, JSON.stringify(walked).slice(0, 300))
check('fallback reports root-relative paths', walked.results.some((r) => r.path === '模板库/子目录/报告模板.md'))
check('fallback shape matches native', walked.ok === true && Array.isArray(walked.results) && typeof walked.count === 'number' && typeof walked.truncated === 'boolean')

// 3. Stale guard: a superseded query returns null instead of stale state.
const stale = await client.fetchSearchByWalk('模板', 200, () => true)
check('stale walk aborts to null', stale === null)

// 4. Truncation obeys the limit.
const limited = await client.fetchSearchByWalk('模板', 2, () => false)
check('fallback limit respected', limited.count === 2 && limited.truncated === true, JSON.stringify(limited).slice(0, 200))

// 5. No route at all (both gone): the walk reports the failure the panel shows.
routes.delete('/api/dsh-artifacts.list')
let threw = false
try { await client.fetchSearchByWalk('模板', 200, () => false) } catch { threw = true }
check('missing list route surfaces error', threw === true)

// 6. The hide-code predicate: scripts, caches and runner dirs hide; artifacts stay.
const isTransient = client.isTransientFile
check('py hides', isTransient({ name: 'run.py', type: 'file' }) === true)
check('sh hides', isTransient({ name: 'go.sh', type: 'file' }) === true)
check('pyc hides', isTransient({ name: 'run.pyc', type: 'file' }) === true)
check('tmp hides', isTransient({ name: 'scratch.tmp', type: 'file' }) === true)
check('__pycache__ hides', isTransient({ name: '__pycache__', type: 'directory' }) === true)
check('node_modules hides', isTransient({ name: 'node_modules', type: 'directory' }) === true)
check('md stays', isTransient({ name: '周报_Final.md', type: 'file' }) === false)
check('png stays', isTransient({ name: 'chart.png', type: 'file' }) === false)
check('xlsx stays', isTransient({ name: 'data.xlsx', type: 'file' }) === false)
check('normal dir stays', isTransient({ name: '2026-01-01-项目', type: 'directory' }) === false)

rmSync(TMP, { recursive: true, force: true })
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
