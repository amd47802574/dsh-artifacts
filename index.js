// dsh-artifacts - host half.
//
// Three authenticated JSON/binary routes for the browser half:
//
//   GET  /api/dsh-artifacts.list?path=...   -> one directory level under the root
//   GET  /api/dsh-artifacts.search?query=.. -> name search across the whole tree
//   GET  /api/dsh-artifacts.file?path=...   -> one file's bytes (previews / downloads)
//   POST /api/dsh-artifacts.action          -> open / reveal / rename / delete / mkdir
//
// The routes go through `ctx.connection.fetch` so they inherit the connection
// service's authentication and host/origin fence for free. The module imports
// nothing from the DSH SDK: `connection` is resolved through the cordis context
// at call time, so the plugin loads on any profile and reports a clear failure
// instead of breaking the boot when one is absent.
//
// Two confinement layers guard every filesystem request: the requested relative
// path must resolve inside the configured root (no `..`, absolute paths, other
// drives), and the fully-resolved real path - symlinks followed - must stay
// inside the root again, so a link planted in the tree cannot read past it.
import { readdir, lstat, stat, rm, rename, mkdir, readFile, realpath, readlink } from 'node:fs/promises'
import { existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join, resolve as resolvePath, sep, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'

/** Cordis plugin name. */
export const name = 'dsh-artifacts'

/** The connection service serves the routes; without it the plugin has nothing to register. */
export const inject = ['connection']

/** The user's deliverables folder, following the harness-wide rule for new artifacts. */

/** One listing never answers with more rows than this. */
const MAX_ENTRIES = 2000
/** One search answers with at most this many matches. */
const MAX_SEARCH_RESULTS = 200

/** A search never inspects more entries than this before giving up. */
const MAX_SEARCH_SCAN = 20000

/** A search never descends deeper than this many directory levels. */
const MAX_SEARCH_DEPTH = 12

/** The file route refuses to serve anything bigger than this. */
const MAX_FILE_BYTES = 128 * 1024 * 1024

/** How many entries get their stat in one parallel batch. */
const STAT_BATCH = 64

/** Extension -> content-type for the preview route. */
const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.sh': 'text/plain; charset=utf-8',
  '.bat': 'text/plain; charset=utf-8',
  '.cmd': 'text/plain; charset=utf-8',
  '.ps1': 'text/plain; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.java': 'text/plain; charset=utf-8',
  '.go': 'text/plain; charset=utf-8',
  '.rs': 'text/plain; charset=utf-8',
  '.c': 'text/plain; charset=utf-8',
  '.h': 'text/plain; charset=utf-8',
  '.cpp': 'text/plain; charset=utf-8',
  '.ini': 'text/plain; charset=utf-8',
  '.toml': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

class ArtifactsError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ArtifactsError'
    this.status = status
    this.code = code
  }
}

