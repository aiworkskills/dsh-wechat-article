# dsh-wechat-article

面向 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 的公众号创作社区插件。项目将 [aiworkskills/wechat-article-skills](https://github.com/aiworkskills/wechat-article-skills) 的完整工作流接入 Harness，并提供原生会话工作台、产品知识库和产品图片库工具。

> 当前版本为早期社区预览版，精确适配 DeepSeek Harness `0.1.0-rc.5`。Harness 仍处于 RC 阶段，升级前请重新完成构建、测试和实际 profile 加载验证。

## 能力

- 原样打包并注册 9 个 `aws-wechat-*` Skill；插件不会修改上游 Skill。
- 在 Harness 左侧栏底部增加“公众号”入口，打开时临时接管原生右侧详情栏，不离开对话。
- 工作台顶部提供 [aiworkskills.cn](https://aiworkskills.cn/) 配置工具和开源仓库直达入口。
- 读取 `.aws-article/products/{产品名}/*.md` 产品知识文档。
- 读取 `.aws-article/products/{产品名}/images/` 图片及其同名 Markdown 描述。
- 调用 Skill 自带的 `product_image_ingest.py` 完成图片复制、中文命名、重名避让和说明文件生成。
- `/wechat-config` 直接返回已部署的 [aiworkskills.cn](https://aiworkskills.cn/) 配置工具，不在插件中复制网站配置界面。

## 插件结构

Bundle 在 `cordis.patch.yml` 中组合五个 Host 行，并通过 `dsh.client` 声明加载一个 Web Client 插件：

| 插件 | 职责 |
| --- | --- |
| `.` | Client 插件发现标记；Host 侧不执行其他逻辑 |
| `./skills` | 注册经过哈希校验的 9 个 Skill |
| `./library` | 产品知识库与图片库 Service |
| `./tools` | 面向模型的查询和图片入库工具 |
| `./commands` | `/wechat` 与 `/wechat-config` 人工入口 |
| `./client` | 左侧栏入口与原生右侧公众号工作台 |

知识库的事实来源始终是当前项目的 `.aws-article/products`。插件不建立另一份需要同步的数据库。

## 开发

要求 Node.js `^22.19.0 || >=24.0.0` 和 pnpm 11。Harness RC 包尚未全部发布到 npm，本仓库的开发依赖通过 `package.json` 中的相对 `link:` 路径连接到 DeepSeek Harness 源码；执行安装前请先准备对应版本的 Harness 源码目录。

```bash
pnpm install
pnpm sync:skills
pnpm check
```

默认从相邻目录 `../wechat-article-skills` 同步。也可以只对同步过程指定源目录：

```bash
WECHAT_ARTICLE_SKILLS_SOURCE=/absolute/path/to/wechat-article-skills pnpm sync:skills
```

`pnpm check:skills` 会同时验证源提交、整棵 Skill 目录哈希和每个 Skill 的哈希。同步操作只读取源仓库，所有写入都发生在本插件目录。

## 安装到 Harness

先构建，然后将当前包作为 Bundle 添加到目标 profile：

```bash
pnpm build
dsh plugin --profile <profile> add /absolute/path/to/dsh-wechat-article
```

## 在 Harness 中使用

1. 新建或打开一个以公众号项目目录为工作区的会话。
2. 点击左侧栏底部的“公众号”按钮，工作台会在 DSH 原生右侧栏打开；关闭后内置工具详情栏自动恢复。
3. 在“创作”中选择流程，填写要求后直接开始任务；需要产品信息时填写 `.aws-article/products` 下的产品目录名。
4. 在“产品资料”中列出或检索知识库，也可以直接发起产品文章创作。
5. 在“图片库”中按描述查找正文配图，或将本地图片加入指定产品图库。

工作台提交的是明确的 `/aws-wechat-*` Skill 调用。Skill 仍是业务规则的唯一来源，工作台不复制或改写其流程。

## 模型工具

- `wechat_products_list`：列出产品以及文档/图片数量。
- `wechat_product_documents`：按产品和关键词读取产品根目录的 Markdown。
- `wechat_product_images`：按产品和描述搜索正文配图候选。
- `wechat_product_image_ingest`：通过原 Skill 脚本将本地图片入库。

这些工具保留 Skill 的业务规则：通用资讯不主动读取产品库；新产品介绍仍须先征得用户确认，再由文件写入工具保存；产品图库图片只能优先用于正文配图，不能直接作为封面。

## 开源与上游

上游 Skill 由 AI Work Skills 以 Apache License 2.0 发布。本 Bundle 保留同一许可证、上游仓库地址和 Skill 快照哈希；`pnpm sync:skills` 只读取上游内容，插件不向源仓库写入文件。

## 社区

- 使用问题和经验交流：[GitHub Discussions](https://github.com/aiworkskills/dsh-wechat-article/discussions)
- 缺陷与功能建议：[GitHub Issues](https://github.com/aiworkskills/dsh-wechat-article/issues)
- 安全问题：请通过仓库 Security 页面私下报告，不要创建公开 Issue
- 许可证：[Apache License 2.0](LICENSE)

## 当前限制

- v0.1 面向 Harness 的本地执行世界，尚未适配远程/E2B 文件系统。
- 图片入库接受本地路径。将 Harness 会话附件直接物化后入库属于下一阶段。
- 产品资料和图片库的工作台操作通过当前会话提交给 Agent，再由插件的原生 Host 工具访问本地项目；当前版本尚未增加独立的 Host-to-Client 文件浏览 RPC。
