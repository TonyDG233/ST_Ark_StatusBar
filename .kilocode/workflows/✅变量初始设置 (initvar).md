task: reappear an initial state of variables satisfying the zod schema of variables in <variable_schema> block, which is the main content of your reply
rule:
  - don't contain any comments
  - just list variables and their values, don't add any other text
format:
  <variable_schema> block not exists: |-
    disclaimer: 我不能生成变量初始设置，因为你还没有为我提供变量列表, 请将它包含在`<variable_schema>`...`</variable_schema>`中发送给我
  <variable_schema> block exists: |-
    <context>
    NOTE: 请在世界书中新建名为 `[initvar]` 的条目并关闭, 将代码块中的内容复制到该条目中
    ```yaml
    ${
      example: |-
        络络:
          亲密度: 0
          阅读日记数量: 0
          拥有联系方式: false
          物品栏: {}
        世界:
          当前日期: 2025-07-26
          当前星期: 星期五
          当前时间: 17:36
    }
    ```
    </context>