/** A JSON response. */
function json(body, status = 200) {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** A plain-JSON failure response. */
function fail(status, code, message) {
  return json({ ok: false, code, error: message }, status)
}

/** Turn a thrown value into a response without leaking a stack to the browser. */
function errorResponse(error) {
  if (error instanceof ArtifactsError) return fail(error.status, error.code, error.message)
  const message = error instanceof Error ? error.message : String(error)
  return fail(500, 'internal', message)
}

/** Map one Node fs error onto the closed business vocabulary. */
function mapFsError(error) {
  const code = error?.code
  if (code === 'ENOENT') return new ArtifactsError(404, 'not-found', 'the target does not exist')
  if (code === 'EEXIST') return new ArtifactsError(409, 'name-exists', 'an entry with this name already exists')
  if (code === 'EPERM' || code === 'EACCES') return new ArtifactsError(403, 'denied', 'the operating system refused the operation')
  if (code === 'EINVAL' || code === 'ENAMETOOLONG') return new ArtifactsError(400, 'invalid-name', 'the name is not valid on this filesystem')
  if (code === 'ENOTDIR') return new ArtifactsError(400, 'not-a-directory', 'the path is not a directory')
  if (code === 'EISDIR') return new ArtifactsError(400, 'is-a-directory', 'the path is a directory')
  return undefined
}

/** Re-throw through the business vocabulary, keeping ArtifactsError identity. */
function rethrowMapped(error) {
  if (error instanceof ArtifactsError) throw error
  const mapped = mapFsError(error)
  if (mapped !== undefined) throw mapped
  throw new ArtifactsError(500, 'internal', error instanceof Error ? error.message : String(error))
}

/**
 * Where the artifacts root comes from, and where it is.
 *
 * Priority: the row's `config.root` (set through the panel's settings dialog,
 * which persists via the config editor, or by hand in the patch layer), then
 * the `DSH_ARTIFACTS_ROOT` environment variable, then a per-user default below
 * the DSH home that is safe on every machine — never any author's own paths.
 */
function rootResolution(config) {
  const configured = config !== null && typeof config === 'object' && typeof config.root === 'string' && config.root.trim() !== ''
    ? config.root.trim()
    : undefined
  if (configured !== undefined) return { root: resolvePath(configured), source: 'config' }
  const fromEnv = process.env.DSH_ARTIFACTS_ROOT
  if (fromEnv !== undefined && fromEnv.trim() !== '') return { root: resolvePath(fromEnv.trim()), source: 'env' }
  return { root: join(homedir(), '.dsh', 'artifacts'), source: 'default' }
}

/** The configured root, falling back sensibly when the default is missing. */
function rootOf(config) {
  return rootResolution(config).root
}

/** Whether a path is fully qualified (absolute) on this platform. */
function isFullyQualified(candidate) {
  return /^[/\\]/u.test(candidate) || /^[a-zA-Z]:[/\\]/u.test(candidate)
}

/**
 * Persist a new artifacts root through the config editor — the documented way
 * for a plugin to change its own configuration. Returns the saved root.
 */
async function saveRoot(ctx, root) {
  const entry = ctx.fiber?.entry
  const editor = ctx.get('configEditor')
  if (entry === undefined || editor === undefined) {
    throw new ArtifactsError(500, 'config-editor-unavailable', 'configuration cannot be saved in this profile; set root in the patch layer instead')
  }
  const saved = await editor.edit(entry, (current) => ({ ...(current ?? {}), root }))
  return saved !== null && typeof saved === 'object' && typeof saved.root === 'string' && saved.root.trim() !== ''
    ? resolvePath(saved.root.trim())
    : root
}

/**
 * Resolve a request path against the root and refuse anything that escapes it.
 * @param root - the absolute root directory.
 * @param raw - the query's `path` value (`''` or absent = the root itself).
 * @returns the absolute, confined target path.
 */
function confinedPath(root, raw) {
  if (raw === null || raw === undefined || raw === '' || raw === '/') return root
  const cleaned = String(raw).replace(/^[a-zA-Z]:[\\/]/u, '').replace(/^[/\\]+/u, '')
  if (/^(?:\.\.(?:[/\\]|$))/u.test(cleaned)) throw new ArtifactsError(403, 'outside-root', 'path escapes the artifacts root')
  const target = resolvePath(root, cleaned)
  const rel = relativeInside(root, target)
  if (rel === undefined) throw new ArtifactsError(403, 'outside-root', 'path escapes the artifacts root')
  return target
}

/** The root-relative path, or undefined when the target is outside the root. */
function relativeInside(root, target) {
  const rootResolved = resolvePath(root)
  const candidate = resolvePath(target)
  if (candidate === rootResolved) return ''
  const rel = candidate.startsWith(rootResolved + sep) ? candidate.slice(rootResolved.length + 1) : undefined
  if (rel === undefined) return undefined
  if (rel === '' || rel.startsWith('..')) return rel === '' ? '' : undefined
  return rel
}

/**
 * The target's canonical real path, asserted to stay inside the root.
 *
 * Symlinks and Windows junctions are walked link by link: every hop's target
 * must resolve (string-level) inside the root before the walk continues, and
 * the final `realpath` canonicalizes the result. Node's own `realpath` answers
 * ENOENT for junctions, so the walk cannot just delegate to it.
 * The target must exist: a missing entry maps to `not-found`, never to its parent.
 */
async function ensureInsideReal(root, target) {
  const rootReal = await realpath(root)
  const insideOf = (candidate) => candidate === rootReal || candidate.startsWith(rootReal + sep)
  let current = resolvePath(target)
  let real
  for (let hops = 0; ; hops += 1) {
    let info
    try {
      info = await lstat(current)
    } catch (error) {
      rethrowMapped(error)
    }
    if (!info.isSymbolicLink()) {
      try {
        real = await realpath(current)
      } catch (error) {
        rethrowMapped(error)
      }
      break
    }
    if (hops >= 8) throw new ArtifactsError(403, 'outside-root', 'too many link levels')
    let link
    try {
      link = await readlink(current)
    } catch (error) {
      rethrowMapped(error)
    }
    current = resolvePath(dirname(current), link)
    if (!insideOf(current)) {
      throw new ArtifactsError(403, 'outside-root', 'the resolved path escapes the artifacts root')
    }
  }
  if (!insideOf(real)) {
    throw new ArtifactsError(403, 'outside-root', 'the resolved path escapes the artifacts root')
  }
  return real
}

/** Read the JSON body of a POST request. */
async function readJsonBody(request) {
  try {
    const text = await request.text()
    if (text.trim() === '') return {}
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ArtifactsError(400, 'invalid', 'the request body must be a JSON object')
    }
    return parsed
  } catch (error) {
    if (error instanceof ArtifactsError) throw error
    throw new ArtifactsError(400, 'invalid', 'the request body is not valid JSON')
  }
}

