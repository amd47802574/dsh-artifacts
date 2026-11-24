// Standalone smoke test for dsh-artifacts host logic (no cordis).
// Builds a fake connection service + ctx, calls apply(), and drives the routes.
// Run from anywhere: node test/host.mjs
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'

/** Read a small file back as utf8 for content assertions. */
const readBack = (path) => readFileSync(path, 'utf8')

const ROOT = join(import.meta.dirname, '..')
const TMP = join(ROOT, '_dsha_test_root')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(join(TMP, 'sub'), { recursive: true })
writeFileSync(join(TMP, 'hello.txt'), '你好，产物！')
writeFileSync(join(TMP, 'big.bin'), Buffer.alloc(2048, 7))
writeFileSync(join(TMP, 'sub', 'inner.md'), '# inner')
mkdirSync(join(TMP, '.hidden'), { recursive: true })

const routes = new Map()
/** Recorded by the fake config editor so tests can assert what was saved. */
let savedConfig = null
const fakeConnection = {
  fetch: {
    register(route) {
      routes.set(route.path, route)
      return () => routes.delete(route.path)
    },
  },
}
const fakeCtx = {
  get(key) {
    if (key === 'connection') return fakeConnection
    if (key === 'configEditor') {
      return { edit: async (_entry, mutate) => { savedConfig = mutate({ root: 'old-root' }); return savedConfig } }
    }
    return undefined
  },
  effect(_fn, _name) { /* registration disposal not exercised here */ },
  fiber: { entry: { id: 'dsh-artifacts' } },
}

process.env.DSH_ARTIFACTS_ROOT = TMP
const mod = await import(new URL('../index.js', import.meta.url).href)
mod.apply(fakeCtx, { root: TMP })

/** Drive one registered route like the connection service would. */
async function drive(path, request) {
  const route = routes.get(path.split('?')[0])
  if (route === undefined) throw new Error(`route not registered: ${path}`)
  const url = new URL(`http://local.test${path}`)
  return route.fetch(new Request(url, request))
}

let failures = 0
const check = (label, condition, extra = '') => {
  if (condition) console.log(`  ok  ${label}`)
  else { failures += 1; console.log(`FAIL  ${label} ${extra}`) }
}

// 1. list root
let res = await drive('/api/dsh-artifacts.list', { method: 'GET' })
let body = await res.json()
check('list root ok', body.ok === true, JSON.stringify(body).slice(0, 200))
check('list has hello.txt', body.entries.some((e) => e.name === 'hello.txt' && e.type === 'file' && e.size === 18))
check('dirs sort before files', body.entries.findIndex((e) => e.type === 'directory') < body.entries.findIndex((e) => e.type === 'file'))
check('list has hidden flag', body.entries.some((e) => e.name === '.hidden' && e.hidden === true))
check('parent of root is empty', body.parent === '')

// 2. list subdir via forward-slash rel path
res = await drive('/api/dsh-artifacts.list?path=sub', { method: 'GET' })
body = await res.json()
check('list subdir ok', body.ok === true && body.entries.some((e) => e.name === 'inner.md'))
check('subdir parent is root (empty)', body.parent === '')

// 3. traversal refused
res = await drive('/api/dsh-artifacts.list?path=..%2F..', { method: 'GET' })
body = await res.json()
check('traversal refused', res.status === 403 && body.ok === false, JSON.stringify(body))

// 4. absolute path outside refused
res = await drive(encodeURI('/api/dsh-artifacts.list?path=C:\\Windows'), { method: 'GET' })
body = await res.json()
check('absolute outside refused', res.status === 403 || res.status === 404, `status=${res.status}`)

// 5. serve file
res = await drive('/api/dsh-artifacts.file?path=hello.txt', { method: 'GET' })
const text = await res.text()
check('file served', res.status === 200 && text === '你好，产物！' && res.headers.get('content-type').includes('text/plain'))

// 6. serve missing file
res = await drive('/api/dsh-artifacts.file?path=nope.txt', { method: 'GET' })
check('missing file 404', res.status === 404)

