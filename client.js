// dsh-artifacts - browser half.
//
// Two registrations make the whole feature:
//
//   sidebar.panellist  -> the colorful launcher icon in the left sidebar
//   main (key: 'artifacts') -> the central panel shown when the launcher is picked
//
// The panel browses the 产物 root over the host half's authenticated routes:
// `.list` for directory levels, `.file` for previews, `.action` for management.
// Chrome styling uses only `--dsw-alias-*` theme tokens; the vivid gradients on
// cards are artwork and carry their own colors on purpose.
window.__ModuleLoader__.load({
  id: 'dsh-artifacts',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')
    const jsxRuntime = require('react/jsx-runtime')
    const { jsx, jsxs, Fragment } = jsxRuntime
    const { useState, useEffect, useCallback, useMemo, useRef } = react

    const NS = 'dsh-artifacts'
    const API = '/api/dsh-artifacts'
    const PANEL_ID = 'artifacts'
    const VIEW_KEY = 'dsh-artifacts:view'
    const SORT_KEY = 'dsh-artifacts:sort'

    // --- copy -----------------------------------------------------------------

    const zh = {
      'panel.label': '产物管家',
      'panel.title': '产物管家',
      'panel.subtitle': '浏览和管理 DSH 生成的产物',
      'panel.view': '视图',
      'view.card': '卡片',
      'view.list': '列表',
      'crumb.root': '产物',
      'action.refresh': '刷新',
      'action.up': '上一级',
      'action.mkdir': '新建文件夹',
      'action.open': '打开',
      'action.reveal': '在资源管理器中显示',
      'action.rename': '重命名',
      'action.delete': '删除',
      'action.preview': '预览',
      'action.retry': '重试',
      'action.cancel': '取消',
      'action.confirm': '确定',
      'action.download': '下载',
      'action.clearFilter': '清除筛选',
      'action.working': '处理中…',
      'action.openFolder': '打开所在文件夹',
      'filter.label': '搜索',
      'filter.placeholder': '搜索产物名…',
      'search.label': '搜索',
      'search.scope': '搜索整个产物库',
      'search.results': '{n} 个结果',
      'search.empty.title': '没有找到「{q}」',
      'search.empty.hint': '换个关键词试试；搜索覆盖产物库的全部子目录',
      'search.hint.truncated': '结果较多，仅显示前 {n} 条',
      'search.hint.scanned': '已扫描 {n} 项',
      'sort.label': '排序',
      'sort.mtime': '按时间',
      'sort.name': '按名称',
      'sort.size': '按大小',
      'stat.folders': '{n} 个文件夹',
      'stat.files': '{n} 个文件',
      'stat.size': '共 {size}',
      'empty.title': '这里还没有产物',
      'empty.hint': '让 DSH 帮你生成一份报告、一张图或一个网页，它们会出现在这里',
      'error.title': '加载失败',
      'hint.truncated': '条目过多，仅显示前 2000 项',
      'confirm.delete.title': '确认删除',
      'confirm.delete.body.file': '将永久删除文件「{name}」，此操作不可恢复。',
      'confirm.delete.body.dir': '将永久删除文件夹「{name}」及其全部内容，此操作不可恢复。',
      'rename.title': '重命名',
      'rename.label': '新名称',
      'mkdir.title': '新建文件夹',
      'mkdir.label': '文件夹名称',
      'preview.close': '关闭预览',
      'preview.textTooLarge': '文本过大，请用「打开」交给系统应用查看',
      'preview.notText': '该文件类型不支持文本预览，请用「打开」交给系统应用',
      'preview.loading': '正在读取…',
      'notice.renamed': '已重命名为 {name}',
      'notice.created': '已创建文件夹 {name}',
      'notice.deleted': '已删除 {name}',
      'notice.opened': '已调用系统打开',
      'notice.revealed': '已在资源管理器中显示',
      'error.invalid-name.local': '名称含有本机不允许的字符',
      'error.generic': '操作失败：{message}',
      'error.code.name-exists': '同名条目已存在',
      'error.code.not-found': '目标不存在（可能已被删除或移动）',
      'error.code.denied': '没有权限执行该操作',
      'error.code.invalid-name': '名称不合法',
      'error.code.outside-root': '路径越界，已拒绝',
      'error.code.not-a-directory': '目标不是文件夹',
      'error.code.not-a-file': '目标不是文件',
      'error.code.is-a-directory': '目标是文件夹',
      'error.code.too-large': '文件过大，无法在此预览',
      'error.code.unknown-action': '未知操作',
      'error.code.root-unreadable': '产物根目录无法读取，请检查配置的 root 路径',
    }

    const en = {
      'panel.label': 'Artifacts',
      'panel.title': 'Artifacts manager',
      'panel.subtitle': 'Browse and manage files DSH produced',
      'panel.view': 'View',
      'view.card': 'Cards',
      'view.list': 'List',
      'crumb.root': 'Artifacts',
      'action.refresh': 'Refresh',
      'action.up': 'Up one level',
      'action.mkdir': 'New folder',
      'action.open': 'Open',
      'action.reveal': 'Reveal in file manager',
      'action.rename': 'Rename',
      'action.delete': 'Delete',
      'action.preview': 'Preview',
      'action.retry': 'Retry',
      'action.cancel': 'Cancel',
      'action.confirm': 'Confirm',
      'action.download': 'Download',
      'action.clearFilter': 'Clear filter',
      'action.working': 'Working…',
      'action.openFolder': 'Open containing folder',
      'filter.label': 'Search',
      'filter.placeholder': 'Search artifact names…',
      'search.label': 'Search',
      'search.scope': 'Searching the whole artifacts library',
      'search.results': '{n} results',
      'search.empty.title': 'Nothing matches "{q}"',
      'search.empty.hint': 'Try another keyword; the search covers every subdirectory',
      'search.hint.truncated': 'Showing the first {n} matches',
      'search.hint.scanned': '{n} entries scanned',
      'sort.label': 'Sort',
      'sort.mtime': 'By time',
      'sort.name': 'By name',
      'sort.size': 'By size',
      'stat.folders': '{n} folders',
      'stat.files': '{n} files',
      'stat.size': '{size} total',
      'empty.title': 'No artifacts here yet',
      'empty.hint': 'Ask DSH for a report, an image, or a page — the output lands here',
      'error.title': 'Failed to load',
      'hint.truncated': 'Too many entries; showing the first 2000',
      'confirm.delete.title': 'Confirm deletion',
      'confirm.delete.body.file': 'The file "{name}" will be deleted permanently. This cannot be undone.',
      'confirm.delete.body.dir': 'The folder "{name}" and everything inside it will be deleted permanently. This cannot be undone.',
      'rename.title': 'Rename',
      'rename.label': 'New name',
      'mkdir.title': 'New folder',
      'mkdir.label': 'Folder name',
      'preview.close': 'Close preview',
      'preview.textTooLarge': 'The text is too large to preview here; use "Open" instead',
      'preview.notText': 'This file type has no text preview; use "Open" instead',
      'preview.loading': 'Reading…',
      'notice.renamed': 'Renamed to {name}',
      'notice.created': 'Folder {name} created',
      'notice.deleted': 'Deleted {name}',
      'notice.opened': 'Handed to the system',
      'notice.revealed': 'Shown in the file manager',
      'error.invalid-name.local': 'The name uses characters this machine does not allow',
      'error.generic': 'The operation failed: {message}',
      'error.code.name-exists': 'An entry with this name already exists',
      'error.code.not-found': 'The target no longer exists (deleted or moved)',
      'error.code.denied': 'The operating system refused this operation',
      'error.code.invalid-name': 'The name is not valid',
      'error.code.outside-root': 'The path escapes the artifacts root and was refused',
      'error.code.not-a-directory': 'The target is not a folder',
      'error.code.not-a-file': 'The target is not a file',
      'error.code.is-a-directory': 'The target is a folder',
      'error.code.too-large': 'The file is too large to preview here',
      'error.code.unknown-action': 'Unknown action',
      'error.code.root-unreadable': 'The artifacts root is not readable; check the configured root',
    }

    function interpolate(template, params) {
      return String(template).replace(/\{(\w+)\}/gu, (match, key) => (
        Object.prototype.hasOwnProperty.call(params ?? {}, key) ? String(params[key]) : match
      ))
    }

    // --- file kinds & artwork --------------------------------------------------

    const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'])
    const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mkv', '.mov', '.avi'])
    const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg'])
    const SHEET_EXTS = new Set(['.xlsx', '.xls', '.csv'])
    const SLIDE_EXTS = new Set(['.pptx', '.ppt'])
    const DOC_EXTS = new Set(['.doc', '.docx', '.txt', '.md', '.markdown', '.rtf', '.pages', '.log', '.ini', '.toml'])
    const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.json', '.html', '.htm', '.css', '.yml', '.yaml', '.sh', '.bat', '.cmd', '.ps1', '.xml', '.sql', '.java', '.go', '.rs', '.c', '.h', '.cpp'])
    const ARCHIVE_EXTS = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'])
    const PDF_EXTS = new Set(['.pdf'])
    const TEXT_PREVIEWABLE = new Set([...DOC_EXTS, ...CODE_EXTS])

    const KIND_ART = {
      directory: { emoji: '📁', glow: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', chip: '#f59e0b' },
      image: { emoji: '🖼️', glow: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', chip: '#8b5cf6' },
      video: { emoji: '🎬', glow: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)', chip: '#f43f5e' },
      audio: { emoji: '🎵', glow: 'linear-gradient(135deg, #f59e0b 0%, #fde047 100%)', chip: '#f59e0b' },
      pdf: { emoji: '📕', glow: 'linear-gradient(135deg, #dc2626 0%, #f472b6 100%)', chip: '#dc2626' },
      doc: { emoji: '📄', glow: 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)', chip: '#2563eb' },
      sheet: { emoji: '📊', glow: 'linear-gradient(135deg, #059669 0%, #14b8a6 100%)', chip: '#059669' },
      slide: { emoji: '📽️', glow: 'linear-gradient(135deg, #d946ef 0%, #8b5cf6 100%)', chip: '#d946ef' },
      code: { emoji: '💻', glow: 'linear-gradient(135deg, #0891b2 0%, #38bdf8 100%)', chip: '#0891b2' },
      archive: { emoji: '🗜️', glow: 'linear-gradient(135deg, #ea580c 0%, #facc15 100%)', chip: '#ea580c' },
      symlink: { emoji: '🔗', glow: 'linear-gradient(135deg, #64748b 0%, #a78bfa 100%)', chip: '#64748b' },
      other: { emoji: '📎', glow: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)', chip: '#64748b' },
    }

    /** The colorful kind one entry renders as. */
    function kindOf(entry) {
      if (entry.type === 'directory') return 'directory'
      if (entry.type === 'symlink') return 'symlink'
      const name = String(entry.name)
      const dot = name.lastIndexOf('.')
      const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
      if (IMAGE_EXTS.has(ext)) return 'image'
      if (VIDEO_EXTS.has(ext)) return 'video'
      if (AUDIO_EXTS.has(ext)) return 'audio'
      if (PDF_EXTS.has(ext)) return 'pdf'
      if (SHEET_EXTS.has(ext)) return 'sheet'
      if (SLIDE_EXTS.has(ext)) return 'slide'
      if (DOC_EXTS.has(ext)) return 'doc'
      if (CODE_EXTS.has(ext)) return 'code'
      if (ARCHIVE_EXTS.has(ext)) return 'archive'
      return 'other'
    }

    /** Whether clicking this file previews text instead of calling the OS. */
    function textPreviewable(entry, kind) {
      if (entry.type !== 'file') return false
      const dot = String(entry.name).lastIndexOf('.')
      const ext = dot > 0 ? String(entry.name).slice(dot).toLowerCase() : ''
      if (!TEXT_PREVIEWABLE.has(ext)) return false
      return entry.size === undefined || entry.size <= 1024 * 1024
    }

    /** Human size, one decimal below 10. */
    function formatSize(bytes) {
      if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes))) return '—'
      const value = Number(bytes)
      if (value < 1024) return `${value} B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
      if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`
      return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }

    /** Local `YYYY-MM-DD HH:mm` for one mtime. */
    function formatTime(ms) {
      if (ms === undefined || ms === null) return '—'
      const date = new Date(Number(ms))
      if (Number.isNaN(date.getTime())) return '—'
      const pad = (n) => String(n).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    // --- api -------------------------------------------------------------------

    async function fetchList(path) {
      const url = new URL(`${API}.list`, window.location.origin)
      if (path) url.searchParams.set('path', path)
      const response = await fetch(url, { method: 'GET' })
      const body = await response.json().catch(() => undefined)
      if (!response.ok || body?.ok !== true) {
        const error = new Error(body?.error ?? `HTTP ${response.status}`)
        error.code = body?.code
        throw error
      }
      return body
    }

    async function postAction(payload) {
      const response = await fetch(new URL(`${API}.action`, window.location.origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => undefined)
      if (!response.ok || body?.ok !== true) {
        const error = new Error(body?.error ?? `HTTP ${response.status}`)
        error.code = body?.code
        throw error
      }
      return body
    }

    /** The authenticated URL serving one file's bytes. */
    function fileUrl(path) {
      const url = new URL(`${API}.file`, window.location.origin)
      url.searchParams.set('path', path)
      return url.toString()
    }

    /** Fetch bounded text for the text preview; rejects with `not-text` for binary bodies. */
    async function fetchTextPreview(path, maxChars) {
      const response = await fetch(fileUrl(path), { method: 'GET' })
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`)
        error.kind = 'http'
        throw error
      }
      const type = response.headers.get('content-type') ?? ''
      if (!/text|json|xml|javascript|yaml|csv/u.test(type)) {
        const error = new Error('not-text')
        error.kind = 'not-text'
        throw error
      }
      const full = await response.text()
      return full.length > maxChars ? { text: full.slice(0, maxChars), truncated: true } : { text: full, truncated: false }
    }

    /** Name search across the whole artifacts tree. */
    async function fetchSearch(query, limit) {
      const url = new URL(`${API}.search`, window.location.origin)
      url.searchParams.set('query', query)
      if (limit !== undefined) url.searchParams.set('limit', String(limit))
      const response = await fetch(url, { method: 'GET' })
      const body = await response.json().catch(() => undefined)
      if (!response.ok || body?.ok !== true) {
        const error = new Error(body?.error ?? `HTTP ${response.status}`)
        error.code = body?.code
        throw error
      }
      return body
    }

    /** Windows-reserved characters a fresh name must not carry. */
    const NAME_INVALID = /[<>:"|?*\u0000-\u001f/\\]/u

    /** Client-side name check so typos fail fast with a localized message. */
    function validateName(name) {
      const trimmed = String(name ?? '').trim()
      if (trimmed === '' || trimmed === '.' || trimmed === '..') return 'error.code.invalid-name'
      if (NAME_INVALID.test(trimmed) || /[. ]$/u.test(trimmed)) return 'error.invalid-name.local'
      return undefined
    }

    // --- styles ------------------------------------------------------------------

    const STYLE = `
.dsha-root{position:relative;height:100%;min-height:0;width:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
.dsha-root *{box-sizing:border-box}
.dsha-header{display:flex;flex-direction:column;gap:8px;padding:14px 18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.dsha-title-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dsha-title{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;letter-spacing:.2px}
.dsha-title-mark{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#6366f1 0%,#ec4899 55%,#f59e0b 110%);display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(99,102,241,.35)}
.dsha-subtitle{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:400}
.dsha-header-actions{display:flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap}
.dsha-stats{color:var(--dsw-alias-label-tertiary);font-size:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.dsha-stat-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
.dsha-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s ease,border-color .15s ease,transform .1s ease;text-decoration:none}
.dsha-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsha-btn:active{transform:translateY(1px)}
.dsha-btn[disabled]{opacity:.5;cursor:default;pointer-events:none}
.dsha-btn-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:transparent}
.dsha-btn-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}
.dsha-btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:transparent;color:#fff}
.dsha-btn-primary:hover{filter:brightness(1.08);background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.dsha-segment{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.dsha-segment>button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:5px 12px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.dsha-segment>button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsha-segment>button[data-active=true]{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600}
.dsha-crumb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsha-crumbs{display:flex;align-items:center;gap:2px;flex-wrap:wrap;min-width:0;flex:1}
.dsha-crumb{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;padding:3px 8px;border-radius:6px;cursor:pointer;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsha-crumb:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsha-crumb[data-current=true]{color:var(--dsw-alias-label-primary);font-weight:600;background:var(--dsw-alias-bg-layer-2)}
.dsha-crumb-sep{color:var(--dsw-alias-label-tertiary);font-size:11px}
.dsha-filter{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 10px;font-size:12px;width:180px;outline:none}
.dsha-filter:focus{border-color:var(--dsw-alias-brand-primary)}
.dsha-select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 6px;font-size:12px;outline:none;cursor:pointer}
.dsha-body{flex:1;min-height:0;overflow:auto;padding:14px 18px 22px}
.dsha-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px}
.dsha-card{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;display:flex;flex-direction:column}
.dsha-card:hover,.dsha-card:focus-visible{transform:translateY(-2px);border-color:var(--dsw-alias-border-l2);box-shadow:0 8px 22px rgba(0,0,0,.14);outline:none}
.dsha-card-thumb{height:86px;display:flex;align-items:center;justify-content:center;font-size:34px;position:relative}
.dsha-card-thumb[data-kind=directory]{background:linear-gradient(135deg,rgba(245,158,11,.22),rgba(239,68,68,.16))}
.dsha-card-thumb[data-kind=image]{background:linear-gradient(135deg,rgba(139,92,246,.22),rgba(236,72,153,.18))}
.dsha-card-thumb[data-kind=video]{background:linear-gradient(135deg,rgba(244,63,94,.2),rgba(251,146,60,.16))}
.dsha-card-thumb[data-kind=audio]{background:linear-gradient(135deg,rgba(245,158,11,.22),rgba(253,224,71,.18))}
.dsha-card-thumb[data-kind=pdf]{background:linear-gradient(135deg,rgba(220,38,38,.2),rgba(244,114,182,.16))}
.dsha-card-thumb[data-kind=doc]{background:linear-gradient(135deg,rgba(37,99,235,.2),rgba(99,102,241,.18))}
.dsha-card-thumb[data-kind=sheet]{background:linear-gradient(135deg,rgba(5,150,105,.2),rgba(20,184,166,.16))}
.dsha-card-thumb[data-kind=slide]{background:linear-gradient(135deg,rgba(217,70,239,.2),rgba(139,92,246,.16))}
.dsha-card-thumb[data-kind=code]{background:linear-gradient(135deg,rgba(8,145,178,.2),rgba(56,189,248,.16))}
.dsha-card-thumb[data-kind=archive]{background:linear-gradient(135deg,rgba(234,88,12,.2),rgba(250,204,21,.14))}
.dsha-card-thumb[data-kind=symlink]{background:linear-gradient(135deg,rgba(100,116,139,.18),rgba(167,139,250,.16))}
.dsha-card-thumb[data-kind=other]{background:linear-gradient(135deg,rgba(100,116,139,.18),rgba(148,163,184,.14))}
.dsha-card-thumb-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dsha-card-thumb-glow{position:absolute;left:10px;top:10px;width:26px;height:26px;border-radius:8px;background:var(--dsha-glow);display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.18)}
.dsha-card-thumb[data-has-preview=true]>span{display:none}
.dsha-card-body{padding:8px 10px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}
.dsha-card-name{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsha-card-meta{display:flex;gap:8px;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dsha-card-meta .dsha-kind-dot{width:8px;height:8px;border-radius:50%;background:var(--dsha-chip);align-self:center;flex:none}
.dsha-card-actions{position:absolute;top:8px;right:8px;display:none;gap:4px}
.dsha-card:hover .dsha-card-actions,.dsha-card:focus-within .dsha-card-actions{display:flex}
.dsha-icon-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);border-radius:7px;width:24px;height:24px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}
.dsha-icon-btn:hover,.dsha-icon-btn:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsha-icon-btn[data-danger=true]:hover{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.dsha-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.dsha-row{display:grid;grid-template-columns:minmax(0,1fr) 92px 132px auto;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);cursor:pointer;transition:background .12s ease}
.dsha-row:last-child{border-bottom:0}
.dsha-row:hover,.dsha-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dsha-row-head{cursor:default;color:var(--dsw-alias-label-tertiary);font-size:11px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1)}
.dsha-row-head:hover{background:var(--dsw-alias-bg-layer-2)}
.dsha-row-name{display:flex;align-items:center;gap:9px;min-width:0}
.dsha-row-glyph{width:26px;height:26px;border-radius:8px;background:var(--dsha-glow);display:flex;align-items:center;justify-content:center;font-size:13px;flex:none;box-shadow:0 1px 4px rgba(0,0,0,.16)}
.dsha-row-title{display:flex;flex-direction:column;min-width:0}
.dsha-row-name-text{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsha-row-kind{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.dsha-row-num{font-size:11.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.dsha-row-actions{display:flex;gap:4px;opacity:.25;transition:opacity .12s ease}
.dsha-row:hover .dsha-row-actions,.dsha-row:focus-within .dsha-row-actions{opacity:1}
.dsha-search-path{max-width:320px;font-size:10.5px;padding:1px 6px;text-align:left}
.dsha-search-band{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.dsha-search-band .dsha-stat-pill{font-weight:600}
.dsha-entry-hidden{opacity:.68}
.dsha-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:64px 20px;text-align:center}
.dsha-empty-emoji{font-size:44px;filter:saturate(1.3)}
.dsha-empty-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dsha-empty-hint{font-size:12px;color:var(--dsw-alias-label-tertiary);max-width:340px}
.dsha-error{color:var(--dsw-alias-state-error-primary)}
.dsha-skeleton{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px}
.dsha-skeleton-card{height:136px;border-radius:14px;background:var(--dsw-alias-bg-skeleton);animation:dsha-pulse 1.2s ease-in-out infinite}
.dsha-skeleton-list{display:flex;flex-direction:column;gap:8px}
.dsha-skeleton-row{height:40px;border-radius:10px;background:var(--dsw-alias-bg-skeleton);animation:dsha-pulse 1.2s ease-in-out infinite}
@keyframes dsha-pulse{0%,100%{opacity:.55}50%{opacity:.9}}
.dsha-hint{color:var(--dsw-alias-label-tertiary);font-size:11px;margin-top:8px}
.dsha-overlay{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);display:flex;align-items:center;justify-content:center;z-index:80;padding:32px}
.dsha-overlay-panel{position:relative;max-width:min(1100px,92vw);max-height:88vh;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;padding:16px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
.dsha-preview-img{max-width:86vw;max-height:72vh;border-radius:10px;object-fit:contain;background:var(--dsw-alias-bg-layer-2)}
.dsha-preview-text{max-width:84vw;max-height:68vh;overflow:auto;border-radius:10px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);padding:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary);margin:0}
.dsha-preview-head{display:flex;align-items:center;gap:10px}
.dsha-preview-name{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsha-preview-actions{margin-left:auto;display:flex;gap:6px}
.dsha-modal-backdrop{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);display:flex;align-items:center;justify-content:center;z-index:90;padding:24px}
.dsha-modal{width:min(420px,92vw);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
.dsha-modal-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.dsha-modal-body{font-size:12.5px;color:var(--dsw-alias-label-secondary);word-break:break-word}
.dsha-modal-input{width:100%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 10px;font-size:13px;outline:none}
.dsha-modal-input:focus{border-color:var(--dsw-alias-brand-primary)}
.dsha-modal-actions{display:flex;justify-content:flex-end;gap:8px}
.dsha-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:var(--dsw-alias-toast-bg);color:var(--dsw-alias-toast-label);border-radius:10px;padding:7px 14px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:120;max-width:80%;white-space:normal;word-break:break-word}
.dsha-panel-icon-ring{display:block}
`

    // --- shared bits --------------------------------------------------------------

    function useEscape(enabled, onEscape) {
      useEffect(() => {
        if (!enabled) return undefined
        const handler = (event) => {
          if (event.key === 'Escape') onEscape()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
      }, [enabled, onEscape])
    }

    function Modal({ title, danger, onDismiss, autoFocusSelector, children }) {
      useEscape(true, onDismiss)
      const panelRef = useRef(null)
      useEffect(() => {
        const target = autoFocusSelector !== undefined ? panelRef.current?.querySelector(autoFocusSelector) : null
        target?.focus()
      }, [autoFocusSelector])
      return jsx('div', {
        className: 'dsha-modal-backdrop',
        onMouseDown: (event) => { if (event.target === event.currentTarget) onDismiss() },
        children: jsxs('div', {
          ref: panelRef,
          className: 'dsha-modal',
          role: 'dialog',
          'aria-modal': true,
          'aria-label': title,
          children: [
            jsxs('div', { className: 'dsha-modal-title', children: [danger ? '⚠️ ' : '', title] }),
            children,
          ],
        }),
      })
    }

    function NameFormModal({ title, label, initial, confirmLabel, onConfirm, onDismiss }) {
      const [value, setValue] = useState(initial)
      const [busy, setBusy] = useState(false)
      const inputRef = useRef(null)
      useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
      const submit = async () => {
        const trimmed = value.trim()
        if (trimmed === '' || busy) return
        setBusy(true)
        try {
          await onConfirm(trimmed)
        } finally {
          setBusy(false)
        }
      }
      return jsx(Modal, {
        title,
        onDismiss,
        children: jsxs(Fragment, {
          children: [
            jsx('input', {
              ref: inputRef,
              className: 'dsha-modal-input',
              value,
              placeholder: label,
              'aria-label': label,
              onChange: (event) => setValue(event.target.value),
              onKeyDown: (event) => { if (event.key === 'Enter') void submit() },
            }),
            jsxs('div', { className: 'dsha-modal-actions', children: [
              jsx('button', { className: 'dsha-btn', onClick: onDismiss, 'aria-label': '✕', children: '✕' }),
              jsx('button', { className: 'dsha-btn dsha-btn-primary', onClick: () => void submit(), disabled: busy, children: busy ? '…' : confirmLabel }),
            ] }),
          ],
        }),
      })
    }

    // --- entries -----------------------------------------------------------------

    function EntryActions({ entry, path, t, onPreview, onOpen, onReveal, onRename, onDelete }) {
      const kind = kindOf(entry)
      const child = path ? `${path}/${entry.name}` : entry.name
      const previewable = kind === 'image' || textPreviewable(entry, kind)
      return jsxs(Fragment, {
        children: [
          previewable && kind !== 'image' ? jsx('button', {
            className: 'dsha-icon-btn', title: t('action.preview'), 'aria-label': `${t('action.preview')}: ${entry.name}`,
            onClick: (event) => { event.stopPropagation(); onPreview(entry, child) },
            children: '👁',
          }) : null,
          jsx('button', {
            className: 'dsha-icon-btn', title: t('action.open'), 'aria-label': `${t('action.open')}: ${entry.name}`,
            onClick: (event) => { event.stopPropagation(); onOpen(entry, child) },
            children: '↗',
          }),
          jsx('button', {
            className: 'dsha-icon-btn', title: t('action.reveal'), 'aria-label': `${t('action.reveal')}: ${entry.name}`,
            onClick: (event) => { event.stopPropagation(); onReveal(entry, child) },
            children: '📂',
          }),
          jsx('button', {
            className: 'dsha-icon-btn', title: t('action.rename'), 'aria-label': `${t('action.rename')}: ${entry.name}`,
            onClick: (event) => { event.stopPropagation(); onRename(entry, child) },
            children: '✏️',
          }),
          jsx('button', {
            className: 'dsha-icon-btn', title: t('action.delete'), 'aria-label': `${t('action.delete')}: ${entry.name}`,
            onClick: (event) => { event.stopPropagation(); onDelete(entry, child) },
            children: '🗑',
          }),
        ],
      })
    }

    /** What one click/Enter activates for this entry. */
    function activate(entry, kind, { onNavigate, onPreview, onOpen }, child) {
      if (entry.type === 'directory') onNavigate(child)
      else if (kind === 'image' || textPreviewable(entry, kind)) onPreview(entry, child)
      else onOpen(entry, child)
    }

    function Card(props) {
      const { entry, path, t, onNavigate, onPreview, onOpen, onReveal, onRename, onDelete } = props
      const kind = kindOf(entry)
      const art = KIND_ART[kind]
      const child = path ? `${path}/${entry.name}` : entry.name
      const isImage = kind === 'image'
      return jsxs('div', {
        className: `dsha-card${entry.hidden ? ' dsha-entry-hidden' : ''}`,
        role: 'button',
        tabIndex: 0,
        'aria-label': `${entry.name} (${entry.type === 'directory' ? 'DIR' : formatSize(entry.size)})`,
        style: { '--dsha-glow': art.glow, '--dsha-chip': art.chip },
        onClick: () => activate(entry, kind, { onNavigate, onPreview, onOpen }, child),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(entry, kind, { onNavigate, onPreview, onOpen }, child)
          }
        },
        children: [
          jsxs('div', {
            className: 'dsha-card-thumb',
            'data-kind': kind,
            'data-has-preview': isImage ? 'true' : undefined,
            children: [
              isImage ? jsx('img', {
                className: 'dsha-card-thumb-preview',
                src: fileUrl(child),
                alt: '',
                loading: 'lazy',
              }) : null,
              jsx('span', { className: 'dsha-card-thumb-glow', style: { background: art.glow }, children: art.emoji }),
            ],
          }),
          jsxs('div', { className: 'dsha-card-body', children: [
            jsx('div', { className: 'dsha-card-name', title: entry.name, children: entry.name }),
            jsxs('div', { className: 'dsha-card-meta', children: [
              jsx('span', { className: 'dsha-kind-dot' }),
              jsx('span', { children: entry.type === 'directory' ? 'DIR' : formatSize(entry.size) }),
              jsx('span', { children: formatTime(entry.mtimeMs) }),
            ] }),
          ] }),
          jsx('div', {
            className: 'dsha-card-actions',
            onClick: (event) => event.stopPropagation(),
            onKeyDown: (event) => event.stopPropagation(),
            children: jsx(EntryActions, {
              entry, path, t,
              onPreview, onOpen, onReveal, onRename, onDelete,
            }),
          }),
        ],
      })
    }

    function ListRow(props) {
      const { entry, path, t, onNavigate, onPreview, onOpen, onReveal, onRename, onDelete } = props
      const kind = kindOf(entry)
      const art = KIND_ART[kind]
      const child = path ? `${path}/${entry.name}` : entry.name
      return jsxs('div', {
        className: `dsha-row${entry.hidden ? ' dsha-entry-hidden' : ''}`,
        role: 'button',
        tabIndex: 0,
        style: { '--dsha-glow': art.glow },
        onClick: () => activate(entry, kind, { onNavigate, onPreview, onOpen }, child),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(entry, kind, { onNavigate, onPreview, onOpen }, child)
          }
        },
        children: [
          jsxs('div', { className: 'dsha-row-name', children: [
            jsx('span', { className: 'dsha-row-glyph', style: { background: art.glow }, children: art.emoji }),
            jsxs('span', { className: 'dsha-row-title', children: [
              jsx('span', { className: 'dsha-row-name-text', title: entry.name, children: entry.name }),
              jsx('span', { className: 'dsha-row-kind', children: entry.type === 'directory' ? 'DIR' : entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.') + 1).toUpperCase() : '—' }),
            ] }),
          ] }),
          jsx('div', { className: 'dsha-row-num', children: entry.type === 'directory' ? '—' : formatSize(entry.size) }),
          jsx('div', { className: 'dsha-row-num', children: formatTime(entry.mtimeMs) }),
          jsx('div', {
            className: 'dsha-row-actions',
            onClick: (event) => event.stopPropagation(),
            onKeyDown: (event) => event.stopPropagation(),
            children: jsx(EntryActions, {
              entry, path, t,
              onPreview, onOpen, onReveal, onRename, onDelete,
            }),
          }),
        ],
      })
    }

        /** Split a root-relative entry path into its parent directory and name. */
    function splitPath(childPath) {
      const slash = childPath.lastIndexOf('/')
      return slash === -1
        ? { parent: '', name: childPath }
        : { parent: childPath.slice(0, slash), name: childPath.slice(slash + 1) }
    }

    /** One search hit: like a list row, plus the folder it lives in. */
    function SearchRow(props) {
      const { result, t, onNavigate, onPreview, onOpen, onReveal, onRename, onDelete } = props
      const entry = { name: result.name, type: result.type, size: result.size, mtimeMs: result.mtimeMs, hidden: result.hidden }
      const kind = kindOf(entry)
      const art = KIND_ART[kind]
      const { parent } = splitPath(result.path)
      return jsxs('div', {
        className: `dsha-row${entry.hidden ? ' dsha-entry-hidden' : ''}`,
        role: 'button',
        tabIndex: 0,
        style: { '--dsha-glow': art.glow },
        onClick: () => activate(entry, kind, { onNavigate, onPreview, onOpen }, result.path),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(entry, kind, { onNavigate, onPreview, onOpen }, result.path)
          }
        },
        children: [
          jsxs('div', { className: 'dsha-row-name', children: [
            jsx('span', { className: 'dsha-row-glyph', style: { background: art.glow }, children: art.emoji }),
            jsxs('span', { className: 'dsha-row-title', children: [
              jsx('span', { className: 'dsha-row-name-text', title: result.name, children: result.name }),
              jsx('button', {
                className: 'dsha-crumb dsha-search-path',
                title: parent === '' ? t('crumb.root') : parent,
                'aria-label': `${t('action.openFolder')}: ${result.name}`,
                onClick: (event) => { event.stopPropagation(); onNavigate(parent) },
                children: parent === '' ? `🏠 ${t('crumb.root')}` : parent,
              }),
            ] }),
          ] }),
          jsx('div', { className: 'dsha-row-num', children: entry.type === 'directory' ? '—' : formatSize(entry.size) }),
          jsx('div', { className: 'dsha-row-num', children: formatTime(entry.mtimeMs) }),
          jsx('div', {
            className: 'dsha-row-actions',
            onClick: (event) => event.stopPropagation(),
            onKeyDown: (event) => event.stopPropagation(),
            children: jsx(EntryActions, {
              entry, path: parent, t,
              onPreview, onOpen, onReveal, onRename, onDelete,
            }),
          }),
        ],
      })
    }

    // --- preview overlay -----------------------------------------------------------

    function PreviewOverlay({ preview, t, onOpenEntry, onDismiss }) {
      useEscape(true, onDismiss)
      const isImage = preview.kind === 'image'
      const [text, setText] = useState(null)
      const [error, setError] = useState(null)
      useEffect(() => {
        if (isImage) return undefined
        let alive = true
        setError(null)
        setText(null)
        fetchTextPreview(preview.path, 256 * 1024)
          .then((result) => { if (alive) setText(result) })
          .catch((cause) => { if (alive) setError(cause) })
        return () => { alive = false }
      }, [preview.path, isImage])
      return jsxs('div', {
        className: 'dsha-overlay',
        onMouseDown: (event) => { if (event.target === event.currentTarget) onDismiss() },
        children: [
          jsxs('div', { className: 'dsha-overlay-panel', role: 'dialog', 'aria-modal': true, 'aria-label': preview.name, children: [
            jsxs('div', { className: 'dsha-preview-head', children: [
              jsx('span', { children: isImage ? '🖼️' : '📄' }),
              jsx('span', { className: 'dsha-preview-name', title: preview.name, children: preview.name }),
              jsxs('div', { className: 'dsha-preview-actions', children: [
                jsx('button', { className: 'dsha-btn', onClick: () => onOpenEntry(preview.path), children: `↗ ${t('action.open')}` }),
                isImage ? jsx('a', {
                  className: 'dsha-btn', href: fileUrl(preview.path), download: preview.name,
                  children: `⬇ ${t('action.download')}`,
                }) : null,
                jsx('button', { className: 'dsha-btn dsha-btn-primary', onClick: onDismiss, children: `✕ ${t('preview.close')}` }),
              ] }),
            ] }),
            isImage
              ? jsx('img', { className: 'dsha-preview-img', src: fileUrl(preview.path), alt: preview.name })
              : jsxs(Fragment, {
                  children: [
                    error !== null ? jsx('div', {
                      className: 'dsha-empty-hint dsha-error',
                      children: error.kind === 'not-text'
                        ? t('preview.notText')
                        : error.kind === 'http' && error.message === 'HTTP 413'
                          ? t('error.code.too-large')
                          : interpolate(t('error.generic'), { message: error.message }),
                    }) : null,
                    error === null && text === null ? jsx('div', { className: 'dsha-empty-hint', children: t('preview.loading') }) : null,
                    text !== null ? jsx('pre', { className: 'dsha-preview-text', children: text.truncated ? `${text.text}\n…` : text.text }) : null,
                  ],
                }),
          ] }),
        ],
      })
    }

    // --- sidebar icon ----------------------------------------------------------------

    function PanelIcon(props) {
      const { size = 20, active } = props
      const gradId = useRef(`dsha-icon-grad-${Math.random().toString(36).slice(2, 9)}`)
      return jsxs('svg', {
        className: 'dsha-panel-icon-ring',
        viewBox: '0 0 48 48',
        width: size,
        height: size,
        'aria-hidden': true,
        style: { display: 'block' },
        children: [
          jsx('defs', {
            children: jsxs('linearGradient', {
              id: gradId.current,
              x1: '0', y1: '0', x2: '1', y2: '1',
              children: [
                jsx('stop', { offset: '0', stopColor: '#6366f1' }),
                jsx('stop', { offset: '0.55', stopColor: '#ec4899' }),
                jsx('stop', { offset: '1', stopColor: '#f59e0b' }),
              ],
            }),
          }),
          jsx('rect', {
            x: '2', y: '2', width: '44', height: '44', rx: '12',
            fill: `url(#${gradId.current})`,
            stroke: active === true ? 'rgba(255,255,255,0.85)' : 'none',
            strokeWidth: active === true ? 2.5 : 0,
          }),
          jsx('path', {
            d: 'M12 17.5a2.5 2.5 0 0 1 2.5-2.5h6l2.6 3h10.4a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5h-19a2.5 2.5 0 0 1-2.5-2.5z',
            fill: 'rgba(255,255,255,0.92)',
          }),
          jsx('circle', { cx: '17', cy: '35.5', r: '2.1', fill: '#fde047' }),
          jsx('circle', { cx: '24', cy: '35.5', r: '2.1', fill: '#34d399' }),
          jsx('circle', { cx: '31', cy: '35.5', r: '2.1', fill: '#38bdf8' }),
        ],
      })
    }

    // --- main panel -------------------------------------------------------------------

    function ArtifactsPanel(props) {
      const { t } = props
      const [path, setPath] = useState('')
      const [listing, setListing] = useState(null)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState(null)
      const [view, setView] = useState(() => {
        try { return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'card' } catch { return 'card' }
      })
      const [sortMode, setSortMode] = useState(() => {
        try {
          const stored = window.localStorage.getItem(SORT_KEY)
          return stored === 'name' || stored === 'size' ? stored : 'mtime'
        } catch { return 'mtime' }
      })
      const [filter, setFilter] = useState('')
      const [search, setSearch] = useState(null)
      const [searchLoading, setSearchLoading] = useState(false)
      const [searchError, setSearchError] = useState(null)
      const [preview, setPreview] = useState(null)
      const [dialog, setDialog] = useState(null)
      const [notice, setNotice] = useState(null)
      const noticeTimer = useRef(null)
      const pathRef = useRef('')
      const searchRef = useRef('')

      const showToast = useCallback((text) => {
        setNotice(text)
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
        noticeTimer.current = window.setTimeout(() => setNotice(null), 2600)
      }, [])
      useEffect(() => () => { if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current) }, [])

      /** One failed action reported in the user's language when the code is known. */
      const reportFailure = useCallback((cause) => {
        const code = cause?.code
        const localized = code !== undefined && code !== null ? t(`error.code.${code}`) : undefined
        const message = localized !== undefined && !localized.startsWith('error.code.')
          ? localized
          : interpolate(t('error.generic'), { message: cause instanceof Error ? cause.message : String(cause) })
        showToast(message)
      }, [t, showToast])

      const load = useCallback(async (target) => {
        setLoading(true)
        setError(null)
        pathRef.current = target
        try {
          const result = await fetchList(target)
          if (pathRef.current !== target) return
          setListing(result)
        } catch (cause) {
          if (pathRef.current !== target) return
          setListing(null)
          const code = cause?.code
          const localized = code !== undefined && code !== null ? t(`error.code.${code}`) : undefined
          setError(localized !== undefined && !localized.startsWith('error.code.')
            ? localized
            : cause instanceof Error ? cause.message : String(cause))
        } finally {
          if (pathRef.current === target) setLoading(false)
        }
      }, [t])

      useEffect(() => { void load('') }, [load])

      // The search box: debounced whole-tree name search, replacing the body
      // while a query is active; emptying it returns to the directory view.
      const searchActive = filter.trim() !== ''
      const runSearch = useCallback(async (query) => {
        searchRef.current = query
        if (query === '') {
          setSearch(null)
          setSearchError(null)
          setSearchLoading(false)
          return
        }
        setSearchLoading(true)
        setSearchError(null)
        try {
          const result = await fetchSearch(query, 200)
          if (searchRef.current !== query) return
          setSearch(result)
          setSearchLoading(false)
        } catch (cause) {
          if (searchRef.current !== query) return
          setSearch(null)
          setSearchError(cause instanceof Error ? cause.message : String(cause))
          setSearchLoading(false)
        }
      }, [])
      useEffect(() => {
        const query = filter.trim()
        const timer = window.setTimeout(() => { void runSearch(query) }, 350)
        return () => window.clearTimeout(timer)
      }, [filter, runSearch])

      const navigate = useCallback((target) => {
        setFilter('')
        setSearch(null)
        setPath(target)
        void load(target)
      }, [load])

      const changeView = useCallback((mode) => {
        setView(mode)
        try { window.localStorage.setItem(VIEW_KEY, mode) } catch { /* preference is best-effort */ }
      }, [])

      const changeSort = useCallback((mode) => {
        setSortMode(mode)
        try { window.localStorage.setItem(SORT_KEY, mode) } catch { /* preference is best-effort */ }
      }, [])

      const entries = useMemo(() => {
        const raw = listing?.entries ?? []
        const sorted = [...raw].sort((a, b) => {
          const aDir = a.type === 'directory'
          const bDir = b.type === 'directory'
          if (aDir !== bDir) return aDir ? -1 : 1
          if (sortMode === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true })
          if (sortMode === 'size') return (b.size ?? -1) - (a.size ?? -1)
          return (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0)
        })
        return sorted
      }, [listing, sortMode])

      const stats = useMemo(() => {
        let folders = 0
        let files = 0
        let bytes = 0
        for (const entry of entries) {
          if (entry.type === 'directory') folders += 1
          else { files += 1; bytes += Number(entry.size ?? 0) }
        }
        return { folders, files, bytes }
      }, [entries])

      const openEntry = useCallback(async (entry, child) => {
        try {
          await postAction({ action: 'open', path: child })
          showToast(t('notice.opened'))
        } catch (cause) {
          reportFailure(cause)
        }
      }, [t, showToast, reportFailure])

      const revealEntry = useCallback(async (entry, child) => {
        try {
          await postAction({ action: 'reveal', path: child })
          showToast(t('notice.revealed'))
        } catch (cause) {
          reportFailure(cause)
        }
      }, [t, showToast, reportFailure])

      const previewEntry = useCallback((entry, child) => {
        setPreview({ name: entry.name, path: child, kind: kindOf(entry) })
      }, [])

      const askRename = useCallback((entry, child) => {
        setDialog({ kind: 'rename', entry, path: child })
      }, [])

      const askDelete = useCallback((entry, child) => {
        setDialog({ kind: 'delete', entry, path: child })
      }, [])

      const askMkdir = useCallback(() => {
        setDialog({ kind: 'mkdir' })
      }, [])

      const dismissDialog = useCallback(() => setDialog(null), [])

      const confirmDialog = useCallback(async (value) => {
        const current = dialog
        if (current === null) return
        if (current.kind === 'rename' || current.kind === 'mkdir') {
          const invalid = validateName(value)
          if (invalid !== undefined) {
            showToast(t(invalid))
            return
          }
        }
        try {
          if (current.kind === 'rename') {
            await postAction({ action: 'rename', path: current.path, name: value })
            showToast(interpolate(t('notice.renamed'), { name: value }))
          } else if (current.kind === 'mkdir') {
            await postAction({ action: 'mkdir', path: pathRef.current, name: value })
            showToast(interpolate(t('notice.created'), { name: value }))
          } else if (current.kind === 'delete') {
            await postAction({ action: 'delete', path: current.path })
            showToast(interpolate(t('notice.deleted'), { name: current.entry.name }))
          }
          setDialog(null)
          if (searchRef.current !== '') void runSearch(searchRef.current)
          void load(pathRef.current)
        } catch (cause) {
          reportFailure(cause)
        }
      }, [dialog, t, showToast, reportFailure, load, runSearch])

      const crumbs = useMemo(() => {
        const parts = path === '' ? [] : path.split('/')
        const acc = []
        for (const part of parts) {
          acc.push({ name: part, path: acc.length === 0 ? part : `${acc[acc.length - 1].path}/${part}` })
        }
        return acc
      }, [path])

      const shared = { t, onNavigate: navigate, onPreview: previewEntry, onOpen: openEntry, onReveal: revealEntry, onRename: askRename, onDelete: askDelete }
      const parentTarget = listing?.parent ?? ''

      return jsxs('div', { className: 'dsha-root', children: [
        jsx('style', { children: STYLE }),
        jsxs('div', { className: 'dsha-header', children: [
          jsxs('div', { className: 'dsha-title-row', children: [
            jsx('span', { className: 'dsha-title-mark', children: '🗂️' }),
            jsxs('span', { className: 'dsha-title', children: [
              t('panel.title'),
              jsx('span', { className: 'dsha-subtitle', children: t('panel.subtitle') }),
            ] }),
            jsxs('div', { className: 'dsha-header-actions', children: [
              jsx('button', { className: 'dsha-btn', onClick: askMkdir, children: `📁 ${t('action.mkdir')}` }),
              jsx('button', { className: 'dsha-btn', onClick: () => void load(pathRef.current), disabled: loading, children: `⟳ ${t('action.refresh')}` }),
              jsx('div', { className: 'dsha-segment', role: 'group', 'aria-label': t('panel.view'), children: [
                jsx('button', { 'data-active': view === 'card', 'aria-pressed': view === 'card', onClick: () => changeView('card'), children: `🗂 ${t('view.card')}` }),
                jsx('button', { 'data-active': view === 'list', 'aria-pressed': view === 'list', onClick: () => changeView('list'), children: `📝 ${t('view.list')}` }),
              ] }),
            ] }),
          ] }),
          jsxs('div', { className: 'dsha-crumb-row', children: [
            jsx('button', {
              className: 'dsha-btn', onClick: () => navigate(parentTarget), disabled: path === '' || parentTarget === path,
              title: t('action.up'), 'aria-label': t('action.up'), children: '⬆',
            }),
            jsxs('div', { className: 'dsha-crumbs', children: [
              jsx('button', {
                className: 'dsha-crumb', 'data-current': path === '', onClick: () => navigate(''),
                children: `🏠 ${t('crumb.root')}`,
              }),
              crumbs.map((crumb) => jsxs(Fragment, { children: [
                jsx('span', { className: 'dsha-crumb-sep', children: '›' }),
                jsx('button', {
                  className: 'dsha-crumb', 'data-current': crumb.path === path, title: crumb.name,
                  onClick: () => navigate(crumb.path), children: crumb.name,
                }),
              ] }, crumb.path)),
            ] }),
            jsx('input', {
              className: 'dsha-filter', value: filter, placeholder: t('filter.placeholder'),
              'aria-label': t('filter.label'),
              onChange: (event) => setFilter(event.target.value),
            }),
            jsx('select', {
              className: 'dsha-select', value: sortMode, 'aria-label': t('sort.label'),
              onChange: (event) => changeSort(event.target.value),
              children: [
                jsx('option', { value: 'mtime', children: t('sort.mtime') }),
                jsx('option', { value: 'name', children: t('sort.name') }),
                jsx('option', { value: 'size', children: t('sort.size') }),
              ],
            }),
          ] }),
        ] }),
        jsxs('div', { className: 'dsha-body', children: [
          (() => {
            if (searchActive) {
              const query = filter.trim()
              if (searchLoading) {
                return jsx('div', { className: 'dsha-skeleton-list', children: [0, 1, 2, 3, 4, 5, 6].map((n) => jsx('div', { className: 'dsha-skeleton-row' }, n)) })
              }
              if (searchError !== null) {
                return jsxs('div', { className: 'dsha-state', children: [
                  jsx('div', { className: 'dsha-empty-emoji', children: '🧯' }),
                  jsx('div', { className: 'dsha-empty-title dsha-error', children: t('error.title') }),
                  jsx('div', { className: 'dsha-empty-hint', children: searchError }),
                  jsx('button', { className: 'dsha-btn dsha-btn-primary', onClick: () => void runSearch(query), children: `⟳ ${t('action.retry')}` }),
                ] })
              }
              const results = search?.results ?? []
              if (results.length === 0) {
                return jsxs('div', { className: 'dsha-state', children: [
                  jsx('div', { className: 'dsha-empty-emoji', children: '🔍' }),
                  jsx('div', { className: 'dsha-empty-title', children: interpolate(t('search.empty.title'), { q: query }) }),
                  jsx('div', { className: 'dsha-empty-hint', children: t('search.empty.hint') }),
                  jsx('button', { className: 'dsha-btn', onClick: () => setFilter(''), children: t('action.clearFilter') }),
                ] })
              }
              return jsxs(Fragment, {
                children: [
                  jsxs('div', { className: 'dsha-search-band', children: [
                    jsx('span', { className: 'dsha-stat-pill', children: `🔍 ${interpolate(t('search.results'), { n: search?.count ?? results.length })}` }),
                    jsx('span', { className: 'dsha-subtitle', children: t('search.scope') }),
                    search?.truncated === true ? jsx('span', { className: 'dsha-subtitle', children: `⚠️ ${interpolate(t('search.hint.truncated'), { n: 200 })}` }) : null,
                    jsx('button', { className: 'dsha-btn', style: { marginLeft: 'auto' }, onClick: () => setFilter(''), children: `${t('action.clearFilter')}「${query}」` }),
                  ] }),
                  view === 'card'
                    ? jsx('div', { className: 'dsha-grid', children: results.map((result) => {
                        const { parent, name } = splitPath(result.path)
                        return jsx(Card, {
                          entry: { name, type: result.type, size: result.size, mtimeMs: result.mtimeMs, hidden: result.hidden },
                          path: parent, ...shared,
                        }, result.path)
                      }) })
                    : jsx('div', { className: 'dsha-list', children: results.map((result) => jsx(SearchRow, { result, ...shared }, result.path)) }),
                ],
              })
            }
            if (loading) {
              return view === 'list'
                ? jsx('div', { className: 'dsha-skeleton-list', children: [0, 1, 2, 3, 4, 5, 6, 7].map((n) => jsx('div', { className: 'dsha-skeleton-row' }, n)) })
                : jsx('div', { className: 'dsha-skeleton', children: [0, 1, 2, 3, 4, 5, 6, 7].map((n) => jsx('div', { className: 'dsha-skeleton-card' }, n)) })
            }
            if (error !== null) {
              return jsxs('div', { className: 'dsha-state', children: [
                jsx('div', { className: 'dsha-empty-emoji', children: '🧯' }),
                jsx('div', { className: 'dsha-empty-title dsha-error', children: t('error.title') }),
                jsx('div', { className: 'dsha-empty-hint', children: error }),
                jsx('button', { className: 'dsha-btn dsha-btn-primary', onClick: () => void load(pathRef.current), children: `⟳ ${t('action.retry')}` }),
              ] })
            }
            if (entries.length === 0) {
              return jsxs('div', { className: 'dsha-state', children: [
                jsx('div', { className: 'dsha-empty-emoji', children: '🌈' }),
                jsx('div', { className: 'dsha-empty-title', children: t('empty.title') }),
                jsx('div', { className: 'dsha-empty-hint', children: t('empty.hint') }),
              ] })
            }
            return jsxs(Fragment, {
              children: [
                jsxs('div', { className: 'dsha-stats', style: { marginBottom: 12 }, children: [
                  jsx('span', { className: 'dsha-stat-pill', children: `📁 ${interpolate(t('stat.folders'), { n: stats.folders })}` }),
                  jsx('span', { className: 'dsha-stat-pill', children: `📄 ${interpolate(t('stat.files'), { n: stats.files })}` }),
                  stats.files > 0 ? jsx('span', { className: 'dsha-stat-pill', children: `⚖️ ${interpolate(t('stat.size'), { size: formatSize(stats.bytes) })}` }) : null,
                ] }),
                view === 'card'
                  ? jsx('div', { className: 'dsha-grid', children: entries.map((entry) => jsx(Card, { entry, path, ...shared }, entry.name)) })
                  : jsxs('div', { className: 'dsha-list', children: [
                      jsxs('div', { className: 'dsha-row dsha-row-head', children: [
                        jsx('div', { children: t('sort.name') }),
                        jsx('div', { children: t('sort.size') }),
                        jsx('div', { children: t('sort.mtime') }),
                        jsx('div', {}),
                      ] }),
                      entries.map((entry) => jsx(ListRow, { entry, path, ...shared }, entry.name)),
                    ] }),
                listing?.truncated === true ? jsx('div', { className: 'dsha-hint', children: `⚠️ ${t('hint.truncated')}` }) : null,
              ],
            })
          })(),
        ] }),
        preview !== null ? jsx(PreviewOverlay, {
          preview, t,
          onOpenEntry: (child) => { void openEntry(null, child) },
          onDismiss: () => setPreview(null),
        }) : null,
        dialog?.kind === 'rename' ? jsx(NameFormModal, {
          key: `rename:${dialog.path}`,
          title: `✏️ ${t('rename.title')}`, label: t('rename.label'), initial: dialog.entry.name,
          confirmLabel: t('action.confirm'), onConfirm: confirmDialog, onDismiss: dismissDialog,
        }) : null,
        dialog?.kind === 'mkdir' ? jsx(NameFormModal, {
          key: 'mkdir',
          title: `📁 ${t('mkdir.title')}`, label: t('mkdir.label'), initial: '',
          confirmLabel: t('action.confirm'), onConfirm: confirmDialog, onDismiss: dismissDialog,
        }) : null,
        dialog?.kind === 'delete' ? jsx(Modal, {
          title: `🗑 ${t('confirm.delete.title')}`, danger: true, onDismiss: dismissDialog,
          autoFocusSelector: '.dsha-btn-danger',
          children: jsxs(Fragment, {
            children: [
              jsx('div', { className: 'dsha-modal-body', children: interpolate(
                dialog.entry.type === 'directory' ? t('confirm.delete.body.dir') : t('confirm.delete.body.file'),
                { name: dialog.entry.name },
              ) }),
              jsxs('div', { className: 'dsha-modal-actions', children: [
                jsx('button', { className: 'dsha-btn', onClick: dismissDialog, children: t('action.cancel') }),
                jsx('button', { className: 'dsha-btn dsha-btn-danger', onClick: () => void confirmDialog(), children: `🗑 ${t('action.delete')}` }),
              ] }),
            ],
          }),
        }) : null,
        notice !== null ? jsx('div', { className: 'dsha-toast', role: 'status', children: notice }) : null,
      ] })
    }

    // --- apply ---------------------------------------------------------------------

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-artifacts: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 90,
        label: () => t('panel.label'),
        locale: NS,
      }, PanelIcon))

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, ArtifactsPanel))
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    exports.ArtifactsPanel = ArtifactsPanel
    exports.PanelIcon = PanelIcon
    return module.exports
  },
})