/** Stat one batch of dirents without following symlinks. */
async function statBatch(target, dirents) {
  return Promise.all(dirents.map(async (dirent) => {
    const row = {
      name: dirent.name,
      type: dirent.isDirectory() ? 'directory' : dirent.isSymbolicLink() ? 'symlink' : 'file',
      hidden: /^\./u.test(dirent.name),
    }
    try {
      const info = await lstat(join(target, dirent.name))
      row.size = info.isFile() ? info.size : undefined
      row.mtimeMs = info.mtimeMs
    } catch {
      row.mtimeMs = undefined
    }
    return row
  }))
}

/** Direct children of one directory, with sizes and mtimes, capped. */
async function listDirectory(root, target) {
  let dirents
  try {
    dirents = await readdir(target, { withFileTypes: true })
  } catch (error) {
    rethrowMapped(error)
  }
  const truncated = dirents.length > MAX_ENTRIES
  const rows = []
  for (let index = 0; index < dirents.length && index < MAX_ENTRIES; index += STAT_BATCH) {
    rows.push(...await statBatch(target, dirents.slice(index, index + STAT_BATCH)))
  }
  rows.sort((a, b) => {
    const aDir = a.type === 'directory'
    const bDir = b.type === 'directory'
    if (aDir !== bDir) return aDir ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true })
  })
  return {
    ok: true,
    root,
    parent: relativeInside(root, dirname(target)) ?? '',
    truncated,
    entries: rows,
  }
}

/** Serve one file's bytes with a content type the browser can preview. */
async function serveFile(root, target) {
  const real = await ensureInsideReal(root, target)
  let info
  try {
    info = await stat(real)
  } catch (error) {
    rethrowMapped(error)
  }
  if (!info.isFile()) throw new ArtifactsError(400, 'not-a-file', 'the path is not a file')
  if (info.size > MAX_FILE_BYTES) throw new ArtifactsError(413, 'too-large', 'the file is too large to preview here')
  const type = CONTENT_TYPES[extnameLower(real)] ?? 'application/octet-stream'
  const bytes = await readFile(real)
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': type,
      'content-length': String(bytes.byteLength),
      'cache-control': 'no-store',
    },
  })
}