// 7. mkdir + rename + delete
res = await drive('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'mkdir', path: '', name: '新建文件夹' }),
})
body = await res.json()
check('mkdir ok', body.ok === true && body.path === '新建文件夹', JSON.stringify(body))

res = await drive('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'rename', path: '新建文件夹', name: 'renamed-dir' }),
})
body = await res.json()
check('rename ok', body.ok === true && body.path === 'renamed-dir', JSON.stringify(body))

res = await drive('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'delete', path: 'renamed-dir' }),
})
body = await res.json()
check('delete dir ok', body.ok === true)

// 8. bad names refused
res = await drive('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'mkdir', path: '', name: 'a/b' }),
})
check('slash name refused', res.status === 400)

// 9. unknown action refused
res = await drive('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'format', path: '' }),
})
check('unknown action refused', res.status === 400)

// 10. file route confinement
res = await drive(encodeURI('/api/dsh-artifacts.file?path=..\\..\\package.json'), { method: 'GET' })
check('file traversal refused', res.status === 403)

// 11. code files preview as text
writeFileSync(join(TMP, 'script.py'), 'print("hi")')
res = await drive('/api/dsh-artifacts.file?path=script.py', { method: 'GET' })
check('py served as text', res.status === 200 && (await res.text()).includes('print') && res.headers.get('content-type').includes('text/plain'))

// 12. a symlink (junction) pointing outside must not serve outside bytes
const OUTSIDE = join(ROOT, '_dsha_outside_secret.txt')
writeFileSync(OUTSIDE, 'top secret')
try { rmSync(join(TMP, 'sneaky'), { force: true }) } catch {}
try {
  await (await import('node:fs/promises')).symlink(OUTSIDE, join(TMP, 'sneaky'), 'junction')
  res = await drive('/api/dsh-artifacts.file?path=sneaky', { method: 'GET' })
  body = res.status === 200 ? JSON.stringify(await res.json()).slice(0, 80) : ''
  check('symlink escape refused', res.status === 403, `status=${res.status} ${body}`)
} catch (error) {
  console.log(`  SKIP symlink test (${error.code ?? error.message})`)
}

// 13. windows-reserved names refused
for (const bad of ['a<b', 'x:', 'end.']) {
  res = await drive('/api/dsh-artifacts.action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'mkdir', path: '', name: bad }),
  })
  check(`reserved name refused: ${JSON.stringify(bad)}`, res.status === 400)
}

// 14. renaming a missing entry reports not-found, never touches the parent
res = await drive('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'rename', path: 'ghost-entry', name: 'moved' }),
})
check('rename missing -> 404', res.status === 404, `status=${res.status}`)

// 15. search finds nested names, case-insensitively, with root-relative paths
mkdirSync(join(TMP, '2026-01-01-项目'), { recursive: true })
writeFileSync(join(TMP, '2026-01-01-项目', '周报_Final.md'), '# 周报')
await (await import('node:fs/promises')).mkdir(join(TMP, 'deep', 'nested'), { recursive: true })
writeFileSync(join(TMP, 'deep', 'nested', 'REPORT-notes.txt'), 'x')
res = await drive('/api/dsh-artifacts.search?query=%E5%91%A8%E6%8A%A5', { method: 'GET' }) // 周报
body = await res.json()
check('search zh nested hit', body.ok === true && body.count === 1 && body.results[0].path === '2026-01-01-项目/周报_Final.md', JSON.stringify(body).slice(0, 240))
res = await drive('/api/dsh-artifacts.search?query=report', { method: 'GET' })
body = await res.json()
check('search case-insensitive', body.count === 1 && body.results[0].path === 'deep/nested/REPORT-notes.txt', JSON.stringify(body).slice(0, 240))
check('search carries size+mtime', body.results.every((r) => r.mtimeMs !== undefined))

// 16. search limit + truncated flag
res = await drive('/api/dsh-artifacts.search?query=e&limit=2', { method: 'GET' })
body = await res.json()
check('search limit respected', body.results.length <= 2, `count=${body.count}`)
check('search truncated flagged', body.truncated === true, `count=${body.count} truncated=${body.truncated}`)

