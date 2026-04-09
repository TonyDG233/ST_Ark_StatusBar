import { onMounted, onUnmounted, Ref, ref } from 'vue';

// 全局唯一的 UI 状态机
export enum UiMode {
  FULL = 'FULL',     // 完全展开状态 (拥有 Tab 等完整功能)
  MINI = 'MINI',     // 折叠小窗状态 (只显示一条/列表概览)
  BUBBLE = 'BUBBLE', // 隐藏气泡状态 (贴边吸附，仅显示一个把手)
}

// 物理引擎常量区
export const PHYSICS_CONSTANTS = {
  // --- 触发阈值 ---
  // 【优化3】：调回沙盒版的原始吸附阈值，避免正数过大导致普通拖拽误触吸附，或气泡检测失灵
  /** 当组件距离屏幕左/右边缘小于等于此值时，触发贴边磁吸 */
  SNAP_ALIGN_THRESHOLD: 20, 
  /** 仅在 MINI 模式下，靠近屏幕边缘小于此值，触发收起为胶囊气泡模式 */
  HIDE_THRESHOLD: -15,   
  /** 当处于胶囊气泡状态时，向内拉扯的宽度大于此值时，松手判定为展开悬浮窗 */    
  STRETCH_RELEASE_THRESHOLD: 45,

  // --- 尺寸预估与安全边距 ---
  /** 胶囊气泡的默认宽度 */
  BUBBLE_WIDTH: 32,
  /** 胶囊气泡被拉扯时的最大弹性宽度限制 */
  MAX_STRETCH: 80,
  /** 展开为悬浮窗后，默认远离边缘弹开的安全距离（防二次误吸附） */
  EXPAND_BOUNCE_MARGIN: 30,
  /** 屏幕顶部安全距离防撞墙 */
  SAFE_TOP: 25,
  /** 屏幕底部安全距离防撞墙（配合真实高度检测，防止底部挤压） */
  SAFE_MARGIN_BOTTOM: 30,
};

/**
 * 拖拽与边界物理引擎 Hook
 * 
 * 职责：接管所有的 `mousedown/touchstart` 等原生 DOM 拖拽事件。
 * 输出：绝对安全的 `transformX` 和 `transformY` 物理像素坐标，以及当前拖拽状态。
 * 防御：内置 ResizeObserver 与 1000ms 强制心跳，兜底解决渲染漂移与底部沉底问题。
 */