/** Lower-cased extension of one path. */
function extnameLower(target) {
  const name = basename(target)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

/**
 * Case-insensitive name search across the whole tree.
 *
 * Directory symlinks and junctions are never followed (no loops, no escape);
 * the links themselves still match by name. Two hard caps keep a huge or
 * pathological tree from running away: one on inspected entries, one on the
 * number of answers, and either cut reports `truncated`.
 */
async function searchNames(root, rawQuery, limit) {
  const needle = String(rawQuery).trim().toLowerCase()
  const results = []
  let scanned = 0
  let truncated = false

  const record = async (dirent, childRel) => {
    let size
    let mtimeMs
    try {
      const info = await lstat(join(root, childRel))
      size = info.isFile() ? info.size : undefined
      mtimeMs = info.mtimeMs
    } catch {
      /* a vanished entry still matches; the metadata is best-effort */
    }
    results.push({
      name: dirent.name,
      path: childRel,
      type: dirent.isDirectory() ? 'directory' : dirent.isSymbolicLink() ? 'symlink' : 'file',
      size,
      mtimeMs,
      hidden: /^\./u.test(dirent.name),
    })
  }

  const walk = async (dir, rel, depth) => {
    if (truncated) return
    if (depth > MAX_SEARCH_DEPTH || scanned >= MAX_SEARCH_SCAN) {
      truncated = true
      return
    }
    let dirents
    try {
      dirents = await readdir(dir, { withFileTypes: true })
    } catch {
      return // an unreadable subtree is skipped, not fatal
    }
    for (const dirent of dirents) {
      if (results.length >= limit || scanned >= MAX_SEARCH_SCAN) {
        truncated = true
        return
      }
      scanned += 1
      const childRel = rel === '' ? dirent.name : `${rel}/${dirent.name}`
      const matches = dirent.name.toLowerCase().includes(needle)
      if (matches) await record(dirent, childRel)
      // Only real directories descend; symlinked ones are matched but not entered.
      if (dirent.isDirectory() && !dirent.isSymbolicLink()) {
        await walk(join(dir, dirent.name), childRel, depth + 1)
      }
    }
  }

  await walk(root, '', 0)
  return { ok: true, query: String(rawQuery), count: results.length, truncated, scanned, results }
}

/** Open one path with the OS default application, or reveal it in the file manager. */
function shellOpen(target, reveal) {
  if (process.platform === 'win32') {
    const args = reveal ? ['/select,', target] : [target]
    const child = spawn('explorer.exe', args, { detached: true, stdio: 'ignore' })
    child.on('error', () => { /* the OS opener is best-effort; never crash the host on a missing binary */ })
    child.unref()
    return
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open'
  const child = spawn(command, reveal ? [dirname(target)] : [target], { detached: true, stdio: 'ignore' })
  child.on('error', () => { /* best-effort, same as above */ })
  child.unref()
}

/** Windows-reserved characters and trailing dots/spaces that make a name unusable. */
const WINDOWS_RESERVED = /[<>:"|?*\u0000-\u001f]/u

/** Apply one management action from the browser half. */
async function applyAction(root, body) {
  const action = typeof body.action === 'string' ? body.action : ''
  const target = confinedPath(root, typeof body.path === 'string' ? body.path : '')
  switch (action) {
    case 'open': {
      const real = await ensureInsideReal(root, target)
      shellOpen(real, false)
      return { ok: true, action }
    }
    case 'reveal': {
      const real = await ensureInsideReal(root, target)
      shellOpen(real, true)
      return { ok: true, action }
    }
    case 'mkdir': {
      const name = sanitizeName(body.name)
      // The action creates one child INSIDE the confirmed directory itself.
      const parentReal = await ensureInsideReal(root, target)
      const created = join(parentReal, name)
      try {
        await mkdir(created, { recursive: false })
      } catch (error) {
        rethrowMapped(error)
      }
      return { ok: true, action, path: relativeInside(root, created) }
    }
    case 'rename': {
      const name = sanitizeName(body.name)
      const sourceReal = await ensureInsideReal(root, target)
      const to = join(dirname(sourceReal), name)
      if (to !== sourceReal) {
        try {
          await rename(sourceReal, to)
        } catch (error) {
          rethrowMapped(error)
        }
      }
      return { ok: true, action, path: relativeInside(root, to) }
    }
    case 'delete': {
      const real = await ensureInsideReal(root, target)
      try {
        await rm(real, { recursive: true, force: false })
      } catch (error) {
        rethrowMapped(error)
      }
      return { ok: true, action }
    }
    default:
      throw new ArtifactsError(400, 'unknown-action', `unknown action ${JSON.stringify(action)}`)
  }
}

/** One single path segment: no separators, not dot names, no reserved characters. */
function sanitizeName(value) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (name === '' || name === '.' || name === '..') throw new ArtifactsError(400, 'invalid-name', 'the name is required')
  if (/[/\\]/u.test(name)) throw new ArtifactsError(400, 'invalid-name', 'the name must be one path segment')
  if (WINDOWS_RESERVED.test(name) || /[. ]$/u.test(name)) {
    throw new ArtifactsError(400, 'invalid-name', 'the name uses characters this filesystem does not allow')
  }
  return name
}

/** Quick root sanity probe used for the health row in the list response. */
function rootReadable(root) {
  try {
    readdirSync(root)
    return true
  } catch {
    return false
  }
}

/** Install the plugin. */
export function apply(ctx, config = {}) {
  const connection = ctx.get('connection')
  if (connection === undefined || connection.fetch === undefined || typeof connection.fetch.register !== 'function') {
    throw new Error('dsh-artifacts: the connection service is required to serve the artifacts routes')
  }
  const { root, source } = rootResolution(config)
  // The auto default and the environment variable are ours to create; a
  // configured root is the user's own decision and a missing one must surface
  // as a visible error instead (a typo must not silently grow a folder).
  if ((source === 'default' || source === 'env') && !existsSync(root)) {
    try {
      mkdirSync(root, { recursive: true })
    } catch {
      /* the listing route reports the unreadable root with its path */
    }
  }

  const disposers = []
  const register = (route) => {
    const disposer = connection.fetch.register(route)
    if (typeof disposer === 'function') disposers.push(disposer)
  }
  ctx.effect(() => () => { for (const dispose of disposers.reverse()) dispose() }, 'dsh-artifacts: routes')

  register({
    path: '/api/dsh-artifacts.list',
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const url = new URL(request.url)
        if (!rootReadable(root)) {
          return fail(500, 'root-unreadable', `the artifacts root is not readable: ${root}`)
        }
        const target = confinedPath(root, url.searchParams.get('path'))
        const listing = await listDirectory(root, target)
        return json(listing)
      } catch (error) {
        return errorResponse(error)
      }
    },
  })

  register({
    path: '/api/dsh-artifacts.file',
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const url = new URL(request.url)
        const target = confinedPath(root, url.searchParams.get('path'))
        if (request.method === 'HEAD') {
          let info
          try {
            info = await stat(target)
          } catch {
            return new Response(null, { status: 404 })
          }
          return new Response(null, {
            status: 200,
            headers: {
              'content-type': CONTENT_TYPES[extnameLower(target)] ?? 'application/octet-stream',
              'content-length': String(info.size),
            },
          })
        }
        return await serveFile(root, target)
      } catch (error) {
        return errorResponse(error)
      }
    },
  })

  register({
    path: '/api/dsh-artifacts.search',
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const url = new URL(request.url)
        const query = url.searchParams.get('query') ?? ''
        if (query.trim() === '') return json({ ok: true, query, count: 0, truncated: false, results: [] })
        const requested = Number(url.searchParams.get('limit'))
        const limit = Number.isFinite(requested) && requested >= 1
          ? Math.min(Math.trunc(requested), MAX_SEARCH_RESULTS)
          : MAX_SEARCH_RESULTS
        if (!rootReadable(root)) {
          return fail(500, 'root-unreadable', `the artifacts root is not readable: ${root}`)
        }
        return json(await searchNames(root, query, limit))
      } catch (error) {
        return errorResponse(error)
      }
    },
  })

  register({
    path: '/api/dsh-artifacts.config',
    methods: ['GET', 'HEAD', 'POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        if (request.method === 'POST') {
          const body = await readJsonBody(request)
          const requested = typeof body.root === 'string' ? body.root.trim() : ''
          if (requested === '' || !isFullyQualified(requested)) {
            throw new ArtifactsError(400, 'invalid-root', 'the artifacts root must be a fully qualified absolute path')
          }
          const resolved = resolvePath(requested)
          if (!existsSync(resolved)) {
            try {
              mkdirSync(resolved, { recursive: true })
            } catch (error) {
              rethrowMapped(error)
            }
          }
          const saved = await saveRoot(ctx, resolved)
          return json({ ok: true, root: saved })
        }
        if (request.method === 'HEAD') return new Response(null, { status: 200 })
        return json({ ok: true, root, source, exists: existsSync(root) })
      } catch (error) {
        return errorResponse(error)
      }
    },
  })

  register({
    path: '/api/dsh-artifacts.action',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const body = await readJsonBody(request)
        return json(await applyAction(root, body))
      } catch (error) {
        return errorResponse(error)
      }
    },
  })
}