// 17. empty query answers immediately
res = await drive('/api/dsh-artifacts.search?query=', { method: 'GET' })
body = await res.json()
check('empty query zero results', body.ok === true && body.count === 0)

// 18. symlinked directories are matched by name but never followed (no escape, no loops)
try {
  const fsp = await import('node:fs/promises')
  await fsp.symlink(OUTSIDE, join(TMP, 'link-out'), 'junction')
  await fsp.symlink(TMP, join(TMP, 'link-self'), 'junction') // self-loop
  res = await drive('/api/dsh-artifacts.search?query=link', { method: 'GET' })
  body = await res.json()
  check('symlink dirs matched once, not followed', body.count === 2 && body.truncated === false, JSON.stringify(body).slice(0, 200))
} catch (error) {
  console.log(`  SKIP symlink search test (${error.code ?? error.message})`)
}

// 19. config route: GET reports the resolved root; POST validates and persists
res = await drive('/api/dsh-artifacts.config', { method: 'GET' })
body = await res.json()
check('config GET', body.ok === true && body.root === TMP && body.source === 'config' && body.exists === true, JSON.stringify(body))

res = await drive('/api/dsh-artifacts.config', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ root: 'not-absolute' }),
})
check('relative root refused', res.status === 400 && (await res.json()).code === 'invalid-root')

const NEW_ROOT = join(ROOT, '_dsha_new_root_dir')
rmSync(NEW_ROOT, { recursive: true, force: true })
res = await drive('/api/dsh-artifacts.config', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ root: NEW_ROOT }),
})
body = await res.json()
check('absolute root accepted + dir created', body.ok === true && body.root === resolvePath(NEW_ROOT) && existsSync(NEW_ROOT), JSON.stringify(body))
check('config editor received the new root', savedConfig?.root === resolvePath(NEW_ROOT), JSON.stringify(savedConfig))

// 20. without the config editor the save fails with a clear business code
const ctxNoEditor = {
  get(key) { return key === 'connection' ? fakeConnection : undefined },
  effect() {},
  fiber: { entry: { id: 'x' } },
}
mod.apply(ctxNoEditor, { root: TMP })
// apply re-registers into the same map (same route paths) — serve via a second map instead:
const routes3 = new Map()
const conn3 = { fetch: { register: (r) => { routes3.set(r.path, r); return () => {} } } }
mod.apply({ get: (k) => (k === 'connection' ? conn3 : undefined), effect() {}, fiber: { entry: { id: 'x' } } }, { root: TMP })
res = await (routes3.get('/api/dsh-artifacts.config')).fetch(new Request(new URL('http://t/api/dsh-artifacts.config'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root: TMP }) }))
body = await res.json()
check('missing editor -> clear code', res.status === 500 && body.code === 'config-editor-unavailable', JSON.stringify(body))

// 21. the auto default is created when nothing is configured
const AUTO_ROOT = join(TMP, 'auto', 'deep')
process.env.DSH_ARTIFACTS_ROOT = AUTO_ROOT
const routes4 = new Map()
const conn4 = { fetch: { register: (r) => { routes4.set(r.path, r); return () => {} } } }
mod.apply({ get: (k) => (k === 'connection' ? conn4 : undefined), effect() {}, fiber: { entry: { id: 'x' } } }, {})
check('default root auto-created', existsSync(AUTO_ROOT), AUTO_ROOT)

// --- recycle bin -----------------------------------------------------------------

const drive2 = async (path, request) => {
  const route = routes.get(path.split('?')[0])
  if (route === undefined) throw new Error(`route not registered: ${path}`)
  return route.fetch(new Request(new URL(`http://local.test${path}`), request))
}
const BIN = join(TMP, '.dsh-artifacts-trash')