export function useDraggablePhysics(
  statusBarEl: Ref<HTMLElement | null>,
  currentUiMode: Ref<UiMode>
) {
  // ---------------------------------------------------------------------------
  // 核心坐标系重构：绝对全局 Top-Right 定位！
  // - `transformX.value` 代表组件【右边缘】距离屏幕左侧的物理像素值。
  //   (即：Left边缘坐标 + 自身Width = Right边缘坐标)
  // - `transformY.value` 代表组件【上边缘】距离屏幕顶部的物理像素值。
  // 
  // 优势：在配合外层容器 `right:0` 的 CSS 时，由于宽度是向左收缩的，
  // 拖拽原点和 CSS 形变原点在视觉上永远不会发生撕裂互锁。
  // ---------------------------------------------------------------------------
  const transformX = ref(0);
  const transformY = ref(0);
  
  // 对外暴露的拖拽中状态，供 Vue 层增加 `.is-dragging` 类名禁用 CSS Transition 以保证帧率
  const isDraggingState = ref(false); 
  // 【优化4】：暴露一个临时状态，告诉外层壳此时是否正在经历“松手回弹”或者“碰撞矫正”
  // 从而让外壳临时拥有 transition 动画，告别瞬间撞墙的生硬感
  const isSnapping = ref(false);

  // 对外暴露的边缘吸附状态，决定是否渲染成气泡
  const isSnappedToEdge = ref<false | 'left' | 'right'>(false);
  // 【优化5】：对外暴露一个动态推断的挂载侧，当组件停留在屏幕左半边时，允许内层 UI 切换为 Left:0 锚点
  const isAnchoredLeft = ref(false);

  // 气泡模式下的弹性拉伸宽度 (橡皮筋效果)
  const snappedStretchWidth = ref(PHYSICS_CONSTANTS.BUBBLE_WIDTH);

  // 内部拖拽暂存
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;
  let snappingTimeout: number | null = null;

  // 双保险计时器
  let heartbeatTimer: number | null = null;
  let resizeObserver: ResizeObserver | null = null;

  /**
   * 触发外壳平滑过渡的辅助函数
   * 当发生非玩家直接拖拽的坐标跳变时（比如展开气泡弹开、撞到底部防撞墙弹回），
   * 开启一瞬间的 transition。
   */
  const triggerSmoothSnap = () => {
    isSnapping.value = true;
    if (snappingTimeout !== null) clearTimeout(snappingTimeout);
    // 给 CSS 0.3s 的 transition 时间，然后立刻关闭恢复纯物理 0 延迟态
    snappingTimeout = window.setTimeout(() => {
      isSnapping.value = false;
    }, 300);
  };

  /**
   * 核心边界防线：任何物理位移后、窗口变动后，必须调用此函数进行强行截断收口。
   * @param forceSmooth 是否强制本次拦截发生时带有过渡动画
   */
  const checkBounds = (forceSmooth = false) => {
    if (!statusBarEl.value) return;
    
    const ST_WIN = window.parent || window;
    const viewportWidth = ST_WIN.innerWidth;
    const viewportHeight = ST_WIN.innerHeight;

    // 1. 获取物理尺寸
    const rect = statusBarEl.value.getBoundingClientRect();
    
    let currentWidth = 180; // 默认给 MINI
    let currentHeight = 60;
    
    if (currentUiMode.value === UiMode.FULL) {
      currentWidth = Math.max(rect.width, 400); 
      const maxAllowedHeight = viewportHeight - 80; 
      currentHeight = Math.min(Math.max(rect.height, statusBarEl.value.scrollHeight || 400), maxAllowedHeight);
    } else if (currentUiMode.value === UiMode.BUBBLE) {
      currentWidth = snappedStretchWidth.value;
      currentHeight = 60;
    } else {
      currentWidth = Math.max(rect.width, 180);
      currentHeight = 90; 
    }

    let newX = transformX.value;
    let newY = transformY.value;
    let outOfBounds = false;

    // ==========================================
    // 绝对防飞出物理墙 (Clamping)
    // ==========================================
    
    // 气泡死锁覆盖
    if (isSnappedToEdge.value === 'left') {
      newX = snappedStretchWidth.value; 
      isAnchoredLeft.value = true;
    } else if (isSnappedToEdge.value === 'right') {
      newX = viewportWidth; 
      isAnchoredLeft.value = false;
    }
    // 正常截断
    else {
      // 左墙截断
      if (newX < currentWidth) {
        newX = currentWidth;
        outOfBounds = true;
      }
      // 右墙截断
      if (newX > viewportWidth) {
        newX = viewportWidth;
        outOfBounds = true;
      }
      // 更新锚点朝向推断 (中轴线判断，在左半边就用左锚点，右半边就用右锚点)
      isAnchoredLeft.value = (newX - currentWidth / 2) < (viewportWidth / 2);
    }

    // 上下墙截断 (Y轴)
    if (newY < PHYSICS_CONSTANTS.SAFE_TOP) {
      newY = PHYSICS_CONSTANTS.SAFE_TOP;
      outOfBounds = true;
    }
    
    // 非拖拽时严防沉底
    if (!isDragging) {
      const bottomLimit = viewportHeight - currentHeight - PHYSICS_CONSTANTS.SAFE_MARGIN_BOTTOM;
      if (newY > bottomLimit) {
        newY = Math.max(PHYSICS_CONSTANTS.SAFE_TOP, bottomLimit); // 极端窄屏保上不保下
        outOfBounds = true;
      }
    }

    if (transformX.value !== newX || transformY.value !== newY) {
      // 只有真正发生了物理强制纠正，并且外部要求平滑，才开启回弹动画
      if (forceSmooth || (outOfBounds && !isDragging)) {
        triggerSmoothSnap();
      }
      transformX.value = newX;
      transformY.value = newY;
    }
  };

  const onDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !statusBarEl.value) return;
    e.preventDefault();

    let clientX = 0;
    let clientY = 0;
    if (e.type === 'touchmove') {
      const touch = (e as TouchEvent).touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    const dx = clientX - startX;
    const dy = clientY - startY;

    // 气泡橡皮筋拉扯
    if (isSnappedToEdge.value) {
      const ST_WIN = window.parent || window;
      
      if (isSnappedToEdge.value === 'left') {
        const pullDist = dx; // 往右拉正数
        snappedStretchWidth.value = pullDist > 0 
          ? Math.min(PHYSICS_CONSTANTS.MAX_STRETCH, PHYSICS_CONSTANTS.BUBBLE_WIDTH + pullDist * 0.5)
          : PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        transformX.value = snappedStretchWidth.value; 
      } 
      else if (isSnappedToEdge.value === 'right') {
        const pullDist = -dx; // 往左拉负数转正
        snappedStretchWidth.value = pullDist > 0 
          ? Math.min(PHYSICS_CONSTANTS.MAX_STRETCH, PHYSICS_CONSTANTS.BUBBLE_WIDTH + pullDist * 0.5)
          : PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        transformX.value = ST_WIN.innerWidth;
      }
      transformY.value = initialY + dy;
    } 
    // 正常移动
    else {
      transformX.value = initialX + dx;
      transformY.value = initialY + dy;
    }
  };

  const stopDrag = () => {
    isDragging = false;
    isDraggingState.value = false;
    const ST_DOC = window.parent?.document || document;
    ST_DOC.removeEventListener('mousemove', onDrag);
    ST_DOC.removeEventListener('touchmove', onDrag);
    ST_DOC.removeEventListener('mouseup', stopDrag);
    ST_DOC.removeEventListener('touchend', stopDrag);

    const ST_WIN = window.parent || window;
    const viewportWidth = ST_WIN.innerWidth;

    // --- 松手气泡判定 (拉出一定距离解除气泡) ---
    if (isSnappedToEdge.value) {
      if (snappedStretchWidth.value > PHYSICS_CONSTANTS.STRETCH_RELEASE_THRESHOLD) {
        // 展开悬浮窗
        const edge = isSnappedToEdge.value;
        isSnappedToEdge.value = false;
        // 外部 Vue 根据此修改 UiMode，这里引擎负责将它丢向安全位置
        currentUiMode.value = UiMode.MINI; 
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;

        const currentWidth = 180;
        if (edge === 'left') {
          transformX.value = currentWidth + PHYSICS_CONSTANTS.EXPAND_BOUNCE_MARGIN;
          isAnchoredLeft.value = true;
        } else {
          transformX.value = viewportWidth - PHYSICS_CONSTANTS.EXPAND_BOUNCE_MARGIN; 
          isAnchoredLeft.value = false;
        }
        // 从气泡拉出悬浮时，应该是一个平滑飞出的动作
        triggerSmoothSnap();
      } else {
        // 回弹成气泡
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        if (isSnappedToEdge.value === 'left') transformX.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        if (isSnappedToEdge.value === 'right') transformX.value = viewportWidth;
        // 未拉够，缩回气泡应该是一个平滑回弹
        triggerSmoothSnap();
      }
    } 
    // --- 正常态贴边判定 ---
    else {
      // 只有在 MINI 模式下，才允许贴近边缘时坍缩为气泡！
      // FULL 模式下只是纯物理碰撞拦截（在 checkBounds 中已处理）
      if (currentUiMode.value === UiMode.MINI) {
        const currentWidth = statusBarEl.value?.offsetWidth || 180;
        const distRight = viewportWidth - transformX.value;
        const distLeft = transformX.value - currentWidth;

        let willSnap = false;

        // 右侧极近 -> 气泡化
        if (distRight < PHYSICS_CONSTANTS.HIDE_THRESHOLD) {
          isSnappedToEdge.value = 'right';
          currentUiMode.value = UiMode.BUBBLE;
          transformX.value = viewportWidth;
          snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
          isAnchoredLeft.value = false;
          willSnap = true;
        } 
        // 右侧较近 -> 磁吸对齐
        else if (distRight <= PHYSICS_CONSTANTS.SNAP_ALIGN_THRESHOLD) {
          transformX.value = viewportWidth;
          isAnchoredLeft.value = false;
          willSnap = true;
        } 
        // 左侧极近 -> 气泡化
        else if (distLeft < PHYSICS_CONSTANTS.HIDE_THRESHOLD) {
          isSnappedToEdge.value = 'left';
          currentUiMode.value = UiMode.BUBBLE;
          transformX.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
          snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
          isAnchoredLeft.value = true;
          willSnap = true;
        } 
        // 左侧较近 -> 磁吸对齐
        else if (distLeft <= PHYSICS_CONSTANTS.SNAP_ALIGN_THRESHOLD) {
          transformX.value = currentWidth;
          isAnchoredLeft.value = true;
          willSnap = true;
        }

        // 如果发生了任意方向的吸附或坍缩，平滑滑过去
        if (willSnap) {
          triggerSmoothSnap();
        }
      }
    }

    setTimeout(() => requestAnimationFrame(() => checkBounds(true)), 50);
  };

  const startDrag = (e: MouseEvent | TouchEvent) => {
    // 排除内部操作类按钮干扰拖拽，但保留本身就是把手的气泡指示器
    if ((e.target as HTMLElement).closest('button, .icon-btn') && !(e.target as HTMLElement).closest('.edge-snap-indicator')) {
        return;
    }
    
    isDragging = true;
    isDraggingState.value = true;
    // 一旦摸到屏幕准备拖拽，任何系统产生的平滑回弹必须立刻终止，恢复绝对跟手
    isSnapping.value = false; 
    if (snappingTimeout !== null) clearTimeout(snappingTimeout);
    
    if (e.type === 'touchstart') {
      const touch = (e as TouchEvent).touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    } else {
      startX = (e as MouseEvent).clientX;
      startY = (e as MouseEvent).clientY;
    }

    initialX = transformX.value;
    initialY = transformY.value;

    const ST_DOC = window.parent?.document || document;
    ST_DOC.addEventListener('mousemove', onDrag);
    ST_DOC.addEventListener('touchmove', onDrag, { passive: false });
    ST_DOC.addEventListener('mouseup', stopDrag);
    ST_DOC.addEventListener('touchend', stopDrag);
  };

  const resetPosition = () => {
    const ST_WIN = window.parent || window;
    const viewportWidth = ST_WIN.innerWidth;
    const viewportHeight = ST_WIN.innerHeight;
    
    // 默认回城：右侧偏下
    transformX.value = viewportWidth - 20; 
    transformY.value = Math.max(PHYSICS_CONSTANTS.SAFE_TOP, viewportHeight - 120); 
    
    isSnappedToEdge.value = false;
    isAnchoredLeft.value = false; // 右侧回城，默认归属于右半边锚点
    currentUiMode.value = UiMode.MINI; 
    triggerSmoothSnap();
  };

  onMounted(() => {
    if (statusBarEl.value) {
      resizeObserver = new ResizeObserver(() => {
        if (!isDragging) requestAnimationFrame(() => checkBounds());
      });
      resizeObserver.observe(statusBarEl.value);
    }
    
    heartbeatTimer = window.setInterval(() => {
      if (!isDragging) requestAnimationFrame(() => checkBounds());
    }, 1000);

    resetPosition();
  });

  onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    if (snappingTimeout !== null) clearTimeout(snappingTimeout);
  });

  return {
    transformX,
    transformY,
    isDraggingState,
    isSnapping,
    isSnappedToEdge,
    isAnchoredLeft,
    snappedStretchWidth,
    startDrag,
    resetPosition,
    checkBounds
  };
}