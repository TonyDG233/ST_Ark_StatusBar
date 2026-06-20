/**
 * @file system.ts
 * @description PRTS 系统状态机与数据源的 TypeScript 接口定义
 */

export interface SystemTxtState {
    max: number;
    index: number;
    name: string;
    now: string;
    now_temp: string;
    now_index: number;
    dynamic?: { id: string };
    init: () => void;
    over: () => void;
    checkBind: (id: string) => boolean;
    delay: {
        word: number;
        per: number;
        common: number;
        set: (tar: 'word'|'per'|'common', value: number) => void;
        reset: (tar: 'all'|'word'|'per'|'common') => void;
    };
}

export interface SystemErrorState {
    type: string;
    info: string | undefined;
    stat: boolean;
}

export interface PRTSData {
    txt: string[];
    audio: Record<string, any>;
    back: Record<string, any>;
    char: Record<string, any>;
    link: Record<string, any>;
    setting: {
        title: Record<string, string>;
        char: Record<string, any>;
        image: Record<string, any>;
        tween: Record<string, any>;
        override: Record<string, any>;
        disable: { prefix: Record<string, string>, title: Record<string, string> };
        set: (page: string, str: string) => string;
        check: (sub: string, key: string, line: number) => boolean;
    };
}

export interface SystemState {
    page: string;
    sourceUrl: string;
    assetUrl: string;
    debug: boolean;
    error: SystemErrorState;
    txt: SystemTxtState;
    flag: { auto: number; respond: number; skip: number; load: number };
    stats: { reset: boolean; click: boolean; theater: boolean; auto: boolean; log_all: boolean; step: boolean; report: boolean; log_suppress: boolean };
    decision: { mode: boolean; select: number; values: number[] };
    disabled: {
        flag: boolean;
        note: string;
        init: () => void;
    };
    source: Record<string, any>;
    multi: {
        mode: boolean;
        check: () => boolean;
        init: () => void;
        begin: () => void;
        end: (tar?: string) => void;
        reset: () => void;
    };
    auto: {
        mode: boolean;
        flag: number;
        toggle: () => void;
        start: () => void;
        stop: () => void;
        suspend: () => void;
        resume: () => void;
        checkNext: () => void;
    };
    skipnode: { stat: boolean; waitTarget: any };
    preload: {
        start: () => void;
        init: () => void;
        complete: () => void;
        handler: { begin: (e: Event) => void; end: (e: Event) => void; };
    };
    user: { name: string; client: string; display: string };
    ui: {
        width: number;
        height: number;
        multiply: number;
        applySkipNode: () => void;
    };
}
