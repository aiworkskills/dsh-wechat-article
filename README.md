# aws-wechat-article

## 这是什么

`aws-wechat-article` 是一个运行在 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 中的微信公众号创作插件。

安装后，你可以直接在 DeepSeek Harness 的对话中完成一篇公众号文章：

- 确定选题和标题
- 搜集、整理写作素材
- 撰写和修改文章
- 审稿与优化表达
- 生成公众号排版
- 生成封面和正文配图
- 发布到微信公众号草稿箱

整个过程仍然在对话中完成。插件在右侧增加了一个“公众号”工作台，帮助你查看文章定稿、排版文件和配图，也可以管理写作需要的产品资料与图片。

![从选题到发布的完整公众号工作流](docs/全自动完成文章从选题到发布.png)

它不是另一套公众号写作方法，而是把开源项目 [wechat-article-skills](https://github.com/aiworkskills/wechat-article-skills) 接入 DeepSeek Harness。文章如何选题、写作、审稿、排版、配图和发布，仍然由原版 Skill 决定。

> 当前版本是社区预览版，适配 DeepSeek Harness `0.1.1-rc.2`。

## 怎么安装

当前版本需要从源码安装。安装前请准备：

- DeepSeek Harness `0.1.1-rc.2`
- Node.js `22.19`，或者 Node.js 24 及更高版本
- pnpm 11
- git

由于 DeepSeek Harness 仍处于 RC 阶段，本插件目前和 Harness 源码一起安装。在 macOS 或 Linux 终端中复制并执行下面的完整命令：

```bash
set -e

mkdir -p "$HOME/code/aiworkskills"

if [ ! -d "$HOME/code/deepseek-harness/.git" ]; then
  git clone https://github.com/deepseek-ai/DeepSeek-Harness.git \
    "$HOME/code/deepseek-harness"
fi

if [ ! -d "$HOME/code/aiworkskills/dsh-plugin/.git" ]; then
  git clone https://github.com/aiworkskills/dsh-wechat-article.git \
    "$HOME/code/aiworkskills/dsh-plugin"
fi

cd "$HOME/code/deepseek-harness"
pnpm install
pnpm run build

cd "$HOME/code/aiworkskills/dsh-plugin"
pnpm install
pnpm build

cd "$HOME/code/deepseek-harness"
pnpm dsh plugin --profile web add "$HOME/code/aiworkskills/dsh-plugin"
pnpm dsh web --port 3081
```

打开 `http://127.0.0.1:3081/`。安装成功后，左侧栏底部会出现“公众号”，插件管理页中只会显示一个插件：`aws-wechat-article`。

### 插件加载在 Host 平面，不是 Agent Preset

上面的 `dsh plugin add` 会把插件写进 profile 的 `bundles`，也就是 Host 组合——这是它
唯一能工作的位置。托管部署自己拼装 profile 时同理，在 `cordis.patch.yml` 里 `insert`：

```yaml
- insert:
    - id: aws-wechat-article
      name: '@aiworkskills/aws-wechat-article'
```

**不要写进 Agent Preset 的 `agent.cordis.yml`。** 插件注册的是进程级 Cordis 服务
（`wechatArticleConfiguration`、`wechatProductLibrary`、`wechatSkillSource`），Harness
会拒绝挂载并报：

```
preset service must sit behind an `isolate` realm or move to the host composition
```

这条报错不会指出该放哪，照着「装插件」的直觉放进 Preset 很容易撞上。

### 换一个目录布局

上面的命令把两个仓库放在固定位置，是为了让复制粘贴就能跑通。这个布局不是必须的。

构建客户端界面时需要读取 Harness 源码里的构建预设（这部分没有随 npm 发布），默认按
`../../deepseek-harness` 查找。仓库放在别处时，用 `DSH_SOURCE_ROOT` 指明位置即可：

```bash
DSH_SOURCE_ROOT=/path/to/deepseek-harness pnpm build
```

容器构建、CI 以及把插件放进自有工作区的情况都适用。路径无效时构建会直接说明缺少什么，
而不是抛出一串类型错误。

### 使用预置的 Skill 检出

默认情况下，公众号 Skill 由插件 `git clone` 到 DSH_HOME 下，每个 DSH_HOME 各持一份。
单机单用户时这样最省事。

托管部署不适用这个默认值：那里每个用户都有独立的 DSH_HOME，于是每来一个新用户就要
重新 clone 一次 GitHub —— 既要求运行环境能访问外网，也让不同用户可能拿到不同版本的
Skill。这类部署预置一份共享检出，并用 `skillSourceDir` 指向它：

```yaml
- id: aws-wechat-article
  name: '@aiworkskills/aws-wechat-article'
  config:
    skillSourceDir: /opt/wechat-article-skills
```

Skill 版本随之固定，启动不再依赖网络。内网隔离环境、企业代理后，以及需要锁定 Skill
版本的场景同理。目录需要是一份完整的 Git 检出（保留 `.git`，「更新 Skill」才可用）。

### 换一个配置站

`configurationUrl` 指定工作台内嵌的配置站，默认 `https://aiworkskills.cn/config`：

```yaml
- id: aws-wechat-article
  name: '@aiworkskills/aws-wechat-article'
  config:
    configurationUrl: https://config.example.com/wechat
```

这一个值同时决定三件事：iframe 打开哪里、`postMessage` 只信任哪个来源、导入 `.aws`
配置包时允许来自哪个域（该域及其子域）。

> 早期版本里浏览器端把站点地址写死了，于是这个配置项只对 Host 侧生效——自建配置站的人
> 改了它，iframe 仍然指向原站，导入还会被一个自己从未配置过的域名拒绝。现在浏览器端从
> Host 读取，三处一致。

### 缩略图

工作台里的缩略图是二十几个像素见方，而喂给它们的原本是全尺寸原图 —— 一篇文章
六张配图就是 3 MB。现在 `?thumb=1` 会返回一张 96px 的 JPEG（实测 654 KB → 1.5 KB，
省 99.8%），在内存里按字节封顶缓存，缓存键含源文件 mtime，因而无需显式失效。

生成依赖 Python 与 Pillow（与图片入库工具同一个 `pythonCommand`）。**拿不到就发
原图** —— 缩略图是优化不是能力，没装 Pillow 的部署只是慢一点，不会少一块界面。

```yaml
config:
  thumbnailCacheBytes: 8388608   # 可选，默认 8 MiB
```

### 换一个工作台的名字

左边栏那一行默认叫「公众号」。把工作台嵌进更大的产品里时，账号身份往往已经由外面那一层
承载了，这一行于是该命名一件**事**：

```yaml
- id: aws-wechat-article
  name: '@aiworkskills/aws-wechat-article'
  config:
    workbenchLabel: 创作素材
```

留空即插件自己的名字。取不到时也照常显示默认名——这一项是称呼，不是能力。

### 托管部署：把工作台锁在一个工作集上

给每个工作集单独起 Runtime 的托管部署（例如一个用户名下的多个公众号各占一个工作区），
把该工作集的标识配成 `workspaceId`。插件会把它作为 `workspace` 参数拼进配置站地址：

```yaml
- id: aws-wechat-article
  name: '@aiworkskills/aws-wechat-article'
  config:
    # 标识由部署方的网关决定，从环境变量注入即可；插件不认识任何具体网关的变量名。
    workspaceId: !!js process.env.YOUR_GATEWAY_WORKSPACE_ID || ''
```


```text
https://config.example.com/wechat?embed=dsh&protocol=1&parentOrigin=…&workspace=<工作集 id>
```

对配置站而言这是一条约束：**当前工作区属于这个工作集**。配置站据此把自己锁在该工作集上，
而不是让用户在 iframe 里切到别的账号——否则用户切过去再点「应用配置」，另一个账号的设置
连同发布凭据就会被导入这个工作区。

本机单工作区安装不配这一项，也就不带这个参数，配置站行为与以往完全一致：在那里切换
账号正是选择「要配哪一个」的方式，去掉反而会把这条路堵死。

插件只陈述事实，怎么处置由配置站决定。

## 怎么使用

### 1. 打开一个公众号项目

在 DeepSeek Harness 中新建或打开一个会话，并选择一个本地文件夹作为工作区。这个文件夹将保存该项目的公众号配置、写作素材和文章文件。

点击左侧栏底部的“公众号”，右侧会打开公众号工作台。

### 2. 安装公众号写作 Skill

第一次打开时，点击“安装公众号写作 Skill”。

> 配置了 [`skillSourceDir`](#使用预置的-skill-检出) 的部署不会看到这一步：Skill 已经就位，
> 右上角直接显示“更新 Skill”。

插件会从 GitHub 安装 [aiworkskills/wechat-article-skills](https://github.com/aiworkskills/wechat-article-skills)。安装只需要完成一次，以后右上角会显示“更新 Skill”。

![安装公众号写作 Skill](docs/安装公众号运营skill.png)

Skill 没有打包在插件源码里。这样插件和 Skill 可以分别更新，你使用的也始终是公开仓库中的原版 Skill。

### 3. 完成公众号配置

安装 Skill 后，按照页面依次完成下面的公众号配置。

首先填写公众号定位、目标读者和默认作者，让智能体知道这个账号是谁、写给谁看。

![配置公众号定位和目标读者](docs/skill配置-公众号定位配置.png)

然后选择内容策略，确定常写的文章类型、标题方向和内容结构。

![配置公众号内容策略](docs/skill配置-内容策略配置.png)

接着填写写作规范，让生成的文章符合账号自己的语言习惯和内容要求。

![配置公众号写作规范](docs/skill配置-写作规范配置.png)

选择排版、封面和正文配图风格，确定文章最终的视觉效果。

![配置排版、封面和正文配图风格](docs/skill配置-排版风格-封面图配置.png)

最后根据需要配置微信公众号发布信息。完成后，文章可以直接进入微信草稿箱或继续执行发布流程。

![配置微信公众号自动发布](docs/skill配置-自动发布配置.png)

点击“保存并应用配置”后，配置会应用到当前项目。

以后需要调整时，可以点击右上角“技能配置”。悬停该按钮还可以选择在线配置、打开独立配置网站，或者直接打开本地配置文件夹。

### 4. 在对话中写文章

配置完成后，直接在主对话告诉智能体你想写什么，不需要在右侧工作台中点击“开始新文章”。

例如：

```text
写一篇介绍 DeepSeek Harness 插件体系的公众号文章，面向有 TypeScript
经验的开发者。先给我几个选题方向，确认后再继续写。
```

智能体会按照公众号 Skill 的流程推进，并在需要你做决定时停下来确认。中途退出后，也可以让它读取已有文章文件并继续处理。

### 5. 查看和修改文章文件

右侧“创作”页面按最近更新时间显示每篇文章。展开文章后，可以看到：

- Markdown 定稿或草稿
- HTML 排版文件
- 封面图片
- 正文配图

点击文件可以预览。点击文件右侧的引用按钮，可以把这份稿件或某一张图片放进主对话，然后针对它提出修改要求。

![查看文章定稿、排版和配图](docs/内容创作面板-清晰看到每篇文章的草稿与图片.png)

例如，引用一张正文配图后直接说：

```text
重新生成这张图片，保持原来的内容，但改成更简洁的科技媒体风格。
```

### 6. 管理写作素材

“写作素材”用于保存长期可复用的产品介绍、业务资料、案例和图片。

你可以创建多个内容方向，例如“公众号 Skills”“DeepSeek Harness”或某个具体产品。每个内容方向下面都可以上传文档和图片，也支持拖入文件、批量导入、预览、重命名和删除。

![管理文字资料和图片](docs/写作素材面板-素材文字与素材图片管理.png)

写文章时，只要告诉智能体使用哪个内容方向，它就会按照 Skill 的规则读取相关资料，并优先从对应图片中选择正文配图。

## 与开源生态的关系

这个项目由四个部分共同组成：

### DeepSeek Harness

[DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 提供对话、智能体执行、工具调用、文件操作和插件系统。`aws-wechat-article` 作为一个独立插件安装到 Harness，不需要修改 Harness 源码。

### aws-wechat-article 插件

本仓库负责把公众号能力接入 Harness，包括：

- 左侧“公众号”入口和右侧工作台
- Skill 的安装与更新
- 配置页面接入和配置状态检查
- 文章文件的浏览、预览和引用
- 写作素材的上传与管理
- 产品资料和图片能力与智能体的连接

插件只负责连接和使用体验，不重新定义公众号写作流程。

### wechat-article-skills

[aiworkskills/wechat-article-skills](https://github.com/aiworkskills/wechat-article-skills) 是公众号创作能力的核心，定义了从选题到发布的完整方法、规则和脚本。

Skill 通过 GitHub 单独安装，插件不会复制、修改或内置它的源码。用户可以独立更新 Skill，也可以在其他支持 Skills 的智能体工具中使用它。

### aiworkskills.cn 配置工具

[aiworkskills.cn/config](https://aiworkskills.cn/config) 用于生成和维护公众号 Skill 的配置。插件直接接入已经部署的配置网站，不在插件中复制一份配置系统。

这种分工让每一部分都可以独立演进：

```text
DeepSeek Harness
    └── aws-wechat-article 插件
            ├── 安装并调用 wechat-article-skills
            ├── 接入 aiworkskills.cn/config
            └── 读取当前项目的文章与写作素材
```

文章、配置和写作素材都保存在用户自己的项目目录中，插件不建立另一份云端资料库。

本插件和上游 Skill 均采用 [Apache License 2.0](LICENSE)。

- 使用讨论：[GitHub Discussions](https://github.com/aiworkskills/dsh-wechat-article/discussions)
- 缺陷与建议：[GitHub Issues](https://github.com/aiworkskills/dsh-wechat-article/issues)
- 安全问题：请通过仓库 Security 页面私下报告，不要创建公开 Issue
