# dsh-artifacts · 产物管家

一个 DeepSeek Harness (DSH) 插件：在左侧栏新增「产物管家」入口，集中浏览和管理 DSH 生成的产物文件。

![preview](docs/preview.svg)

## 功能

- **左侧栏入口**：彩色渐变图标，点击进入中央面板
- **卡片 / 列表两种视图**：一键切换，选择本地记忆；卡片按文件类型着色，图片显示真实缩略图
- **全局搜索**：顶栏输入产物名（支持中文），跨全部子目录即时搜索；结果带所在文件夹，可一键跳转，同样支持预览与管理
- **目录浏览**：面包屑 + 上一级，跨层级自由跳转
- **排序与筛选**：按时间 / 名称 / 大小排序，即时筛选
- **统计条**：文件夹数、文件数、总大小
- **预览**：图片放大预览（可下载），文本类文件直接预览前 256 KB
- **管理**：打开（系统默认应用）、在资源管理器中显示、重命名、新建文件夹、删除（带确认）
- **中英双语**：全部界面文案走 DSH locale 服务

## 安装

本插件随 profile 安装（**Plugins** > Add plugin 指向本目录，或 `plugin_manager install_bundle`），安装后重启 DSH 即生效。

## 配置

产物根目录在 profile 的 `cordis.patch.yml` 插件行内配置：

```yaml
- insert:
    - id: dsh-artifacts
      name: 'dsh-artifacts'
      config:
        root: 'F:\desktop\草稿文件\dsh产物'
```

## 安全边界

- 所有文件请求被限制在配置的 `root` 之内，`..`、绝对路径、其他盘符一律 403
- 搜索不进入符号链接目录（不逃逸、不死循环），单次最多返回 200 条、最多扫描 20000 项
- 单层目录最多列出 2000 项；预览路由不服务超过 128 MB 的文件
- 删除为物理删除（文件夹递归），操作前有确认弹窗

## 结构

| 文件 | 说明 |
|---|---|
| `index.js` | Host 半：`.list` / `.file` / `.action` 三条经认证路由 |
| `client.js` | 浏览器半：`sidebar.panellist` 图标 + `main` 面板 |
| `locale/*.json` | 插件清单标题与描述（en / zh） |
| `icon.svg` | 插件图标 |
| `docs/DETAIL.md` | 插件详情页文档 |

## License

MIT
