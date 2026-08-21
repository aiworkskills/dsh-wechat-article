import { outOfTreeClientBundle } from './build/harness-tsdown-patch.ts'

export default outOfTreeClientBundle('@aiworkskills/aws-wechat-article', [
    'src/index.ts',
    'src/contracts.ts',
    'src/skills.ts',
    'src/library.ts',
    'src/configuration.ts',
    'src/configuration-route.ts',
    'src/tools.ts',
    'src/commands.ts',
  ])
