import { onMounted, onUnmounted, Ref, ref } from 'vue';

// 全局唯一的 UI 状态机
export enum UiMode {
  FULL = 'FULL', // 完全展开状态 (拥有 Tab 等完整功能)
  MINI = 'MINI', // 折叠小窗状态 (只显示一条/列表概览)
  BUBBLE = 'BUBBLE', // 隐藏气泡状态 (贴边吸附，仅显示一个把手)
}

// 物理引擎常量区
export const PHYSICS_CONSTANTS = {
  // --- 触发阈值 ---
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
  EXPAND_BOUNCE_MARGIN: 20,
  /** 屏幕顶部安全距离防撞墙 */
  SAFE_TOP: 25,
  /** 屏幕底部安全距离防撞墙（配合真实高度检测，防止底部挤压） */
  SAFE_MARGIN_BOTTOM: 30,
};

/**
 * 拖拽与边界物理引擎 Hook (v2.0 双轨锚点版)
 *
 * 职责：接管所有的 `mousedown/touchstart` 等原生 DOM 拖拽事件。
 * 输出：根据组件所在的屏幕半区，动态输出 `transformLeft` 或 `transformRight` 绝对坐标。
 */
export function useDraggablePhysics(statusBarEl: Ref<HTMLElement | null>, currentUiMode: Ref<UiMode>) {
  // =========================================================================
  // 【核心升级】：动态双轨坐标系
  // 不再死守单一的 transformX，而是根据当前所在的屏幕半区，动态决定输出哪个坐标。
  // 这彻底解开了 CSS 中 right:0 或 left:0 带来的相反伸长方向拉扯死锁。
  // =========================================================================
  const currentAnchor = ref<'left' | 'right'>('right');
  const transformLeft = ref(0);
  const transformRight = ref(20); // 默认右侧起步
  const transformY = ref(0);

  // 对外暴露的拖拽中状态，供 Vue 层增加 `.is-dragging` 类名禁用 CSS Transition 以保证帧率
  const isDraggingState = ref(false);
  const isSnapping = ref(false);

  // 对外暴露的边缘吸附状态，决定是否渲染成气泡
  const isSnappedToEdge = ref<false | 'left' | 'right'>(false);

  // 气泡模式下的弹性拉伸宽度 (橡皮筋效果)
  const snappedStretchWidth = ref(PHYSICS_CONSTANTS.BUBBLE_WIDTH);

  // 内部拖拽暂存 (基于 clientX/clientY 绝对坐标)
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialRight = 0;
  let initialY = 0;
  let snappingTimeout: number | null = null;

  // 双保险计时器
  let heartbeatTimer: number | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const triggerSmoothSnap = () => {
    isSnapping.value = true;
    if (snappingTimeout !== null) clearTimeout(snappingTimeout);
    snappingTimeout = window.setTimeout(() => {
      isSnapping.value = false;
    }, 300);
  };

  /**
   * 辅助函数：根据当前的窗口宽度和组件宽度，安全地在左右锚点之间同步数据。
   */
  const syncAnchors = (viewportWidth: number, componentWidth: number) => {
    if (currentAnchor.value === 'right') {
      transformLeft.value = viewportWidth - transformRight.value - componentWidth;
    } else {
      transformRight.value = viewportWidth - transformLeft.value - componentWidth;
    }
  };

  /**
   * 核心边界防线
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
      // 修复移动端震荡 Bug：CSS 限制了 max-width: 90vw。
      // 绝对不能用 Math.max(rect.width, 400) 锁死下限，因为玩家可能会手动缩窄 UI 到 300px 以下。
      // 只有在初始挂载阶段 (rect.width 极小) 时才用 400 兜底。
      const maxAllowedWidth = viewportWidth * 0.9;
      const actualWidth = rect.width > 50 ? rect.width : 400;
      currentWidth = Math.min(actualWidth, maxAllowedWidth);

      const maxAllowedHeight = viewportHeight - 80;
      currentHeight = Math.min(Math.max(rect.height, statusBarEl.value.scrollHeight || 400), maxAllowedHeight);
    } else if (currentUiMode.value === UiMode.BUBBLE) {
      currentWidth = snappedStretchWidth.value;
      currentHeight = 60;
    } else {
      // MINI 模式下：抛弃写死的 180 像素限制，允许随着 font-size 缩小（兜底由设备宽度预估）
      const fallbackWidth = viewportWidth <= 768 ? 156 : 182;
      currentWidth = rect.width > 50 ? rect.width : fallbackWidth;
      currentHeight = 90;
    }

    // 每次计算前，先互相拉平两个锚点的绝对值
    syncAnchors(viewportWidth, currentWidth);

    let newLeft = transformLeft.value;
    let newRight = transformRight.value;
    let newY = transformY.value;
    let outOfBounds = false;

    // ==========================================
    // 绝对防飞出物理墙 (Clamping)
    // ==========================================

    // 气泡死锁覆盖
    if (isSnappedToEdge.value === 'left') {
      newLeft = 0;
      currentAnchor.value = 'left';
    } else if (isSnappedToEdge.value === 'right') {
      newRight = 0;
      currentAnchor.value = 'right';
    }
    // 正常截断与锚点移交
    else {
      // 避免当组件宽度大于或等于屏幕宽度时出现左右锚点死循环震荡
      if (currentWidth >= viewportWidth - 10) {
        currentAnchor.value = 'left';
        newLeft = 0;
        newRight = Math.max(0, viewportWidth - currentWidth);
        outOfBounds = true;
      } else {
        // 通过中心点判断应该交给谁管辖
        const centerX = newLeft + currentWidth / 2;
        const isLeftHalf = centerX < viewportWidth / 2;
        currentAnchor.value = isLeftHalf ? 'left' : 'right';

        // 撞墙检测
        if (newLeft < 0) {
          newLeft = 0;
          outOfBounds = true;
        }
        if (newRight < 0) {
          newRight = 0;
          outOfBounds = true;
        }
      }
    }

    // 同步确保另一个锚点也是正确的，即使我们在边缘截断了
    if (currentAnchor.value === 'left') {
      newRight = viewportWidth - newLeft - currentWidth;
    } else {
      newLeft = viewportWidth - newRight - currentWidth;
    }

    // 上下墙截断 (Y轴)
    if (newY < PHYSICS_CONSTANTS.SAFE_TOP) {
      newY = PHYSICS_CONSTANTS.SAFE_TOP;
      outOfBounds = true;
    }

    // 非拖拽时严防沉底
    if (!isDraggingState.value) {
      const bottomLimit = viewportHeight - currentHeight - PHYSICS_CONSTANTS.SAFE_MARGIN_BOTTOM;
      if (newY > bottomLimit) {
        newY = Math.max(PHYSICS_CONSTANTS.SAFE_TOP, bottomLimit);
        outOfBounds = true;
      }
    }

    if (transformLeft.value !== newLeft || transformRight.value !== newRight || transformY.value !== newY) {
      if (forceSmooth || (outOfBounds && !isDraggingState.value)) {
        triggerSmoothSnap();
      }
      transformLeft.value = newLeft;
      transformRight.value = newRight;
      transformY.value = newY;
    }
  };

  const onDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDraggingState.value || !statusBarEl.value) return;
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
      if (isSnappedToEdge.value === 'left') {
        const pullDist = dx; // 往右拉正数
        snappedStretchWidth.value =
          pullDist > 0
            ? Math.min(PHYSICS_CONSTANTS.MAX_STRETCH, PHYSICS_CONSTANTS.BUBBLE_WIDTH + pullDist * 0.5)
            : PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        transformLeft.value = 0;
      } else if (isSnappedToEdge.value === 'right') {
        const pullDist = -dx; // 往左拉负数转正
        snappedStretchWidth.value =
          pullDist > 0
            ? Math.min(PHYSICS_CONSTANTS.MAX_STRETCH, PHYSICS_CONSTANTS.BUBBLE_WIDTH + pullDist * 0.5)
            : PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        transformRight.value = 0;
      }
      transformY.value = initialY + dy;
    }
    // 正常移动 (只更新当前管辖的锚点，在 checkBounds 中统一同步)
    else {
      if (currentAnchor.value === 'left') {
        transformLeft.value = initialLeft + dx;
      } else {
        // 向右移 dx 是正，但距离右边缘其实是变小，所以是减去
        transformRight.value = initialRight - dx;
      }
      transformY.value = initialY + dy;

      // 实时切换锚点归属权，让跟手更丝滑
      const ST_WIN = window.parent || window;
      const currentWidth = statusBarEl.value.offsetWidth || 180;
      syncAnchors(ST_WIN.innerWidth, currentWidth); // 互相同步
      const centerX = transformLeft.value + currentWidth / 2;
      currentAnchor.value = centerX < ST_WIN.innerWidth / 2 ? 'left' : 'right';
    }
  };

  const stopDrag = () => {
    isDraggingState.value = false;
    const ST_DOC = window.parent?.document || document;
    ST_DOC.removeEventListener('mousemove', onDrag);
    ST_DOC.removeEventListener('touchmove', onDrag);
    ST_DOC.removeEventListener('mouseup', stopDrag);
    ST_DOC.removeEventListener('touchend', stopDrag);

    // --- 松手气泡判定 (拉出一定距离解除气泡) ---
    if (isSnappedToEdge.value) {
      if (snappedStretchWidth.value > PHYSICS_CONSTANTS.STRETCH_RELEASE_THRESHOLD) {
        // 展开悬浮窗
        const edge = isSnappedToEdge.value;
        isSnappedToEdge.value = false;
        currentUiMode.value = UiMode.MINI;
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;

        if (edge === 'left') {
          transformLeft.value = PHYSICS_CONSTANTS.EXPAND_BOUNCE_MARGIN;
          currentAnchor.value = 'left';
        } else {
          transformRight.value = PHYSICS_CONSTANTS.EXPAND_BOUNCE_MARGIN;
          currentAnchor.value = 'right';
        }
        triggerSmoothSnap();
      } else {
        // 回弹成气泡
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        if (isSnappedToEdge.value === 'left') transformLeft.value = 0;
        if (isSnappedToEdge.value === 'right') transformRight.value = 0;
        triggerSmoothSnap();
      }
    }
    // --- 正常态贴边判定 ---
    else {
      if (currentUiMode.value === UiMode.MINI) {
        const distRight = transformRight.value;
        const distLeft = transformLeft.value;

        let willSnap = false;

        // 右侧极近 -> 气泡化
        if (distRight < PHYSICS_CONSTANTS.HIDE_THRESHOLD) {
          isSnappedToEdge.value = 'right';
          currentUiMode.value = UiMode.BUBBLE;
          transformRight.value = 0;
          snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
          currentAnchor.value = 'right';
          willSnap = true;
        }
        /*
         * 根据用户要求注释：由于吸附边缘（而非拽入边缘进入气泡状态）的逻辑会在 UI 被动展开时
         * 产生边界死锁，导致后续无法拖拽 UI，因此暂时移除被动贴边的物理效果。
         */
        // // 右侧较近 -> 磁吸对齐
        // else if (distRight <= PHYSICS_CONSTANTS.SNAP_ALIGN_THRESHOLD) {
        //   transformRight.value = 0;
        //   currentAnchor.value = 'right';
        //   willSnap = true;
        // }
        // 左侧极近 -> 气泡化
        else if (distLeft < PHYSICS_CONSTANTS.HIDE_THRESHOLD) {
          isSnappedToEdge.value = 'left';
          currentUiMode.value = UiMode.BUBBLE;
          transformLeft.value = 0;
          snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
          currentAnchor.value = 'left';
          willSnap = true;
        }
        // // 左侧较近 -> 磁吸对齐
        // else if (distLeft <= PHYSICS_CONSTANTS.SNAP_ALIGN_THRESHOLD) {
        //   transformLeft.value = 0;
        //   currentAnchor.value = 'left';
        //   willSnap = true;
        // }

        if (willSnap) {
          triggerSmoothSnap();
        }
      }
    }

    setTimeout(() => requestAnimationFrame(() => checkBounds(true)), 50);
  };

  const startDrag = (e: MouseEvent | TouchEvent) => {
    if (
      (e.target as HTMLElement).closest('button, .icon-btn') &&
      !(e.target as HTMLElement).closest('.edge-snap-indicator')
    ) {
      return;
    }

    // 斩断浏览器原生 HTML5 拖放 (Ghost Image) 和文本选中行为
    if (e.type === 'mousedown') {
      e.preventDefault();
    }

    isDraggingState.value = true;
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

    // 同步一次当前的真实位置作为拖拽基准
    if (statusBarEl.value) {
      const ST_WIN = window.parent || window;
      syncAnchors(ST_WIN.innerWidth, statusBarEl.value.offsetWidth || 180);
    }

    initialLeft = transformLeft.value;
    initialRight = transformRight.value;
    initialY = transformY.value;

    const ST_DOC = window.parent?.document || document;
    ST_DOC.addEventListener('mousemove', onDrag);
    ST_DOC.addEventListener('touchmove', onDrag, { passive: false });
    ST_DOC.addEventListener('mouseup', stopDrag);
    ST_DOC.addEventListener('touchend', stopDrag);
  };

  const resetPosition = () => {
    const ST_WIN = window.parent || window;
    const viewportHeight = ST_WIN.innerHeight;

    // 默认回城：右侧偏下
    currentAnchor.value = 'right';
    transformRight.value = 20;
    transformY.value = Math.max(PHYSICS_CONSTANTS.SAFE_TOP, viewportHeight - 120);

    isSnappedToEdge.value = false;
    currentUiMode.value = UiMode.MINI;
    triggerSmoothSnap();
  };

  onMounted(() => {
    if (statusBarEl.value) {
      resizeObserver = new ResizeObserver(() => {
        if (!isDraggingState.value) requestAnimationFrame(() => checkBounds());
      });
      resizeObserver.observe(statusBarEl.value);
    }

    heartbeatTimer = window.setInterval(() => {
      if (!isDraggingState.value) requestAnimationFrame(() => checkBounds());
    }, 1000);

    resetPosition();
  });

  onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect();
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    if (snappingTimeout !== null) clearTimeout(snappingTimeout);
  });

  return {
    currentAnchor,
    transformLeft,
    transformRight,
    transformY,
    isDraggingState,
    isSnapping,
    isSnappedToEdge,
    snappedStretchWidth,
    startDrag,
    resetPosition,
    checkBounds,
  };
}
