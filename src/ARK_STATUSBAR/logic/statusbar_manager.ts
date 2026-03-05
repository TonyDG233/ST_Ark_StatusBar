import { BASELINE_STATE } from '../config/baseline';

export const CONFIG_ENTRY_PREFIX = "[SYS_CONFIG]";
export const CONFIG_ENTRY_FULL_NAME = "[SYS_CONFIG]系统配置文件请勿打开";

export interface ArkConfig {
    _desc: string;
    theme: 'light' | 'dark' | 'transparent';
    isSystemEnabled: boolean;
    isInterceptorEnabled: boolean;
    uiWidth: number;
    uiFontSize: number;
    commits: ArkCommit[];
    lastUpdateTime: number;
    suppressNextDiffWarning?: boolean;
}

const DEFAULT_CONFIG: ArkConfig = {
    _desc: "这是ARK_STATUSBAR的自动备份条目，请勿手动修改",
    theme: "light", // Default to light/white as requested
    isSystemEnabled: true,
    isInterceptorEnabled: true,
    uiWidth: 400,
    uiFontSize: 14,
    commits: [],
    lastUpdateTime: 0
};

export interface ArkCommit {
    id: string;
    timestamp: number;
    description: string;
    changes: {
        uid: number;
        comment: string;
        from: boolean;
        to: boolean;
    }[];
}

export class StatusBarManager {
    private static instance: StatusBarManager;
    private targetWorldbook: string | null = null;
    private interceptorBound: boolean = false;
    public currentConfig: ArkConfig | null = null;
    public onConfigUpdate?: (config: ArkConfig) => void; // Deprecated, use events

    private constructor() { }

    static getInstance(): StatusBarManager {
        if (!StatusBarManager.instance) {
            StatusBarManager.instance = new StatusBarManager();
        }
        return StatusBarManager.instance;
    }

