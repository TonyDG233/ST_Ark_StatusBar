# UI 动画极致平滑终极方案：动态坐标系反转与双向抽屉门模型

**日期**：2026-04-09
**状态**：待审阅 (Awaiting Approval)
**目标**：彻底解决 UI 动画撕裂、左右侧吸附锚点干涉、展开“高跷”等视觉顽疾。满足 PPT 级平滑动画要求。不使用居中方案，而是彻底修复并升级现有双层架构。

---

## 1. 核心矛盾复盘（为什么之前的修改会飞出或撕裂）

通过对过去十几天沙盒演进和昨晚修改失败的反思，根本问题在于我们试图让**“两套坐标系”强行融合**。

1.  **物理层的强制“绝对右上角”**：`useDraggablePhysics` 中的 `transformX`，其数值含义是 `(当前组件的左边缘 + 组件自身宽度) 距离屏幕左边缘的像素距离`。
2.  **UI 层的 CSS 相对锚定**：我们给 Vue 中的 `.ark-global-statusbar` 设置了 `style="position: absolute; right: 0;"`。这代表内部的蓝色盒子，其右边缘紧贴物理外壳（它本身就是一个只提供坐标没有宽高的幽灵壳）的右边缘。

**在屏幕右侧吸附时**，这套逻辑完美：
*   物理壳移动到 `transformX = viewportWidth` (比如 1920)。
*   内层宽度从 180px 变成 32px (气泡窗)。
*   因为内层是 `right: 0`，所以它靠着 1920 这个点，往左缩。视觉上是“从左侧收回墙内”。完美。

**灾难发生在屏幕左侧吸附时**：
*   如果试图强行让它吸附左墙，物理引擎会把 `transformX` 设为 32px（气泡宽度）。
*   此时如果内层依旧是 `right: 0`，内层就靠在 32px 处往左伸展，刚好停靠在左墙 0~32px 处。**这似乎是好的。**
*   **但是，一旦我们要从气泡窗（32px）展开到正常面板（400px）！**
    *   物理引擎说：“我不管，我只负责外壳右边缘，现在你要变成宽 400px，那你得让 `transformX` 变成 400px，这样你的左边才能刚好不离开左墙。” => 于是物理外壳花 0.3s 把 `transformX` 从 32 挪到 400。
    *   此时，内壳说：“我也开始拉伸我的 CSS Width 从 32 变成 400。而且我是 `right: 0` 绑定的！” => 于是内壳试图向左伸展。
    *   **结果**：物理外壳向右跑，内壳向左拉，两个动画瞬间对抗。视觉上，这就是你看到的“从屏幕中间飞过来”或者“左侧气泡直接飞到屏幕中央”的撕裂惨状。

你之前试图将 `right: 0` 改为 `left: 0` 来解决，结果直接崩溃，因为物理引擎的核心变量 `transformX` 的根本定义并没有发生改变，物理壳和内层壳彻底失去了对齐基准。

---

## 2. 破局思路：抛弃死硬，引入真正的【动态翻转坐标系】 (Dual-Coordinate System)

既然单向的右上角模型无法驾驭屏幕两侧的对称生长动画，我们就必须赋予物理引擎“左右互搏”的智慧。

我将用最简单的语言描述如何修改：

### 2.1 物理引擎 `useDraggablePhysics.ts` 的改造

我们不再仅仅抛出一个干瘪的 `transformX`，而是将整个坐标计算系统“一劈为二”。

*   **新增一个核心变量：`currentAnchor` (当前锚定点，值为 'left' 或 'right')。**
    当用户拖拽组件越过屏幕中轴线时，这个值动态改变。如果在左半边，就是 'left'；如果在右半边，就是 'right'。
*   **不再死守 `transformX`，改为暴露两个互斥的物理坐标**：
    *   `transformLeft`: 当 `currentAnchor === 'left'` 时生效。它代表**组件左边缘**距离屏幕左侧的像素值。
    *   `transformRight`: 当 `currentAnchor === 'right'` 时生效。它代表**组件右边缘**距离屏幕右侧的像素值。
    *   (当其中一个生效时，另一个给 `auto`)。
