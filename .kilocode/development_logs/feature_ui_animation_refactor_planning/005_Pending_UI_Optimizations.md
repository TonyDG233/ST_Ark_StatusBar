# GlobalStatusBar 后续 UI 优化执行清单

**日期**：2026-04-09
**目标**：在双层 DOM 架构和绝对物理挂载已经跑通的基础上，针对使用手感和视觉体验的 4 个待修复项，明确最终在 `GlobalStatusBar.vue` 上的代码落实方案。

---

## 1. 移除双击归位功能
**原因**：双击头部极易误触 SillyTavern 侧边栏，且归位到右下角的行为不再被需要。
**修改点**：
- 在 `GlobalStatusBar.vue` 模板的 `.statusbar-header` 节点上。
- **删除** `@dblclick="resetPosition"` 事件绑定。

---

## 2. 解决 MINI 切换为 FULL 时的“高跷”拉伸异常
**原因**：当从 MINI 模式展开为 FULL 模式时，Vue 将长列表（拦截预警、设置等内容）的 `display: none` 解除，导致容器高度瞬间被撑满到 400px 最大值。但宽度的过渡动画需要 0.3s 才能完成，导致面板在 0.3s 内呈现出又高又窄的“高跷”怪异感。
**修改点**：
- 在 `GlobalStatusBar.vue` 的 `<style scoped>` 底部新增优化补充区。
- **给内层容器补回高度过渡**：在 `.ark-global-statusbar` 的 `transition` 列表中，增加 `max-height 0.3s cubic-bezier(...)`。
- **强制内容淡入**：新增 `.full-content-fade` 类，为 `.statusbar-tabs` 和 `.statusbar-content` 这两个巨大的内部块添加 `animation: fadeInContent 0.3s ease forwards`，让它在宽度展开的同时慢慢浮现，不再瞬间撑破骨架。

---

## 3. 外层物理壳增加平滑撞墙/回弹过渡
**原因**：`useDraggablePhysics.ts` 中已经暴露了 `isSnapping` 临时状态（在组件碰壁被强行拦截，或者气泡回弹时为 `true`）。但外壳目前还没有消费这个状态，导致拦截依然是瞬间跳跃的生硬感。
**修改点**：
- 在 `GlobalStatusBar.vue` 模板的 `.ark-global-statusbar-shell` 节点上。
- **绑定动态类名**：`:class="{ 'is-snapping': isSnapping }"`。
- 在 `<style scoped>` 中添加对应的 CSS 规则：
  ```css
  .ark-global-statusbar-shell.is-snapping {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  ```

---

## 4. 彻底解决左右侧伸缩方向不对（动态左侧锚点反转）
**原因**：内层视觉面板 `.ark-global-statusbar` 目前写死了 `style="position: absolute; right: 0; top: 0;"`。这导致即便物理外壳停在屏幕左边缘，它依然是在向右上角（Right-Top）为原点进行宽度缩放。
**修改点**：
- 在 `useDraggablePhysics.ts` 中，我们已经暴露了 `isAnchoredLeft`（当组件中心越过屏幕中线时为 true）。
- 在 `GlobalStatusBar.vue` 模板的 `.ark-global-statusbar` 节点上，将死板的 `right: 0` 升级为**双向动态定位和锚点翻转**：
  ```vue
  :style="{
    position: 'absolute',
    right: isAnchoredLeft ? 'auto' : 0,
    left: isAnchoredLeft ? 0 : 'auto',
    'transform-origin': isAnchoredLeft ? 'left top' : 'right top',
    // ... 保留原来的 --ui-width 等
  }"
  ```
  这样，当组件停靠在左半边屏幕时，它会彻底变成一个靠墙生长的左锚点面板。

---

**说明**：以上 4 点修改仅涉及 `GlobalStatusBar.vue` 的 `<template>` 中几处类名/样式的绑定变动，以及 `<style>` 尾部的几行补充。绝对不涉及重写任何历史 `global_statusbar.scss` 的结构。

请在下一轮会话（或者由其他 Agent 接手时）严格照此清单执行文件修改。