    async init() {
        console.info('[ARK_StatusBar] Initializing Manager...');
        try {
            const result = await getCharWorldbookNames('current');
            if (result.primary) this.targetWorldbook = result.primary;
            else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];

            if (!this.targetWorldbook) {
                console.warn("[ARK_StatusBar] No worldbook bound to current character.");
                return;
            }

            await this.loadOrInitConfig();
            this.setupEvents();
            // Bind interceptor handled inside loadOrInitConfig
        } catch (error) {
            console.error('[ARK_StatusBar] Init failed:', error);
        }
    }

    private async loadOrInitConfig() {
        if (!this.targetWorldbook) return;
        let entries = await getWorldbook(this.targetWorldbook);
        let configEntry = entries.find((e: any) => (e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) || (e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)));

        if (!configEntry) {
            console.info(`[ARK_StatusBar] Creating ${CONFIG_ENTRY_FULL_NAME}...`);
            const initConfig: ArkConfig = { ...DEFAULT_CONFIG, lastUpdateTime: Date.now() };

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
                // Migrate missing fields from default config
                this.currentConfig = { ...DEFAULT_CONFIG, ...this.currentConfig };
            } catch (e) {
                console.error("[ARK_StatusBar] Failed to parse config JSON, using default:", e);
                this.currentConfig = { ...DEFAULT_CONFIG, lastUpdateTime: Date.now() };
            }
        }

        if (this.onConfigUpdate && this.currentConfig) {
            this.onConfigUpdate(this.currentConfig);
        }
        document.dispatchEvent(new CustomEvent('ark-config-updated', { detail: this.currentConfig }));

        if (this.currentConfig?.isSystemEnabled && this.currentConfig?.isInterceptorEnabled) {
            this.bindInterceptor();
        }
    }

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

    private setupEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;

        // Listen to CHAT_CHANGED to check diff
        eventOn(tavern_events.CHAT_CHANGED, async () => {
            console.info('[ARK_StatusBar] Chat changed, checking baseline diff and reloading...');

            try {
                // Determine target worldbook again in case user switched characters
                const result = await getCharWorldbookNames('current');
                if (result.primary) this.targetWorldbook = result.primary;
                else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];

                if (this.targetWorldbook) {
                    await this.loadOrInitConfig();
                    await this.checkBaselineDiff();
                }
            } catch (error) {
                console.error('[ARK_StatusBar] Failed to handle chat change', error);
            }

            // Dispatch event to UI so it can refresh the "All Entries" list
            document.dispatchEvent(new CustomEvent('ark-chat-changed'));
        });
    }

    public async checkBaselineDiff() {
        if (!this.targetWorldbook) return;
        try {
            // Check if we need to suppress the warning
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
                    if (entry.enabled !== baseline.enabled || currentType !== baseline.type) {
                        hasDiff = true;
                        break;
                    }
                }
            }

            // If diff exists, we should show a UI banner (non-blocking)
            if (hasDiff) {
                // In a real Vue app, we would emit an event or update state to show the banner
                // For MVP, we can trigger a toastr or dispatch a custom DOM event
                const event = new CustomEvent('ark-baseline-diff-detected');
                document.dispatchEvent(event);
            }
        } catch (e) {
            console.error('[ARK_StatusBar] Diff check failed', e);
        }
    }

    // --- Interceptor Logic ---
    private handleIntercept = async (e: Event) => {
        const keyboardEvent = e as KeyboardEvent;
        if (e.type === 'keydown' && (keyboardEvent.key !== 'Enter' || keyboardEvent.shiftKey)) return;

        const ST_DOC = window.parent?.document || document;
        const textarea = ST_DOC.querySelector('#send_textarea') as HTMLTextAreaElement;
        const text = textarea?.value?.trim() || "";
        if (!text) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        console.info('[ARK_StatusBar] Generation intercepted! Running dry run...');

        const st = (window.parent as any)?.SillyTavern || (window as any).SillyTavern;
        const context = st?.getContext?.();
        if (!context || !context.getWorldInfoPrompt) {
            this.releaseInterceptAndSend();
            return;
        }

        const rawChat = context.chat || [];
        const chatStrings = rawChat.map((msg: any) => (msg.mes !== undefined ? msg.mes : String(msg)));
        const mockChat = [...chatStrings, text];

        let activatedEntries: any[] = [];
        const tempListener = (evt: any) => {
            activatedEntries = evt.detail || evt;
        };

        const eventTarget = window.parent?.document || document;
        eventTarget.addEventListener('world_info_activated', tempListener);
        const globalEventOn = (window.parent as any)?.eventOn || (window as any).eventOn;
        if (globalEventOn) globalEventOn('world_info_activated', tempListener);

        try {
            await context.getWorldInfoPrompt(mockChat, 100000, false);
        } catch (error) {
            console.error('[ARK_StatusBar] Dry run failed', error);
        }

        eventTarget.removeEventListener('world_info_activated', tempListener);
        const globalEventOff = (window.parent as any)?.eventOff || (window as any).eventOff;
        if (globalEventOff) globalEventOff('world_info_activated', tempListener);

        if (activatedEntries && activatedEntries.length > 0) {
            // Trigger UI to show pending entries. GlobalStatusBar will handle mapping to real entries and filtering out constant ones.
            const event = new CustomEvent('ark-interceptor-triggered', { detail: { entries: activatedEntries } });
            document.dispatchEvent(event);
        } else {
            // No pending entries, let it go
            this.releaseInterceptAndSend();
        }
    }

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

    public releaseInterceptAndSend() {
        this.unbindInterceptor();
        const ST_DOC = window.parent?.document || document;
        const sendBtn = ST_DOC.querySelector('#send_but') as HTMLElement;
        if (sendBtn) {
            console.info('[ARK_StatusBar] Releasing interceptor and sending...');
            sendBtn.click();
            setTimeout(() => {
                if (this.currentConfig?.isInterceptorEnabled) {
                    this.bindInterceptor();
                }
            }, 500);
        }
    }
}