*   **拖拽(`onDrag`)和吸附计算的重写**：
    拖拽时，如果是左锚点，我们就用鼠标移动距离去加减 `transformLeft`；如果是右锚点，就去加减 `transformRight`。
    左侧吸附时，就是 `transformLeft = 0`。右侧吸附时，就是 `transformRight = 0`。再也不需要去计算什么屏幕宽度减去组件宽度的复杂数学题了。

### 2.2 UI 渲染层 `GlobalStatusBar.vue` 的终极对接

这是最美妙的地方。当物理层输出了这样完美的隔离参数后，Vue 模板只需要无脑绑定即可：

```vue
<!-- 物理外壳：不再是 translate，而是绝对的 left 或 right 定位 -->
<div class="ark-global-statusbar-shell"
     style="position: fixed; top: ...;"
     :style="{
       left: currentAnchor === 'left' ? `${transformLeft}px` : 'auto',
       right: currentAnchor === 'right' ? `${transformRight}px` : 'auto',
       /* 如果有碰撞，加上阻尼平滑动画 */
       transition: isSnapping ? 'left 0.3s, right 0.3s, top 0.3s' : 'none'
     }">

    <!-- 内层视觉容器：彻底释放！ -->
    <!-- 它不需要去关心 left:0 还是 right:0 了！ -->
    <div class="ark-global-statusbar"
         :style="{
           /* 靠哪边墙，就在哪边扎根生长！这决定了内部元素伸缩的方向 */
           'transform-origin': currentAnchor === 'left' ? 'left top' : 'right top',
           /* 宽度变化交由 CSS 自己去 transition */
           width: ...
         }">
```

**为什么这能解决撕裂？（抽屉门模型）**
想象一个挂在两边墙上的抽屉。
当你把它挂在左边墙上（`currentAnchor = 'left'`, 物理外壳的 `left` = 0 固定不动）。
当你展开为 FULL 模式时，内壳宽度从 180px 变成 400px。
因为外壳固定在左边 `0` 没动，内壳又有了 `transform-origin: left top`，浏览器会自动让这个盒子从左向右平滑拉长。物理外壳完全不需要参与“右边缘往哪里挪”这种荒谬的计算。反之亦然。

---

## 3. 解决“高跷拉伸”的方案（CSS Grid 0fr 法）

对于你提到的展开时“高度瞬间撑满，再弹回本来高度”，我们需要放弃 `isTransitioningMode` 这种通过 JS 定时器来延迟高度出现的“脏套路”。

**我们将使用纯 CSS 方案（Grid 平滑高度法）：**
在 `GlobalStatusBar.vue` 的 `<style>` 中，重构内容包裹容器：

```css
/* 建立一个可以进行高度缓动的包裹器 */
.statusbar-content-wrapper {
  display: grid;
  grid-template-rows: 0fr; /* 默认闭合 */
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* 当处于 FULL 模式时，展开为实际内容高度 */
.statusbar-content-wrapper.is-full {
  grid-template-rows: 1fr;
}

/* 里面的实际内容，必须设为 min-height: 0 防止溢出 */
.statusbar-content-inner {
  min-height: 0;
  /* 加入你的全尺寸内容淡入动画 */
  animation: fadeIn 0.3s ease forwards; 
}
```
**效果：**
当从 MINI 切换到 FULL，宽度开始伸展的同时，高度不会瞬间爆撑到最大值。而是因为 Grid 的 `0fr -> 1fr` 机制，浏览器会自动计算好最终内容所占的高度，并让高度也进行 0.3s 的**平滑抽屉展开**。

---

## 4. 实施承诺

如果你同意这套【**动态左右坐标翻转引擎 + Grid平滑高度**】方案。
我将只需执行两次修改：
1. 用 `write_to_file` 彻底重构 `useDraggablePhysics.ts`，将所有数学逻辑重构为基于 `left/right` 双坐标体系。
2. 用 `write_to_file` 将 `GlobalStatusBar.vue` 与新的坐标系对齐，并加入 Grid CSS。

这并不是退回沙盒版的“居中盲目妥协”，而是一次彻底治愈双边对齐痼疾的架构手术。请审阅。