import { BASELINE_STATE } from '../config/baseline';

// 系统配置条目的前缀，用于在世界书中快速定位配置条目
export const CONFIG_ENTRY_PREFIX = "[SYS_CONFIG]";
// 系统配置条目的完整名称
export const CONFIG_ENTRY_FULL_NAME = "[SYS_CONFIG]系统配置文件请勿打开";

/**
 * 状态栏的全局配置接口，所有持久化配置都会保存在世界书的 [SYS_CONFIG] 条目中。
 */
export interface ArkConfig {
    _desc: string; // 配置文件说明，防止用户误修改
    theme: 'light' | 'dark' | 'transparent'; // 当前 UI 主题
    isSystemEnabled: boolean; // 系统总开关，控制整个状态栏是否启用
    isInterceptorEnabled: boolean; // 拦截器开关，控制是否在发送时拦截预警
    uiWidth: number; // 状态栏 UI 的宽度
    uiFontSize: number; // 状态栏 UI 的基础字体大小
    commits: ArkCommit[]; // 操作历史记录（类似 Git commit）
    lastUpdateTime: number; // 最后一次配置更新的时间戳
    suppressNextDiffWarning?: boolean; // 是否屏蔽下一次的 Baseline 差异警告
    pinnedEntries?: number[]; // 用户置顶偏好的世界书条目 UID 列表
}

// 默认的初始配置
const DEFAULT_CONFIG: ArkConfig = {
    _desc: "这是ARK_STATUSBAR的自动备份条目，请勿手动修改",
    theme: "light", // 默认主题为浅色
    isSystemEnabled: true,
    isInterceptorEnabled: true,
    uiWidth: 400,
    uiFontSize: 14,
    commits: [],
    lastUpdateTime: 0,
    pinnedEntries: []
};

/**
 * 历史记录（Commit）的结构定义，用于记录对世界书条目状态的修改。
 */
export interface ArkCommit {
    id: string; // 唯一的提交 ID
    timestamp: number; // 提交时间戳
    description: string; // 提交的文字描述
    changes: {
        uid: number; // 修改的世界书条目 UID
        comment: string; // 变动的条目名称/备注
        from: boolean; // 变更前的 enabled 状态
        to: boolean; // 变更后的 enabled 状态
    }[];
}

/**
 * 状态栏全局管理器 (Singleton 单例模式)
 * 负责与 SillyTavern 核心环境交互、管理持久化配置以及接管发送拦截功能。
 */
export class StatusBarManager {
    private static instance: StatusBarManager;
    private targetWorldbook: string | null = null; // 当前绑定的世界书名称
    private interceptorBound: boolean = false; // 标识是否已经绑定了拦截器事件
    public currentConfig: ArkConfig | null = null; // 内存中缓存的当前配置
    public onConfigUpdate?: (config: ArkConfig) => void; // 配置更新的回调 (已弃用，建议监听 ark-config-updated 事件)

    private constructor() { }

    // 获取单例实例
    static getInstance(): StatusBarManager {
        if (!StatusBarManager.instance) {
            StatusBarManager.instance = new StatusBarManager();
        }
        return StatusBarManager.instance;
    }

