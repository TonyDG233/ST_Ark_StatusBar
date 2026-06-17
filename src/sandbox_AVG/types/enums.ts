/**
 * @file enums.ts
 * @description PRTS 引擎底层枚举类型定义 (转译自 prts_scenario.js 顶部的 $enum)
 */

// 指令解析/执行的返回状态控制
export enum ResType {
    skip = -2,    // 强制跳过当前解析
    error = -1,   // 解析/执行异常
    dynamic = 0,  // 动态效果中 (如打字机正在输出)
    next = 1,     // 正常解析完毕，允许直接进行下一句
    wait = 2      // 等待用户操作或等待强制延迟
}

// UI 剧场模式与对话框设定的状态控制
export enum SetType {
    pre = -10,
    resume = -2,
    close = -1,
    reset = 0,
    open = 1,
    suspend = 2
}

// 终端控制台输出日志级别
export enum LogType {
    trace = -2,
    debug = -1,
    info = 0,
    warn = 1,
    error = 2,
    sp1 = 11, // Special Color 1
    sp2 = 12  // Special Color 2
}

/**
 * 引擎全局常量定义
 * TODO: 未来随着组件化，这些常量可能需要下发到各个 Vue 视图组件的 default props 中
 */
export const SCENARIO_CONSTANTS = {
    dec_limit_px: 450,
    log_limit_px: 582,
    log_em_limit_px: 200,
    wait_trigger: 150,
    base_width: 960,
    base_height: 540,
    pos_multiply: 0.75
};
