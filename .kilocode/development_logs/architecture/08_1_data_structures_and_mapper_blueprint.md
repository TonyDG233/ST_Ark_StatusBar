# 08_1 伪JS转向TypeScript的报错原生文档 (已修复)

在将 `any` 替换为 `unknown` 之后，本项目通过严格的 TypeScript 编译检查，暴露出 120 个类型错误，主要集中在直接操作酒馆宿主环境原生 API 数据结构（特别是 `WorldbookEntry` 和 `FlattenedWorldInfoEntry`）时的“幻觉”读写（即：在旧逻辑中由于被 `any` 或错误的数据映射欺骗，试图读写实际不存在于原始对象上的 `vectorized`, `constant`, `selective` 等根属性，或者直接修改原生数组引发引用问题）。

## 修复策略总结

1. **废弃虚构的桥接类型，回本溯源**
   不再发明中间桥接的 `ArkHybridWorldbookEntry` 概念，因为这是典型的画蛇添足。直接且严格地使用 `@types/function/worldbook.d.ts` 中定义的 `WorldbookEntry` 作为内部核心的防腐契约接口。

2. **转译层 (Mapper) 的正本清源**
   `worldbook_mapper.ts` 的作用被严格限制为：**将被动接收到的（如事件 `WORLDINFO_UPDATED` 返回的）底层 `FlattenedWorldInfoEntry` 数据，安全、单向地转译成本项目能够正常识别并渲染的标准的 `WorldbookEntry` 对象。** 不再尝试往原生对象里塞私货（或者通过扩展字段 `extra.comment` 去替代 `name` 的功能，直接读取原本就存在的 `name` 即可）。

3. **可选链操作符的合理运用**
   对于酒馆环境中允许 `undefined` 的字段（如 `e.extra?.comment`，尽管在最新修正中，不再鼓励用 `extra.comment` 来作为标识判定，而是统一回归 `name`），使用 `?.` 代替不安全和多余的强制类型断言，防止 `TypeError` 导致整个系统进程崩溃。

4. **回调事件的安全推导**
   对于原生事件如 `chat_completion_prompt_ready`、`world_info_activated` 回调携带的数据，我们不再用 `any` 或者 `unknown` 直接强制覆盖，而是在收到 `evt.detail` 后将其交给对应的 Mapper 转化后，再去执行业务判定。

5. **编译通过**
   上述调整完毕后，执行 `npx tsc --noEmit --skipLibCheck --project tsconfig.json` 返回 `Exit code: 0`。所有的运行时不确定性现在都被收敛到了安全的 TS 编译时检查之中。

---
下面是旧版（充满any时）残留并暴露的错误列表，仅作为历史归档保留以作警示：

(base) PS D:\LLM\self_programming\ST_Ark_StatusBar> npx tsc --noEmit --skipLibCheck --project tsconfig.json
src/ARK_STATUSBAR/components/global_tabs/shared_ui_state.ts:79:13 - error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.