    /**
     * 初始化管理器：获取当前世界书、加载配置并绑定相关事件。
     */
    async init() {
        console.info('[ARK_StatusBar] Initializing Manager...');
        try {
            // 获取当前角色所绑定的世界书名称
            const result = await getCharWorldbookNames('current');
            if (result.primary) this.targetWorldbook = result.primary;
            else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];

            if (!this.targetWorldbook) {
                console.warn("[ARK_StatusBar] No worldbook bound to current character.");
                return;
            }

            // 加载或初始化配置文件
            await this.loadOrInitConfig();
            // 绑定事件监听器 (如聊天改变时检测 Baseline 差异)
            this.setupEvents();
        } catch (error) {
            console.error('[ARK_StatusBar] Init failed:', error);
        }
    }

    /**
     * 从世界书中加载配置，如果不存在则初始化一个默认配置写入世界书。
     */
    private async loadOrInitConfig() {
        if (!this.targetWorldbook) return;
        let entries = await getWorldbook(this.targetWorldbook);

        // 根据前缀匹配查找是否已有配置条目
        let configEntry = entries.find((e: any) => (e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) || (e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)));

        if (!configEntry) {
            console.info(`[ARK_StatusBar] Creating ${CONFIG_ENTRY_FULL_NAME}...`);
            const initConfig: ArkConfig = { ...DEFAULT_CONFIG, lastUpdateTime: Date.now() };

            // 创建新的配置条目（保持关闭状态，作为纯数据容器使用）
            await createWorldbookEntries(this.targetWorldbook, [{
                name: CONFIG_ENTRY_FULL_NAME,
                comment: CONFIG_ENTRY_FULL_NAME,
                content: JSON.stringify(initConfig, null, 2),
                enabled: false,
                constant: false
            }]);
            this.currentConfig = initConfig;
        } else {
            try {
                this.currentConfig = JSON.parse(configEntry.content);
                // 合并默认配置，以防新版本新增了字段
                this.currentConfig = { ...DEFAULT_CONFIG, ...this.currentConfig };
            } catch (e) {
                console.error("[ARK_StatusBar] Failed to parse config JSON, using default:", e);
                this.currentConfig = { ...DEFAULT_CONFIG, lastUpdateTime: Date.now() };
            }
        }

        if (this.onConfigUpdate && this.currentConfig) {
            this.onConfigUpdate(this.currentConfig);
        }
        // 派发全局事件通知 UI 更新配置
        document.dispatchEvent(new CustomEvent('ark-config-updated', { detail: this.currentConfig }));

        // 如果系统和拦截器都处于开启状态，则绑定物理事件拦截
        if (this.currentConfig?.isSystemEnabled && this.currentConfig?.isInterceptorEnabled) {
            this.bindInterceptor();
        }
    }

    /**
     * 保存配置到世界书中，并触发更新事件。
     */
    async saveConfig(configUpdate: Partial<ArkConfig>) {
        if (!this.targetWorldbook || !this.currentConfig) return;
        this.currentConfig = { ...this.currentConfig, ...configUpdate, lastUpdateTime: Date.now() };

        try {
            await updateWorldbookWith(this.targetWorldbook, (wbEntries: any[]) => {
                const entry = wbEntries.find(e => (e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) || (e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)));
                if (entry) {
                    entry.content = JSON.stringify(this.currentConfig, null, 2);
                    entry.enabled = false;
                }
                return wbEntries;
            });
            if (this.onConfigUpdate) {
                this.onConfigUpdate(this.currentConfig);
            }
            document.dispatchEvent(new CustomEvent('ark-config-updated', { detail: this.currentConfig }));

            // 根据配置决定是否重新绑定或解绑拦截器
            if (this.currentConfig.isSystemEnabled && this.currentConfig.isInterceptorEnabled) {
                this.bindInterceptor();
            } else {
                this.unbindInterceptor();
            }
        } catch (error) {
            console.error('[ARK_StatusBar] Failed to save config:', error);
        }
    }

    private eventsBound: boolean = false;

    /**
     * 设置环境事件监听。
     */
    private setupEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;

        // 监听酒馆原生 CHAT_CHANGED 事件（切换聊天或重新加载时）
        eventOn(tavern_events.CHAT_CHANGED, async () => {
            console.info('[ARK_StatusBar] Chat changed, checking baseline diff and reloading...');

            try {
                // 用户可能切换了角色，因此需要重新获取绑定的世界书
                const result = await getCharWorldbookNames('current');
                if (result.primary) this.targetWorldbook = result.primary;
                else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];

                if (this.targetWorldbook) {
                    await this.loadOrInitConfig();
                    await this.checkBaselineDiff(); // 检查当前状态是否偏离了设定的 Baseline
                }
            } catch (error) {
                console.error('[ARK_StatusBar] Failed to handle chat change', error);
            }

            // 派发事件通知 UI 刷新 "全部条目" 列表
            document.dispatchEvent(new CustomEvent('ark-chat-changed'));
        });
    }

    /**
     * 检查当前世界书状态与 Baseline (基准线) 的差异。
     */
    public async checkBaselineDiff() {
        if (!this.targetWorldbook) return;
        try {
            // 如果要求静默下一次警告（如刚恢复 Baseline 后），则跳过并复位标志
            if (this.currentConfig?.suppressNextDiffWarning) {
                console.info('[ARK_StatusBar] Suppressing diff warning as requested.');
                await this.saveConfig({ suppressNextDiffWarning: false });
                return;
            }

            const entries = await getWorldbook(this.targetWorldbook);
            let hasDiff = false;
            for (const key of Object.keys(BASELINE_STATE)) {
                const entry = entries.find((e: any) => e.name === key || e.comment === key);
                const baseline = BASELINE_STATE[key];

                if (entry) {
                    const currentType = entry.strategy?.type || 'selective';
                    // 只要开关状态或触发类型（蓝/绿灯）有不一致，即认为存在差异
                    if (entry.enabled !== baseline.enabled || currentType !== baseline.type) {
                        hasDiff = true;
                        break;
                    }
                }
            }

            // 如果存在差异，可以通过抛出事件让 UI 进行提示
            if (hasDiff) {
                const event = new CustomEvent('ark-baseline-diff-detected');
                document.dispatchEvent(event);
            }
        } catch (e) {
            console.error('[ARK_StatusBar] Diff check failed', e);
        }
    }

    // --- 拦截器与发送检测核心逻辑 ---

    /**
     * 运行“主动检测”流程 (Manual Test)。
     * 构造虚拟上下文并执行 Dry Run，预览在当前对话内容下会触发哪些世界书条目，而不实际发送。
     */
    public async runManualTest() {
        console.info('[ARK_StatusBar] Running manual test...');
        const ST_DOC = window.parent?.document || document;
        const textarea = ST_DOC.querySelector('#send_textarea') as HTMLTextAreaElement;
        const text = textarea?.value?.trim() || "";

        const st = (window.parent as any)?.SillyTavern || (window as any).SillyTavern;
        const context = st?.getContext?.();
        if (!context || !context.getWorldInfoPrompt) {
            console.warn("[ARK_StatusBar] Context or getWorldInfoPrompt not available for manual test.");
            const event = new CustomEvent('ark-interceptor-triggered', { detail: { entries: [], isManualTest: true } });
            document.dispatchEvent(event);
            return;
        }

        // 构造酒馆原生的聊天上下文数组
        const rawChat = context.chat || [];
        const chatStrings = rawChat.map((msg: any) => {
            if (typeof msg === 'string') return msg;
            if (msg && msg.mes !== undefined) {
                let name = msg.name;
                if (!name && st) {
                    name = msg.is_user ? st.name1 : st.name2;
                }
                // 重要: 酒馆扫描严格要求 "Name: Message" 格式
                return name ? `${name}: ${msg.mes}` : String(msg.mes);
            }
            return String(msg);
        });

        const mockChat = [...chatStrings];
        if (text) {
            const userName = st?.name1 || "User";
            mockChat.push(`${userName}: ${text}`); // 将当前输入框中的文本也加入测试范围
        }

        // CRITICAL FIX: SillyTavern 原生 `getWorldInfoPrompt` 扫描 Depth 时，严格要求数组倒序，索引 0 为最新消息。
        mockChat.reverse();

        (mockChat as any).__isMock = true; // 标记为 Mock 数据
        console.log("[ARK_StatusBar] Mock chat for manual test:", mockChat);

        let activatedEntries: any[] = [];
        const tempListener = (evt: any) => {
            activatedEntries = evt.detail || evt; // 捕获 Dry Run 触发的 entries
        };

        // 临时绑定原生的世界书激活事件监听
        const eventTarget = window.parent?.document || document;
        eventTarget.addEventListener('world_info_activated', tempListener);
        const globalEventOn = (window.parent as any)?.eventOn || (window as any).eventOn;
        if (globalEventOn) globalEventOn('world_info_activated', tempListener);

        try {
            // 参数说明: mockChat(模拟上下文), 1000000(极大上下文token确保不截断), false(非真实运行，仅提取词条)
            await context.getWorldInfoPrompt(mockChat, 1000000, false);
        } catch (error) {
            console.error('[ARK_StatusBar] Dry run failed', error);
        }

        // 移除临时事件监听
        eventTarget.removeEventListener('world_info_activated', tempListener);
        const globalEventOff = (window.parent as any)?.eventOff || (window as any).eventOff;
        if (globalEventOff) globalEventOff('world_info_activated', tempListener);

        // 抛出检测结果给 UI (携带 isManualTest 标志)
        const event = new CustomEvent('ark-interceptor-triggered', { detail: { entries: activatedEntries || [], isManualTest: true } });
        document.dispatchEvent(event);
    }

    /**
     * 用户点击发送按钮或按下回车时触发拦截的 Handler
     */
    private handleIntercept = async (e: Event) => {
        const keyboardEvent = e as KeyboardEvent;
        // 只有纯回车键才拦截（Shift+Enter 是换行，不发送）
        if (e.type === 'keydown' && (keyboardEvent.key !== 'Enter' || keyboardEvent.shiftKey)) return;

        const ST_DOC = window.parent?.document || document;
        const textarea = ST_DOC.querySelector('#send_textarea') as HTMLTextAreaElement;
        const text = textarea?.value?.trim() || "";
        if (!text) return;

        // 阻止原生发送流程
        e.preventDefault();
        e.stopImmediatePropagation();

        console.info('[ARK_StatusBar] Generation intercepted! Running dry run...');

        const st = (window.parent as any)?.SillyTavern || (window as any).SillyTavern;
        const context = st?.getContext?.();
        if (!context || !context.getWorldInfoPrompt) {
            this.releaseInterceptAndSend(); // 如果拿不到上下文直接放行
            return;
        }

        // ---- 构建环境上下文以进行 Dry Run (与 Manual Test 逻辑相同) ----
        const rawChat = context.chat || [];
        const chatStrings = rawChat.map((msg: any) => {
            if (typeof msg === 'string') return msg;
            if (msg && msg.mes !== undefined) {
                let name = msg.name;
                if (!name && st) {
                    name = msg.is_user ? st.name1 : st.name2;
                }
                return name ? `${name}: ${msg.mes}` : String(msg.mes);
            }
            return String(msg);
        });

        const mockChat = [...chatStrings];
        if (text) {
            const userName = st?.name1 || "User";
            mockChat.push(`${userName}: ${text}`);
        }

        mockChat.reverse();

        let activatedEntries: any[] = [];
        const tempListener = (evt: any) => {
            activatedEntries = evt.detail || evt;
        };

        const eventTarget = window.parent?.document || document;
        eventTarget.addEventListener('world_info_activated', tempListener);
        const globalEventOn = (window.parent as any)?.eventOn || (window as any).eventOn;
        if (globalEventOn) globalEventOn('world_info_activated', tempListener);

        try {
            await context.getWorldInfoPrompt(mockChat, 1000000, false);
        } catch (error) {
            console.error('[ARK_StatusBar] Dry run failed', error);
        }

        eventTarget.removeEventListener('world_info_activated', tempListener);
        const globalEventOff = (window.parent as any)?.eventOff || (window as any).eventOff;
        if (globalEventOff) globalEventOff('world_info_activated', tempListener);

        // ---- 处理拦截结果 ----
        if (activatedEntries && activatedEntries.length > 0) {
            // 抛出拦截预警事件给 UI（GlobalStatusBar 接管并展示）
            const event = new CustomEvent('ark-interceptor-triggered', { detail: { entries: activatedEntries } });
            document.dispatchEvent(event);
        } else {
            // 没有触发任何词条，静默放行
            this.releaseInterceptAndSend();
        }
    }

    /**
     * 将拦截逻辑绑定到原生的 Send 按钮和文本输入框。
     * 采用捕获阶段(true)优先拿到事件。
     */
    private bindInterceptor() {
        if (this.interceptorBound) return;
        const ST_DOC = window.parent?.document || document;
        const sendBtn = ST_DOC.querySelector('#send_but');
        const textarea = ST_DOC.querySelector('#send_textarea');

        if (sendBtn && textarea) {
            sendBtn.addEventListener('click', this.handleIntercept, true);
            textarea.addEventListener('keydown', this.handleIntercept, true);
            this.interceptorBound = true;
            console.info('[ARK_StatusBar] Interceptor bound.');
        }
    }

    /**
     * 解绑拦截器。
     */
    private unbindInterceptor() {
        if (!this.interceptorBound) return;
        const ST_DOC = window.parent?.document || document;
        const sendBtn = ST_DOC.querySelector('#send_but');
        const textarea = ST_DOC.querySelector('#send_textarea');

        if (sendBtn && textarea) {
            sendBtn.removeEventListener('click', this.handleIntercept, true);
            textarea.removeEventListener('keydown', this.handleIntercept, true);
            this.interceptorBound = false;
            console.info('[ARK_StatusBar] Interceptor unbound.');
        }
    }

    /**
     * 取消拦截并强制发送。
     * （先解绑拦截器 -> 主动触发原生按钮 -> 延迟半秒后再重新绑定拦截器）
     */
    public releaseInterceptAndSend() {
        this.unbindInterceptor();
        const ST_DOC = window.parent?.document || document;
        const sendBtn = ST_DOC.querySelector('#send_but') as HTMLElement;
        if (sendBtn) {
            console.info('[ARK_StatusBar] Releasing interceptor and sending...');
            sendBtn.click(); // 执行真实的原生发送逻辑
            // 延迟重新挂载拦截器，防止死循环
            setTimeout(() => {
                if (this.currentConfig?.isInterceptorEnabled) {
                    this.bindInterceptor();
                }
            }, 500);
        }
    }
}