// 22. trash moves the entry out of sight and records where it came from
res = await drive2('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'trash', path: 'hello.txt' }),
})
body = await res.json()
check('trash ok', body.ok === true && body.originalRel === 'hello.txt', JSON.stringify(body))
check('entry left its spot', !existsSync(join(TMP, 'hello.txt')))
check('entry sits in bin', existsSync(join(BIN, body.trashName, 'hello.txt')))
res = await drive2('/api/dsh-artifacts.trash', { method: 'GET' })
body = await res.json()
check('bin lists with meta', body.ok === true && body.entries.length === 1
  && body.entries[0].originalRel === 'hello.txt' && typeof body.entries[0].deletedAt === 'number', JSON.stringify(body).slice(0, 240))
check('bin hidden from listing', (await (await drive2('/api/dsh-artifacts.list', { method: 'GET' })).json())
  .entries.every((e) => e.name !== '.dsh-artifacts-trash'))
check('bin hidden from search', (await (await drive2('/api/dsh-artifacts.search?query=trash', { method: 'GET' })).json()).count === 0)

// 23. binning something already in the bin is refused
const inBin = body.entries[0].name
res = await drive2('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'trash', path: `.dsh-artifacts-trash/${inBin}` }),
})
check('re-trash refused', res.status === 400 && (await res.json()).code === 'in-trash')

// 24. restore puts it back exactly where it came from
res = await drive2('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'restore', path: `.dsh-artifacts-trash/${inBin}` }),
})
body = await res.json()
check('restore ok', body.ok === true && body.path === 'hello.txt', JSON.stringify(body))
check('restored content intact', existsSync(join(TMP, 'hello.txt')) && readBack(join(TMP, 'hello.txt')) === '你好，产物！')
check('bin entry consumed', (await (await drive2('/api/dsh-artifacts.trash', { method: 'GET' })).json()).entries.length === 0)

// 25. restore onto a live file gains a numeric suffix, never overwrites
await drive2('/api/dsh-artifacts.action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'trash', path: 'hello.txt' }) })
let binNow = (await (await drive2('/api/dsh-artifacts.trash', { method: 'GET' })).json()).entries[0].name
// Recreate a live file at the exact origin: restoring must never overwrite it.
writeFileSync(join(TMP, 'hello.txt'), 'live version')
res = await drive2('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'restore', path: `.dsh-artifacts-trash/${binNow}` }),
})
body = await res.json()
check('collision restored with suffix', body.ok === true && body.path === 'hello (1).txt', JSON.stringify(body))
check('live file untouched', readBack(join(TMP, 'hello.txt')) === 'live version')
check('restored copy intact', readBack(join(TMP, 'hello (1).txt')) === '你好，产物！')

// 26. a forged origin pointing outside the root is refused on restore
binNow = (await (async () => {
  await drive2('/api/dsh-artifacts.action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'trash', path: 'hello (1).txt' }) })
  return (await (await drive2('/api/dsh-artifacts.trash', { method: 'GET' })).json()).entries[0].name
})())
const { writeFile: writeProm, readFile: readProm } = await import('node:fs/promises')
await writeProm(join(BIN, binNow, 'meta.json'), JSON.stringify({ originalRel: '../outside-secret', deletedAt: Date.now() }), 'utf8')
res = await drive2('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'restore', path: `.dsh-artifacts-trash/${binNow}` }),
})
check('forged origin refused', res.status === 403, `status=${res.status}`)

// 27. purge kills one entry permanently; empty-trash clears the rest
res = await drive2('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'purge', path: `.dsh-artifacts-trash/${binNow}` }),
})
check('purge ok', (await res.json()).ok === true)
await drive2('/api/dsh-artifacts.action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'trash', path: 'hello.txt' }) })
res = await drive2('/api/dsh-artifacts.action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'empty-trash', path: '' }),
})
check('empty-trash ok', (await res.json()).ok === true)
check('bin dir gone or empty', !existsSync(BIN) || (await (await drive2('/api/dsh-artifacts.trash', { method: 'GET' })).json()).entries.length === 0)

rmSync(TMP, { recursive: true, force: true })
rmSync(OUTSIDE, { force: true })
rmSync(NEW_ROOT, { recursive: true, force: true })
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
