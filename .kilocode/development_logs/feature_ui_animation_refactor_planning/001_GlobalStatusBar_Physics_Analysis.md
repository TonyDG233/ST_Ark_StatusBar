# GlobalStatusBar 物理层 (拖拽与边缘检测) 代码分析

**文件:** `src/ARK_STATUSBAR/components/GlobalStatusBar.vue`

## 1. 核心状态与响应式变量 (State)

```typescript
const transformX = ref(0);
const transformY = ref(0);
let isDragging = false;
let startX = 0;
let startY = 0;
let initialX = 0;
let initialY = 0;
```
*   **机制**: `transformX` 和 `transformY` 作为响应式变量，直接绑定至根 DOM 节点的内联样式 `style="transform: translate(x, y)"`。
*   **缺陷**: `transform` 偏移量是建立在 CSS 的硬编码绝对定位 (`bottom: 60px; right: 20px;`) 之上的。位移计算使用的是基于左上角的系统坐标系 (`clientX/Y`)，这导致视图坐标与 CSS 原点坐标逻辑撕裂。

---

## 2. 拖拽初始化：`startDrag(e: MouseEvent | TouchEvent)`

*   **输入**: 鼠标按下 (`mousedown`) 或触摸开始 (`touchstart`) 事件。
*   **内部逻辑**:
    1.  开启标识: `isDragging = true`。
    2.  抽取坐标: 从事件对象中提取出 `clientX` 与 `clientY`，缓存至 `startX` 和 `startY`。
    3.  快照留存: 提取当前的 `transformX/Y.value` 缓存至 `initialX/Y`。
    4.  **副作用 (Side Effect)**: 获取宿主 `window.parent.document` (或当前 `document`)，向其全屏注册 `mousemove/touchmove` 以及 `mouseup/touchend` 全局事件。

---

## 3. 位移计算：`onDrag(e: MouseEvent | TouchEvent)`

*   **输入**: 鼠标移动 (`mousemove`) 或触摸移动 (`touchmove`) 事件。
*   **内部逻辑**:
    1.  拦截检查: 若 `!isDragging` 为真，则提前 `return`。
    2.  事件阻断: 调用 `e.preventDefault()` 防止滚动或拖拽选中文本。
    3.  增量计算: 取出实时 `clientX/clientY`，计算差值：`dx = clientX - startX`, `dy = clientY - startY`。
    4.  响应式赋值: `transformX.value = initialX + dx`, `transformY.value = initialY + dy`。
*   **逻辑缺陷**: 函数内部**无任何边界防御计算**。在鼠标拖拽按住不放期间，可以强行将组件完全拖出视窗之外。

---

## 4. 拖拽终止：`stopDrag()`

*   **输入**: 无参（由绑定的全局事件触发）。
*   **内部逻辑**:
    1.  关闭标识: `isDragging = false`。
    2.  副作用清理: 调用 `removeEventListener` 清理之前挂载在宿主 `document` 上的全部拖拽相关监听器。
    3.  **触发防御 (Deferred Execution)**: 使用 `requestAnimationFrame(() => checkBounds())`，将碰撞计算推迟至下一个重绘帧前执行。

---

## 5. 核心物理引擎：`checkBounds()`

*   **输入**: 无参。
*   **内部逻辑**:
    1.  提取包围盒: 调用 `statusBarEl.value.getBoundingClientRect()` 提取组件在浏览器内的真实几何尺寸与坐标 (`rect`)。
    2.  提取视窗大小: 取 `window.innerWidth` 与 `innerHeight` 作为绝对边界。
    3.  **溢出补偿计算**:
        *   右侧: `if (rect.right > viewportWidth) deltaX = viewportWidth - rect.right;`
        *   左侧: 经过右侧补偿后，基于 `rect.left + deltaX` 判断。若 `< 0` 则 `deltaX = -rect.left`。
        *   底部: `if (rect.bottom > viewportHeight) deltaY = viewportHeight - rect.bottom;`
        *   顶部: 设定 `SAFE_TOP = 70`。基于 `rect.top + deltaY` 判定。若 `< SAFE_TOP` 则 `deltaY = SAFE_TOP - rect.top`。
    4.  位移突变: 当 `deltaX` 或 `deltaY` 不为 0 时，将其直接加算到 `transformX/Y.value`。
*   **架构级缺陷**: 强依赖真实的渲染 `BoundingClientRect`。当 Vue 的 UI 层发生宽度或高度变化（如 `v-if` 显示了子组件，或 `width` 改变），且伴随任何形式的 CSS `transition` 渐变动画时，`getBoundingClientRect()` 提取的是处于过度中的“中间态”。这导致修正值 `delta` 持续闪跳，物理坐标与 CSS 动画引擎形成互锁和抽搐。

---

## 6. 尺寸自适应防线：`ResizeObserver`

*   **内部逻辑**:
    *   在 `onMounted` 中初始化：`new ResizeObserver(() => requestAnimationFrame(() => checkBounds()));`
    *   监听目标：`statusBarEl.value`。
*   **冲突分析**:
    当 `isMiniMode` 在 `true` 与 `false` 之间切换，导致宽度从 `180px` 骤增为 `400px` 时。由于右下角 CSS 定位的机制，宽度的增长等同于左侧 `rect.left` 的延伸。
    如果此时组件靠左停放，左侧瞬间溢出。`ResizeObserver` 捕捉到尺寸变动，触发 `checkBounds`，产生一个极大的 `deltaX` 强行将组件推向右侧。
    视觉上表现为：**组件向左伸展的同时被一股巨力向右推移的撕裂感。**