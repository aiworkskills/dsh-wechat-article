import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CommandId, CommandRuntime } from '@deepseek-ai/dsh-commands'
import { describe, expect, it } from 'vitest'
import * as commandsPlugin from '../src/commands.js'

describe('wechat commands', () => {
  it('registers discovery commands that link to the deployed configuration site', async () => {
    const ctx = new Context()
    await ctx.plugin(CommandRuntime)
    await ctx.plugin(commandsPlugin)
    const agent = {} as Agent

    expect(ctx.commands.list(agent).map(command => command.name)).toEqual(['wechat', 'wechat-config'])
    const command = ctx.commands.find(agent, 'wechat-config')
    const result = await command?.handler({
      commandId: CommandId('test-command'),
      agent,
      rawInput: '',
      signal: new AbortController().signal,
    })
    expect(result).toEqual({ kind: 'success', text: 'https://aiworkskills.cn/config' })

    await ctx.fiber.dispose()
  })
})