79     eventOn(tavern_events.WORLDINFO_UPDATED as unknown, async (name: string) => {
               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/components/global_tabs/shared_ui_state.ts:84:13 - error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.

84     eventOn(tavern_events.WORLDINFO_ENTRIES_LOADED as unknown, async () => {
               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:33:9 - error TS2322: Type 'unknown[]' is not assignable to type 'ArkCommit[]'.
  Type 'unknown' is not assignable to type 'ArkCommit'.

33         commits: [...current.commits, commitData],
           ~~~~~~~

  src/ARK_STATUSBAR/types/system_config.ts:33:3
    33   commits: ArkCommit[]; // 操作历史记录（类似 Git commit）
         ~~~~~~~
    The expected type comes from property 'commits' which is declared here on type 'Partial<ArkConfig>'

src/ARK_STATUSBAR/core/config_store.ts:39:25 - error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Partial<ArkConfig>'.

39       this.updateConfig(partialConfig);
                           ~~~~~~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:57:24 - error TS7053: Element implicitly has an 'any' type because expression of type '"ark_statusbar_settings"' can't be used to index type '{}'.
  Property 'ark_statusbar_settings' does not exist on type '{}'.

57     if (extSettings && extSettings['ark_statusbar_settings']) {
                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:59:52 - error TS7053: Element implicitly has an 'any' type because expression of type '"ark_statusbar_settings"' can't be used to index type '{}'.
  Property 'ark_statusbar_settings' does not exist on type '{}'.

59         this.state.value = { ...DEFAULT_CONFIG, ...extSettings['ark_statusbar_settings'] };
                                                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:73:16 - error TS18046: 'e' is of type 'unknown'.

73               (e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) ||
                  ~

src/ARK_STATUSBAR/core/config_store.ts:73:26 - error TS18046: 'e' is of type 'unknown'.

73               (e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) ||
                            ~

src/ARK_STATUSBAR/core/config_store.ts:74:16 - error TS18046: 'e' is of type 'unknown'.

74               (e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
                  ~

src/ARK_STATUSBAR/core/config_store.ts:74:29 - error TS18046: 'e' is of type 'unknown'.

74               (e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
                               ~

src/ARK_STATUSBAR/core/config_store.ts:87:18 - error TS18046: 'anyEntry' is of type 'unknown'.

87                 (anyEntry.name && anyEntry.name.startsWith(CONFIG_ENTRY_PREFIX)) ||
                    ~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:87:35 - error TS18046: 'anyEntry' is of type 'unknown'.

87                 (anyEntry.name && anyEntry.name.startsWith(CONFIG_ENTRY_PREFIX)) ||
                                     ~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:88:18 - error TS18046: 'anyEntry' is of type 'unknown'.

88                 (anyEntry.comment && anyEntry.comment.startsWith(CONFIG_ENTRY_PREFIX))
                    ~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:88:38 - error TS18046: 'anyEntry' is of type 'unknown'.

88                 (anyEntry.comment && anyEntry.comment.startsWith(CONFIG_ENTRY_PREFIX))
                                        ~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:103:9 - error TS7053: Element implicitly has an 'any' type because expression of type '"ark_statusbar_settings"' can't be used to index type '{}'.
  Property 'ark_statusbar_settings' does not exist on type '{}'.

103         extSettings['ark_statusbar_settings'] = unref(this.state);
            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/core/config_store.ts:133:9 - error TS7053: Element implicitly has an 'any' type because expression of type '"ark_statusbar_settings"' can't be used to index type '{}'.
  Property 'ark_statusbar_settings' does not exist on type '{}'.

133         extSettings['ark_statusbar_settings'] = configVal;
            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/core/event_bus.ts:67:7 - error TS2322: Type 'unknown' is not assignable to type '{ "log:debug"?: ((message: string, isDryRun?: boolean | undefined) => void)[] | undefined; "interceptor:token_calculated"?: ((data: { chatTurnsCount: number; realTimePassedMs: number; }) => void)[] | undefined; "history:commit_added"?: ((commitData: unknown) => void)[] | undefined; "config:interceptor_state_changed"...'.
  Type 'unknown' is not assignable to type '(((message: string, isDryRun?: boolean | undefined) => void)[] & ((data: { chatTurnsCount: number; realTimePassedMs: number; }) => void)[] & ((commitData: unknown) => void)[] & ((shouldEnable: boolean) => void)[] & ((partialConfig: unknown) => void)[] & ((worldbookName: string) => void)[]) | undefined'.

67       this.listeners[event] = callbacks.filter(cb => cb !== callback) as unknown;
         ~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/core/event_bus.ts:79:11 - error TS2571: Object is of type 'unknown'.

79           (cb as unknown)(...args);
             ~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/index.ts:103:12 - error TS2571: Object is of type 'unknown'.

103     typeof (window.parent as unknown).appendInexistentScriptButtons === 'function' ||
               ~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/index.ts:104:12 - error TS2571: Object is of type 'unknown'.

104     typeof (window as unknown).appendInexistentScriptButtons === 'function'
               ~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/index.ts:107:7 - error TS2571: Object is of type 'unknown'.

107       (window.parent as unknown).appendInexistentScriptButtons || (window as unknown).appendInexistentScriptButtons;
          ~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/index.ts:107:67 - error TS2571: Object is of type 'unknown'.

107       (window.parent as unknown).appendInexistentScriptButtons || (window as unknown).appendInexistentScriptButtons;
                                                                      ~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/index.ts:108:24 - error TS2571: Object is of type 'unknown'.

108     const getEventFn = (window.parent as unknown).getButtonEvent || (window as unknown).getButtonEvent;
                           ~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/index.ts:108:69 - error TS2571: Object is of type 'unknown'.

108     const getEventFn = (window.parent as unknown).getButtonEvent || (window as unknown).getButtonEvent;
                                                                        ~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/index.ts:109:27 - error TS2571: Object is of type 'unknown'.

109     const globalEventOn = (window.parent as unknown).eventOn || (window as unknown).eventOn;
                              ~~~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/index.ts:109:65 - error TS2571: Object is of type 'unknown'.

109     const globalEventOn = (window.parent as unknown).eventOn || (window as unknown).eventOn;
                                                                    ~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/statusbar_manager.ts:172:53 - error TS18046: 'e' is of type 'unknown'.

172                   const entry = wbEntries.find(e => e.uid === uid);
                                                        ~

src/ARK_STATUSBAR/logic/statusbar_manager.ts:174:27 - error TS2339: Property 'enabled' does not exist on type '{}'.

174                     entry.enabled = true;
                              ~~~~~~~

src/ARK_STATUSBAR/logic/statusbar_manager.ts:260:52 - error TS18046: 'e' is of type 'unknown'.

260         const entry = entries.find((e: unknown) => e.name === key || e.comment === key);
                                                       ~

src/ARK_STATUSBAR/logic/statusbar_manager.ts:260:70 - error TS18046: 'e' is of type 'unknown'.

260         const entry = entries.find((e: unknown) => e.name === key || e.comment === key);
                                                                         ~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82:15 - error TS18046: 'entry' is of type 'unknown'.

82           if (entry.name && BASELINE_STATE.hasOwnProperty(entry.name)) {
                 ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82:59 - error TS18046: 'entry' is of type 'unknown'.

82           if (entry.name && BASELINE_STATE.hasOwnProperty(entry.name)) {
                                                             ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:83:45 - error TS18046: 'entry' is of type 'unknown'.

83             const baseline = BASELINE_STATE[entry.name];
                                               ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:84:13 - error TS18046: 'entry' is of type 'unknown'.

84             entry.enabled = baseline.enabled;
               ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:86:18 - error TS18046: 'entry' is of type 'unknown'.

86             if (!entry.strategy) {
                    ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:87:15 - error TS18046: 'entry' is of type 'unknown'.

87               entry.strategy = {};
                 ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:89:13 - error TS18046: 'entry' is of type 'unknown'.

89             entry.strategy.type = baseline.type;
               ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:90:13 - error TS18046: 'entry' is of type 'unknown'.

90             entry.constant = baseline.type === 'constant';
               ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:115:52 - error TS18046: 'e' is of type 'unknown'.

115         const entry = entries.find((e: unknown) => e.name === key);
                                                       ~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:156:15 - error TS18046: 'entry' is of type 'unknown'.

156           if (entry.name && SINGLE_CHAR_ENTRIES.includes(entry.name)) {
                  ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:156:58 - error TS18046: 'entry' is of type 'unknown'.

156           if (entry.name && SINGLE_CHAR_ENTRIES.includes(entry.name)) {
                                                             ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:157:17 - error TS18046: 'entry' is of type 'unknown'.

157             if (entry.enabled) {
                    ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:158:15 - error TS18046: 'entry' is of type 'unknown'.

158               entry.enabled = false;
                  ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:160:22 - error TS18046: 'entry' is of type 'unknown'.

160                 uid: entry.uid,
                         ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:161:26 - error TS18046: 'entry' is of type 'unknown'.

161                 comment: entry.comment || entry.name,
                             ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:161:43 - error TS18046: 'entry' is of type 'unknown'.

161                 comment: entry.comment || entry.name,
                                              ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:222:24 - error TS18046: 'entry' is of type 'unknown'.

222           const name = entry.name;
                           ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:225:35 - error TS18046: 'entry' is of type 'unknown'.

225           const originalState = !!entry.enabled;
                                      ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:231:28 - error TS2571: Object is of type 'unknown'.

231               const keys = (entry as unknown).key || (entry as unknown).keys || [];
                               ~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:231:54 - error TS2571: Object is of type 'unknown'.

231               const keys = (entry as unknown).key || (entry as unknown).keys || [];
                                                         ~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:242:28 - error TS2571: Object is of type 'unknown'.

242               const keys = (entry as unknown).key || (entry as unknown).keys || [];
                               ~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:242:54 - error TS2571: Object is of type 'unknown'.

242               const keys = (entry as unknown).key || (entry as unknown).keys || [];
                                                         ~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:251:13 - error TS18046: 'entry' is of type 'unknown'.

251             entry.enabled = newState;
                ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:253:20 - error TS18046: 'entry' is of type 'unknown'.

253               uid: entry.uid,
                       ~~~~~

src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:254:24 - error TS2571: Object is of type 'unknown'.

254               comment: (entry as unknown).comment || name, // 优先使用 comment 备注
                           ~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/logger.ts:70:41 - error TS2345: Argument of type '{}' is not assignable to parameter of type 'number'. 

70     if (this.flushTimeout) clearTimeout(this.flushTimeout);
                                           ~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/logger.ts:81:25 - error TS18046: 'e' is of type 'unknown'.

81         (e: unknown) => e.name === DEBUG_ENTRY_FULL_NAME || e.comment === DEBUG_ENTRY_FULL_NAME,
                           ~

src/ARK_STATUSBAR/logic/worldbook/logger.ts:81:61 - error TS18046: 'e' is of type 'unknown'.

81         (e: unknown) => e.name === DEBUG_ENTRY_FULL_NAME || e.comment === DEBUG_ENTRY_FULL_NAME,
                                                               ~

src/ARK_STATUSBAR/logic/worldbook/logger.ts:87:55 - error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'PartialDeep<WorldbookEntry>[]'.

 87         await createWorldbookEntries(targetWorldbook, [
                                                          ~
 88           {
    ~~~~~~~~~~~
...
 94           },
    ~~~~~~~~~~~~
 95         ] as unknown);
    ~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/logger.ts:98:52 - error TS18046: 'x' is of type 'unknown'.

98           const e = wbEntries.find((x: unknown) => x.name === DEBUG_ENTRY_FULL_NAME || x.comment === DEBUG_ENTRY_FULL_NAME);
                                                      ~

src/ARK_STATUSBAR/logic/worldbook/logger.ts:98:88 - error TS18046: 'x' is of type 'unknown'.

98           const e = wbEntries.find((x: unknown) => x.name === DEBUG_ENTRY_FULL_NAME || x.comment === DEBUG_ENTRY_FULL_NAME);
                                                                                          ~

src/ARK_STATUSBAR/logic/worldbook/logger.ts:100:15 - error TS2339: Property 'content' does not exist on type '{}'.

100             e.content = logContent;
                  ~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/logger.ts:101:15 - error TS2339: Property 'enabled' does not exist on type '{}'.

101             e.enabled = false;
                  ~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:174:56 - error TS2571: Object is of type 'unknown'.

174         : typeof SillyTavern !== 'undefined' && typeof (SillyTavern as unknown).getContext === 'function'
                                                           ~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:175:13 - error TS2571: Object is of type 'unknown'.

175           ? (SillyTavern as unknown).getContext()
                ~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:205:24 - error TS2339: Property 'mes' does not exist on type '{}'.

205         if (msg && msg.mes !== undefined) {
                           ~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:206:26 - error TS2339: Property 'name' does not exist on type '{}'.

206           let name = msg.name;
                             ~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:208:24 - error TS2339: Property 'is_user' does not exist on type '{}'.

208             name = msg.is_user ? SillyTavern.name1 : SillyTavern.name2;
                           ~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:211:41 - error TS2339: Property 'mes' does not exist on type '{}'.

211           return name ? `${name}: ${msg.mes}` : String(msg.mes);
                                            ~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:211:60 - error TS2339: Property 'mes' does not exist on type '{}'.

211           return name ? `${name}: ${msg.mes}` : String(msg.mes);
                                                               ~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:224:7 - error TS2571: Object is of type 'unknown'.

224       (mockChat as unknown).__isMock = true;
          ~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:230:21 - error TS18046: 'evt' is of type 'unknown'.

230         const raw = evt.detail || evt;
                        ~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:249:32 - error TS2571: Object is of type 'unknown'.

249             const entryWorld = (newEntry as unknown).world || 'UnknownWorld';
                                   ~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:251:13 - error TS2571: Object is of type 'unknown'.

251             (mapped as unknown).world = entryWorld;
                ~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:303:22 - error TS18046: 'evt' is of type 'unknown'.

303         const data = evt.detail || evt;
                         ~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:316:59 - error TS18046: 'm' is of type 'unknown'.

316             fullText = payloadStrings.map((m: unknown) => m.content || `${m.name}: ${m.mes}`).join('\n');
                                                              ~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:316:75 - error TS18046: 'm' is of type 'unknown'.

316             fullText = payloadStrings.map((m: unknown) => m.content || `${m.name}: ${m.mes}`).join('\n');
                                                                              ~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:316:86 - error TS18046: 'm' is of type 'unknown'.

316             fullText = payloadStrings.map((m: unknown) => m.content || `${m.name}: ${m.mes}`).join('\n');
                                                                                         ~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:324:60 - error TS2571: Object is of type 'unknown'.

324           if (typeof SillyTavern !== 'undefined' && typeof (SillyTavern as unknown).getTokenCountAsync === 'function') {
                                                               ~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:325:32 - error TS2571: Object is of type 'unknown'.

325             tokenCount = await (SillyTavern as unknown).getTokenCountAsync(fullText);
                                   ~~~~~~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:17:16 - error TS18046: 'e' is of type 'unknown'.

17         states[e.uid] = {
                  ~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:18:20 - error TS18046: 'e' is of type 'unknown'.

18           enabled: e.enabled,
                      ~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:19:17 - error TS18046: 'e' is of type 'unknown'.

19           type: e.strategy?.type || 'selective',
                   ~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:56:31 - error TS18046: 'e' is of type 'unknown'.

56           if (snapshot.states[e.uid]) {
                                 ~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:57:40 - error TS18046: 'e' is of type 'unknown'.

57             const st = snapshot.states[e.uid];
                                          ~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:58:13 - error TS18046: 'e' is of type 'unknown'.

58             e.enabled = st.enabled;
               ~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:59:18 - error TS18046: 'e' is of type 'unknown'.

59             if (!e.strategy) (e as unknown).strategy = {};
                    ~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:59:30 - error TS2571: Object is of type 'unknown'.

59             if (!e.strategy) (e as unknown).strategy = {};
                                ~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:60:13 - error TS18046: 'e' is of type 'unknown'.

60             e.strategy.type = st.type as unknown;
               ~

src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:61:13 - error TS2571: Object is of type 'unknown'.

61             (e as unknown).constant = st.type === 'constant';
               ~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:26:19 - error TS2339: Property 'vectorized' does not exist on type '{}'.

26     if (clonedRaw.vectorized) {
                     ~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:28:26 - error TS2339: Property 'constant' does not exist on type '{}'.

28     } else if (clonedRaw.constant) {
                            ~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:30:26 - error TS2339: Property 'selective' does not exist on type '{}'.

30     } else if (clonedRaw.selective) {
                            ~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:39:23 - error TS2339: Property 'position' does not exist on type '{}'.

39     switch (clonedRaw.position) {
                         ~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:65:19 - error TS2339: Property 'role' does not exist on type '{}'.

65     if (clonedRaw.role === 1) role = 'user';
                     ~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:66:24 - error TS2339: Property 'role' does not exist on type '{}'.

66     else if (clonedRaw.role === 2) role = 'assistant';
                          ~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:70:23 - error TS2339: Property 'selectiveLogic' does not exist on type '{}'.       

70     switch (clonedRaw.selectiveLogic) {
                         ~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:86:22 - error TS2339: Property 'uid' does not exist on type '{}'.

86       uid: clonedRaw.uid ?? -1,
                        ~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:87:23 - error TS2339: Property 'comment' does not exist on type '{}'.

87       name: clonedRaw.comment || clonedRaw.name || '',
                         ~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:87:44 - error TS2339: Property 'name' does not exist on type '{}'.

87       name: clonedRaw.comment || clonedRaw.name || '',
                                              ~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:88:26 - error TS2339: Property 'disable' does not exist on type '{}'.

88       enabled: clonedRaw.disable === undefined ? !!clonedRaw.enabled : !clonedRaw.disable,
                            ~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:88:62 - error TS2339: Property 'enabled' does not exist on type '{}'.

88       enabled: clonedRaw.disable === undefined ? !!clonedRaw.enabled : !clonedRaw.disable,
                                                                ~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:88:83 - error TS2339: Property 'disable' does not exist on type '{}'.

88       enabled: clonedRaw.disable === undefined ? !!clonedRaw.enabled : !clonedRaw.disable,
                                                                                     ~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:92:39 - error TS2339: Property 'key' does not exist on type '{}'.

92         keys: Array.isArray(clonedRaw.key) ? [...clonedRaw.key] : [],
                                         ~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:92:60 - error TS2339: Property 'key' does not exist on type '{}'.

92         keys: Array.isArray(clonedRaw.key) ? [...clonedRaw.key] : [],
                                                              ~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:95:41 - error TS2339: Property 'keysecondary' does not exist on type '{}'.

95           keys: Array.isArray(clonedRaw.keysecondary) ? [...clonedRaw.keysecondary] : [],
                                           ~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:95:71 - error TS2339: Property 'keysecondary' does not exist on type '{}'.

95           keys: Array.isArray(clonedRaw.keysecondary) ? [...clonedRaw.keysecondary] : [],
                                                                         ~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:97:31 - error TS2339: Property 'scanDepth' does not exist on type '{}'.

97         scan_depth: clonedRaw.scanDepth ?? 'same_as_global',
                                 ~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:103:26 - error TS2339: Property 'depth' does not exist on type '{}'.

103         depth: clonedRaw.depth ?? 0,
                             ~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:104:26 - error TS2339: Property 'order' does not exist on type '{}'.

104         order: clonedRaw.order ?? 100,
                             ~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:107:26 - error TS2339: Property 'content' does not exist on type '{}'.

107       content: clonedRaw.content || '',
                             ~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:108:30 - error TS2339: Property 'probability' does not exist on type '{}'.

108       probability: clonedRaw.probability ?? 100,
                                 ~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:111:39 - error TS2339: Property 'preventRecursion' does not exist on type '{}'.    

111         prevent_incoming: !!clonedRaw.preventRecursion, // 注意原生的命名可能没有下划线
                                          ~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:112:39 - error TS2339: Property 'excludeRecursion' does not exist on type '{}'.    

112         prevent_outgoing: !!clonedRaw.excludeRecursion,
                                          ~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:113:32 - error TS2339: Property 'delayUntilRecursion' does not exist on type '{}'. 

113         delay_until: clonedRaw.delayUntilRecursion ? 1 : null, // 简化处理
                                   ~~~~~~~~~~~~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:117:27 - error TS2339: Property 'sticky' does not exist on type '{}'.

117         sticky: clonedRaw.sticky ?? null,
                              ~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:118:29 - error TS2339: Property 'cooldown' does not exist on type '{}'.

118         cooldown: clonedRaw.cooldown ?? null,
                                ~~~~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:119:26 - error TS2339: Property 'delay' does not exist on type '{}'.

119         delay: clonedRaw.delay ?? null,
                             ~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:122:24 - error TS2339: Property 'extra' does not exist on type '{}'.

122       extra: clonedRaw.extra ? { ...clonedRaw.extra } : undefined,
                           ~~~~~

src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:122:47 - error TS2339: Property 'extra' does not exist on type '{}'.

122       extra: clonedRaw.extra ? { ...clonedRaw.extra } : undefined,
                                                  ~~~~~


Found 120 errors in 10 files.

Errors  Files
     2  src/ARK_STATUSBAR/components/global_tabs/shared_ui_state.ts:79
    14  src/ARK_STATUSBAR/core/config_store.ts:33
    14  src/ARK_STATUSBAR/core/config_store.ts:33
     2  src/ARK_STATUSBAR/core/event_bus.ts:67
     8  src/ARK_STATUSBAR/index.ts:103
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
    14  src/ARK_STATUSBAR/core/config_store.ts:33
     2  src/ARK_STATUSBAR/core/event_bus.ts:67
     8  src/ARK_STATUSBAR/index.ts:103
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     8  src/ARK_STATUSBAR/logic/worldbook/logger.ts:70
    14  src/ARK_STATUSBAR/core/config_store.ts:33
     2  src/ARK_STATUSBAR/core/event_bus.ts:67
     8  src/ARK_STATUSBAR/index.ts:103
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
    14  src/ARK_STATUSBAR/core/config_store.ts:33
     2  src/ARK_STATUSBAR/core/event_bus.ts:67
     8  src/ARK_STATUSBAR/index.ts:103
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    14  src/ARK_STATUSBAR/core/config_store.ts:33
     2  src/ARK_STATUSBAR/core/event_bus.ts:67
     8  src/ARK_STATUSBAR/index.ts:103
    14  src/ARK_STATUSBAR/core/config_store.ts:33
     2  src/ARK_STATUSBAR/core/event_bus.ts:67
    14  src/ARK_STATUSBAR/core/config_store.ts:33
    14  src/ARK_STATUSBAR/core/config_store.ts:33
     2  src/ARK_STATUSBAR/core/event_bus.ts:67
     2  src/ARK_STATUSBAR/core/event_bus.ts:67
     8  src/ARK_STATUSBAR/index.ts:103
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     8  src/ARK_STATUSBAR/logic/worldbook/logger.ts:70
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     8  src/ARK_STATUSBAR/logic/worldbook/logger.ts:70
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     8  src/ARK_STATUSBAR/logic/worldbook/logger.ts:70
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     8  src/ARK_STATUSBAR/logic/worldbook/logger.ts:70
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     8  src/ARK_STATUSBAR/logic/worldbook/logger.ts:70
    17  src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:174
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     8  src/ARK_STATUSBAR/logic/worldbook/logger.ts:70
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
     4  src/ARK_STATUSBAR/logic/statusbar_manager.ts:172
    25  src/ARK_STATUSBAR/logic/worldbook/entry_service.ts:82
     8  src/ARK_STATUSBAR/logic/worldbook/logger.ts:70
    17  src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts:174
    10  src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts:17
    30  src/ARK_STATUSBAR/logic/worldbook/worldbook_mapper.ts:26