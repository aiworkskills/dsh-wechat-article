export type WorkflowId = 'article' | 'topics' | 'writing' | 'review' | 'formatting' | 'images' | 'publish'

export interface WorkflowDefinition {
  readonly id: WorkflowId
  readonly title: string
  readonly detail: string
  readonly skill: string
  readonly placeholder: string
}

export const WORKFLOWS: readonly WorkflowDefinition[] = [
  { id: 'article', title: '从主题成文', detail: '完整工作流', skill: 'aws-wechat-article-main', placeholder: '文章主题、目标读者或已有素材' },
  { id: 'topics', title: '生成选题', detail: '选题与标题', skill: 'aws-wechat-article-topics', placeholder: '领域、热点或内容方向' },
  { id: 'writing', title: '撰写正文', detail: '结构与表达', skill: 'aws-wechat-article-writing', placeholder: '主题、提纲或素材' },
  { id: 'review', title: '审稿优化', detail: '质量与 AI 味', skill: 'aws-wechat-article-review', placeholder: '稿件路径或审稿要求' },
  { id: 'formatting', title: '文章排版', detail: 'Markdown 转 HTML', skill: 'aws-wechat-article-formatting', placeholder: '稿件路径或排版要求' },
  { id: 'images', title: '生成配图', detail: '封面与正文图', skill: 'aws-wechat-article-images', placeholder: '稿件路径或配图方向' },
  { id: 'publish', title: '发布微信', detail: '草稿箱与发布', skill: 'aws-wechat-article-publish', placeholder: '待发布稿件路径' },
]

function clean(value: string): string {
  return value.trim()
}

function configurationUrl(input: string): string {
  const candidate = clean(input).match(/https:\/\/[^\s"'<>]+/u)?.[0]
    ?.replace(/[。，；、）》】]+$/u, '')
  if (candidate === undefined) throw new Error('请粘贴网站生成的 .aws 配置链接或完整配置指令')
  const url = new URL(candidate)
  const allowedHost = url.hostname === 'aiworkskills.cn' || url.hostname.endsWith('.aiworkskills.cn')
  if (!allowedHost || !url.pathname.toLowerCase().endsWith('.aws')) {
    throw new Error('只接受 aiworkskills.cn 生成的 HTTPS .aws 配置链接')
  }
  return url.href
}

export function configurationImportPrompt(input: string): string {
  const url = configurationUrl(input)
  return `/aws-wechat-article-assets 请导入这份微信公众号配置包：${url}\n导入完成后，请使用 aws-wechat-article-main 的原始 validate_env.py 校验当前项目，并完成首次预设目录初始化。校验通过前不要开始选题或创作。`
}

/** New articles always enter the upstream orchestration Skill, never a downstream step directly. */
export function startArticlePrompt(intent: string, product: string): string {
  const productLine = clean(product) === '' ? '' : `\n本篇明确涉及产品“${clean(product)}”。请按 Skill 规则读取该产品根目录资料，并优先将其图片库用于正文配图。`
  return `/aws-wechat-article-main 请新建一篇公众号文章。写作意图：${clean(intent)}。请按原 Skill 的顺序完成本篇准备、选题确认与后续工作流，不要跳过用户确认。${productLine}`
}

/** Resume from a verified article directory so the upstream Skill can inspect real artifacts. */
export function continueArticlePrompt(path: string): string {
  return `/aws-wechat-article-main 请继续处理文章目录“${clean(path)}”。请先读取 article.yaml 和现有中间产物，按原 Skill 的门禁判断应从哪个阶段恢复；不要假设流程已完成。`
}

export function productLibraryPrompt(product: string, image = false): string {
  const target = clean(product) === '' ? '产品资料库' : `产品“${clean(product)}”`
  return image
    ? `/aws-wechat-article-assets 请协助把我接下来提供的图片加入${target}。先确认产品归属、中文文件名和客观画面描述，再调用 Skill 自带的 product_image_ingest.py 入库。`
    : `/aws-wechat-article-assets 请协助把我接下来提供或确认的业务介绍整理并保存到${target}。请遵守 Skill 的产品资料入库确认流程。`
}

export function workflowPrompt(workflow: WorkflowDefinition, brief: string, product: string): string {
  const productLine = clean(product) === '' ? '' : `\n关联产品：${clean(product)}。请按 Skill 规则读取该产品的知识库和图片库。`
  const briefLine = clean(brief) === '' ? '请先询问完成此任务所需的关键信息。' : clean(brief)
  return `/${workflow.skill} ${briefLine}${productLine}`
}

export function listProductsPrompt(): string {
  return '/aws-wechat-article-assets 请列出当前项目的产品知识库，显示每个产品的资料和图片概况。'
}

export function searchProductPrompt(product: string, query: string): string {
  const productLine = clean(product) === '' ? '全部产品' : `产品“${clean(product)}”`
  const queryLine = clean(query) === '' ? '全部资料' : `与“${clean(query)}”相关的资料`
  return `/aws-wechat-article-assets 请检索当前项目中${productLine}的${queryLine}，列出可用于公众号创作的事实与来源文件。`
}

export function createProductArticlePrompt(product: string, topic: string): string {
  const productName = clean(product)
  const topicLine = clean(topic) === '' ? '请先根据产品资料提出选题' : clean(topic)
  return `/aws-wechat-article-main 请围绕${productName === '' ? '当前产品库' : `产品“${productName}”`}创作公众号文章。主题或要求：${topicLine}。请按 Skill 规则使用产品知识库，并优先从产品图片库选择正文配图。`
}

export function searchImagesPrompt(product: string, query: string): string {
  const productLine = clean(product) === '' ? '全部产品' : `产品“${clean(product)}”`
  const queryLine = clean(query) === '' ? '全部可用图片' : `与“${clean(query)}”相关的图片`
  return `/aws-wechat-article-assets 请检索当前项目中${productLine}的${queryLine}，返回图片路径和客观描述。产品图库图片只用于正文配图，不作为封面。`
}

export function ingestImagePrompt(product: string, sourcePath: string, description: string): string {
  const descriptionLine = clean(description) === ''
    ? '请先分析图片内容，生成客观的中文文件名和说明。'
    : `图片说明：${clean(description)}。请据此生成客观的中文文件名。`
  return `/aws-wechat-article-assets 请把本地图片“${clean(sourcePath)}”加入产品“${clean(product)}”的图片库。${descriptionLine}使用 Skill 自带的产品图片入库脚本完成复制、命名和同名 Markdown 说明文件。`
}
