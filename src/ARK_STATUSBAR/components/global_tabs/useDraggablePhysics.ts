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
  /** 当组件距离屏幕左/右边缘小于等于此值时，触发贴边磁吸 */
  SNAP_ALIGN_THRESHOLD: 40, 
  /** 仅在 MINI 模式下，靠近屏幕边缘小于此值，触发收起为胶囊气泡模式 */
  HIDE_THRESHOLD: 10,   
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
  // 对外暴露的边缘吸附状态，决定是否渲染成气泡
  const isSnappedToEdge = ref<false | 'left' | 'right'>(false);
  // 气泡模式下的弹性拉伸宽度 (橡皮筋效果)
  const snappedStretchWidth = ref(PHYSICS_CONSTANTS.BUBBLE_WIDTH);

  // 内部拖拽暂存
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  // 双保险计时器
  let heartbeatTimer: number | null = null;
  let resizeObserver: ResizeObserver | null = null;

  /**
   * 核心边界防线：任何物理位移后、窗口变动后，必须调用此函数进行强行截断收口。
   */
  const checkBounds = () => {
    if (!statusBarEl.value) return;
    
    const ST_WIN = window.parent || window;
    const viewportWidth = ST_WIN.innerWidth;
    const viewportHeight = ST_WIN.innerHeight;

    // 1. 获取物理尺寸
    // 这里如果直接用 `getBoundingClientRect()` 会在 CSS transition (0.3s) 期间拿到极小的错误中间态。
    // 因此我们根据当前的 `UiMode`，给出合理的、保守的“最大物理占地”预判。
    const rect = statusBarEl.value.getBoundingClientRect();
    
    let currentWidth = 180; // 默认给 MINI
    let currentHeight = 60;
    
    if (currentUiMode.value === UiMode.FULL) {
      // FULL 模式下，宽度大概率是 400（受配置控制），高度是内部元素撑开或 max-height(100vh-80px)
      currentWidth = Math.max(rect.width, 400); 
      // 真实最大可能的高度：取容器 scrollHeight 和视窗硬性天花板的较小者，决不信任动画中间态
      const maxAllowedHeight = viewportHeight - 80; 
      currentHeight = Math.min(Math.max(rect.height, statusBarEl.value.scrollHeight || 400), maxAllowedHeight);
    } else if (currentUiMode.value === UiMode.BUBBLE) {
      currentWidth = snappedStretchWidth.value;
      currentHeight = 60;
    } else {
      // MINI 模式
      currentWidth = Math.max(rect.width, 180);
      currentHeight = 90; // 考虑可能有一两条预警，略微放宽到底部 90
    }

    let newX = transformX.value;
    let newY = transformY.value;

    // ==========================================
    // 绝对防飞出物理墙 (Clamping)
    // ==========================================
    
    // 气泡死锁覆盖
    if (isSnappedToEdge.value === 'left') {
      newX = snappedStretchWidth.value; 
    } else if (isSnappedToEdge.value === 'right') {
      newX = viewportWidth; 
    }
    // 正常截断
    else {
      if (newX < currentWidth) newX = currentWidth; // 左墙
      if (newX > viewportWidth) newX = viewportWidth; // 右墙
    }

    // 上下墙截断 (Y轴)
    if (newY < PHYSICS_CONSTANTS.SAFE_TOP) {
      newY = PHYSICS_CONSTANTS.SAFE_TOP;
    }
    
    // 非拖拽时严防沉底
    if (!isDragging) {
      const bottomLimit = viewportHeight - currentHeight - PHYSICS_CONSTANTS.SAFE_MARGIN_BOTTOM;
      if (newY > bottomLimit) {
        newY = Math.max(PHYSICS_CONSTANTS.SAFE_TOP, bottomLimit); // 极端窄屏保上不保下
      }
    }

    if (transformX.value !== newX) transformX.value = newX;
    if (transformY.value !== newY) transformY.value = newY;
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
        } else {
          transformX.value = viewportWidth - PHYSICS_CONSTANTS.EXPAND_BOUNCE_MARGIN; 
        }
      } else {
        // 回弹成气泡
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        if (isSnappedToEdge.value === 'left') transformX.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        if (isSnappedToEdge.value === 'right') transformX.value = viewportWidth;
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

        // 右侧极近 -> 气泡化
        if (distRight < PHYSICS_CONSTANTS.HIDE_THRESHOLD) {
          isSnappedToEdge.value = 'right';
          currentUiMode.value = UiMode.BUBBLE;
          transformX.value = viewportWidth;
          snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        } 
        // 右侧较近 -> 磁吸对齐
        else if (distRight <= PHYSICS_CONSTANTS.SNAP_ALIGN_THRESHOLD) {
          transformX.value = viewportWidth;
        } 
        // 左侧极近 -> 气泡化
        else if (distLeft < PHYSICS_CONSTANTS.HIDE_THRESHOLD) {
          isSnappedToEdge.value = 'left';
          currentUiMode.value = UiMode.BUBBLE;
          transformX.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
          snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        } 
        // 左侧较近 -> 磁吸对齐
        else if (distLeft <= PHYSICS_CONSTANTS.SNAP_ALIGN_THRESHOLD) {
          transformX.value = currentWidth;
        }
      }
    }

    setTimeout(() => requestAnimationFrame(() => checkBounds()), 50);
  };

  const startDrag = (e: MouseEvent | TouchEvent) => {
    // 排除内部操作类按钮干扰拖拽，但保留本身就是把手的气泡指示器
    if ((e.target as HTMLElement).closest('button, .icon-btn') && !(e.target as HTMLElement).closest('.edge-snap-indicator')) {
        return;
    }
    
    isDragging = true;
    isDraggingState.value = true;
    
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
    currentUiMode.value = UiMode.MINI; 
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
  });

  return {
    transformX,
    transformY,
    isDraggingState,
    isSnappedToEdge,
    snappedStretchWidth,
    startDrag,
    resetPosition,
    checkBounds
  };
}