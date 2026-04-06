import { Ref, ref } from 'vue';

// ==========================================
// 物理引擎与动画阈值常量区
// ==========================================
const PHYSICS_CONSTANTS = {
  // --- 触发阈值 ---
  /** 当组件向屏幕外侧推入，距离边缘小于等于此值（负数或极小正数）时，触发收起为胶囊气泡 */
  HIDE_THRESHOLD: -20,
  /** 当组件靠近屏幕边缘，距离小于等于此值时，自动磁吸对齐边缘（但不折叠） */
  SNAP_ALIGN_THRESHOLD: 20,
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

export function useDraggablePhysics(
  statusBarEl: Ref<HTMLElement | null>,
  isMiniMode: Ref<boolean>
) {
  // ---------------------------------------------------------------------------
  // 核心坐标系释义：
  // 这里的坐标系是基于 CSS 的 `right: 0` 锚点建立的（详见 global_statusbar.scss）。
  // - `transformX.value`：代表的是“相比于屏幕右边缘，向左偏移了多少像素”。
  //   * 负值：表示向左偏移（正常在屏幕内的状态）。
  //   * 零或正值：表示向右偏移（贴紧右墙或溢出右墙）。
  // 
  // 动画撕裂的本质妥协：
  // 因为 CSS 锚点死死钉在 `right: 0`，当组件在右侧伸缩时，左边缘自由滑动，动画完美（右边缘固定）。
  // 当组件在左侧伸缩时（比如变宽 400px），为了让它维持在左边缘，我们在 JS 里必须瞬间把 transformX
  // 的负值补偿改大。这种“宽度增加向左走，但 transformX 补偿向右拉”的物理冲突，
  // 配合 CSS transition 贝塞尔曲线的延迟，就会造成不可避免的撕裂感或跳跃。
  // ---------------------------------------------------------------------------
  const transformX = ref(-20); // 负值表示距离右边缘向左的偏移
  const transformY = ref(60);  // 正值表示距离上边缘向下的偏移
  const isDraggingState = ref(false); // 用于拖拽时禁用 transition 以防卡顿
  const isSnappedToEdge = ref<false | 'left' | 'right'>(false);
  const snappedStretchWidth = ref(PHYSICS_CONSTANTS.BUBBLE_WIDTH); // 气泡吸附时的弹性拉伸宽度

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  const checkBounds = () => {
    if (!statusBarEl.value) return;
    const ST_WIN = window.parent || window;
    const viewportWidth = ST_WIN.innerWidth;
    const viewportHeight = ST_WIN.innerHeight;

    // 核心：读取真实物理尺寸，兼容移动端 max-width: 90vw 和 maxHeight 自适应高度
    const rect = statusBarEl.value.getBoundingClientRect();
    const currentWidth = rect.width || (isMiniMode.value ? 180 : 400);
    const currentHeight = rect.height || 60;

    let newX = transformX.value;
    let newY = transformY.value;

    // == 核心防飞出物理墙 ==
    // 无论是否在拖拽，任何情况下（普通模式或重置时），都绝对不能飞出物理屏幕边界！
    // 这个判断必须在所有逻辑之外作为最高优先级的兜底防御。

    // 右边界防线（绝对不允许 > 0，即不允许超出右墙）
    if (newX > 0) newX = 0;

    // 左边界防线（绝对不允许 < 当前组件宽度 - 屏幕宽度）
    // 解释：因为是基于右侧坐标，屏幕最左侧的相对偏移量就是 -(viewportWidth)。
    // 为了不让组件跑到墙外，左边缘能抵达的极限就是 -(viewportWidth) + 组件宽度。
    const minLeftLimit = currentWidth - viewportWidth;
    if (newX < minLeftLimit) newX = minLeftLimit;

    // 气泡模式下的贴边强制修正（防止计算误差漂移或屏幕尺寸突变导致脱落）
    if (isSnappedToEdge.value) {
      if (isSnappedToEdge.value === 'right') {
        newX = 0;
      } else if (isSnappedToEdge.value === 'left') {
        newX = snappedStretchWidth.value - viewportWidth;
      }
    }

    // Y轴顶部边界
    if (newY < PHYSICS_CONSTANTS.SAFE_TOP) newY = PHYSICS_CONSTANTS.SAFE_TOP;

    // Y轴底部边界：利用顶部 Y 坐标 + 真实高度 进行贴底判定，彻底解决底部挤压
    if (!isDragging) { // 拖拽时允许略微下压到底部，松手自动弹回
      if (newY + currentHeight > viewportHeight - PHYSICS_CONSTANTS.SAFE_MARGIN_BOTTOM) {
        newY = viewportHeight - currentHeight - PHYSICS_CONSTANTS.SAFE_MARGIN_BOTTOM;
        // 极端情况兜底：如果屏幕太小导致 newY 被压成负数，优先保上边界
        if (newY < PHYSICS_CONSTANTS.SAFE_TOP) newY = PHYSICS_CONSTANTS.SAFE_TOP;
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

    if (isSnappedToEdge.value) {
      // 气泡模式拉拽：黏在边缘，只拉伸宽度，位置（transformX）死死钉在墙上不动
      if (isSnappedToEdge.value === 'right') {
        // 在右侧（0），向左拉 dx 是负数。
        const pullDist = -dx;
        if (pullDist > 0) {
          snappedStretchWidth.value = Math.min(PHYSICS_CONSTANTS.MAX_STRETCH, PHYSICS_CONSTANTS.BUBBLE_WIDTH + pullDist * 0.5);
        } else {
          snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        }
        transformX.value = 0; // 死锁右侧
      } else if (isSnappedToEdge.value === 'left') {
        // 在左侧，向右拉 dx 是正数。
        const ST_WIN = window.parent || window;
        const pullDist = dx;
        if (pullDist > 0) {
          snappedStretchWidth.value = Math.min(PHYSICS_CONSTANTS.MAX_STRETCH, PHYSICS_CONSTANTS.BUBBLE_WIDTH + pullDist * 0.5);
        } else {
          snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        }
        // 死锁左侧，注意：左侧的极限距离等于当前弹性宽度减去屏幕宽度
        transformX.value = snappedStretchWidth.value - ST_WIN.innerWidth;
      }
      // 允许上下滑动
      transformY.value = initialY + dy;
    } else {
      // 正常模式拉拽
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

    // --- 气泡窗拖拽恢复判定 ---
    if (isSnappedToEdge.value) {
      // 改为通过胶囊当前的“弹性拉伸宽度”来判断是否拉够距离
      const currentStretch = snappedStretchWidth.value;

      if (currentStretch > PHYSICS_CONSTANTS.STRETCH_RELEASE_THRESHOLD) {
        // 拉扯判定成功，展开
        const edge = isSnappedToEdge.value; // 暂存
        isSnappedToEdge.value = false;
        isMiniMode.value = true;
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH; // 重置拉伸
        
        // 展开后给一个离开边缘的默认位置，防止一松手又被磁吸回去
        if (edge === 'right') transformX.value = -PHYSICS_CONSTANTS.EXPAND_BOUNCE_MARGIN;
        else transformX.value = 180 - viewportWidth + PHYSICS_CONSTANTS.EXPAND_BOUNCE_MARGIN; // 假设 mini 宽 180
      } else {
        // 没拉够，弹回初始贴边胶囊形态 (宽32)
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
        if (isSnappedToEdge.value === 'right') transformX.value = 0;
        if (isSnappedToEdge.value === 'left') transformX.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH - viewportWidth;
      }
    }
    // --- 正常模式贴边判定 ---
    else if (isMiniMode.value) {
      const currentWidth = statusBarEl.value?.offsetWidth || 180;
      
      // 距离屏幕边缘的吸附检测 (由于是 based on right:0)
      // 右侧距离就是反转的 transformX 绝对值
      const distRight = -transformX.value;
      // 左侧距离：屏幕宽度 减去 已经偏移掉的部分 减去 自身的宽度
      const distLeft = viewportWidth + transformX.value - currentWidth;

      if (distRight < PHYSICS_CONSTANTS.HIDE_THRESHOLD) {
        isSnappedToEdge.value = 'right';
        transformX.value = 0;
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
      } else if (distRight <= PHYSICS_CONSTANTS.SNAP_ALIGN_THRESHOLD) {
        isSnappedToEdge.value = false;
        transformX.value = 0;
      } else if (distLeft < PHYSICS_CONSTANTS.HIDE_THRESHOLD) {
        isSnappedToEdge.value = 'left';
        // 必须减去自身的宽度才能真正贴紧屏幕左边缘
        transformX.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH - viewportWidth;
        snappedStretchWidth.value = PHYSICS_CONSTANTS.BUBBLE_WIDTH;
      } else if (distLeft <= PHYSICS_CONSTANTS.SNAP_ALIGN_THRESHOLD) {
        isSnappedToEdge.value = false;
        transformX.value = currentWidth - viewportWidth;
      }
    }

    // 延后一帧检测最后绝对物理边界
    setTimeout(() => requestAnimationFrame(() => checkBounds()), 50);
  };

  const startDrag = (e: MouseEvent | TouchEvent) => {
    // 如果是按钮或控件则不拖拽。但如果是气泡指示器（.edge-snap-indicator），允许它作为拖拽把手。
    if ((e.target as HTMLElement).closest('button, .icon-btn')) return;
    
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
    transformX.value = -20;
    transformY.value = Math.max(40, ST_WIN.innerHeight - 400); // 默认在右下角偏上的位置
  };

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
