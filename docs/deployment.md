# 部署与配置

面向**部署方与运维**：把插件装进托管服务、接自己的配置站、锁定 Skill 版本、
改工作台的叫法。只想在本机用一下的读者不需要这一页，[README](../README.md) 就够了。

## 插件加载在 Host 平面，不是 Agent Preset

[README](../README.md#怎么安装) 里的 `dsh plugin add` 会把插件写进 profile 的 `bundles`，也就是 Host 组合——这是它
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

## 换一个目录布局

README 里的安装命令把两个仓库放在固定位置，是为了让复制粘贴就能跑通。这个布局不是必须的。

构建客户端界面时需要读取 Harness 源码里的构建预设（这部分没有随 npm 发布），默认按
`../../deepseek-harness` 查找。仓库放在别处时，用 `DSH_SOURCE_ROOT` 指明位置即可：

```bash
DSH_SOURCE_ROOT=/path/to/deepseek-harness pnpm build
```

容器构建、CI 以及把插件放进自有工作区的情况都适用。路径无效时构建会直接说明缺少什么，
而不是抛出一串类型错误。

## 使用预置的 Skill 检出

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

## 换一个配置站

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

## 缩略图

工作台里的缩略图是二十几个像素见方，而喂给它们的原本是全尺寸原图 —— 一篇文章
六张配图就是 3 MB。现在 `?thumb=1` 会返回一张 96px 的 JPEG（实测 654 KB → 1.5 KB，
省 99.8%），在内存里按字节封顶缓存，缓存键含源文件 mtime，因而无需显式失效。

生成依赖 Python 与 Pillow（与图片入库工具同一个 `pythonCommand`）。**拿不到就发
原图** —— 缩略图是优化不是能力，没装 Pillow 的部署只是慢一点，不会少一块界面。

```yaml
config:
  thumbnailCacheBytes: 8388608   # 可选，默认 8 MiB
```

## 换一个工作台的名字

左边栏那一行默认叫「公众号」。把工作台嵌进更大的产品里时，账号身份往往已经由外面那一层
承载了，这一行于是该命名一件**事**：

```yaml
- id: aws-wechat-article
  name: '@aiworkskills/aws-wechat-article'
  config:
    workbenchLabel: 创作素材
```

留空即插件自己的名字。取不到时也照常显示默认名——这一项是称呼，不是能力。

## 托管部署：把工作台锁在一个工作集上

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
