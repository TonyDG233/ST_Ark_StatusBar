<template>
  <div class="ark-panel relative bg-surface border border-outline-variant overflow-hidden flex flex-col shadow-sm">
    <!-- 开发时对齐意图用：可视化组件名称标签 (正式上线后可设为 false 隐藏) -->
    <div class="absolute top-0 right-0 bg-error/90 text-on-error text-[calc(10em/14)] px-1 font-mono z-50 pointer-events-none opacity-50">
      [Panel]
    </div>

    <!-- 顶部极细的高亮装饰线 (参考设计稿) -->
    <div class="absolute top-0 left-0 w-full h-[2px] bg-primary"></div>
    <div class="absolute top-0 left-0 w-[4px] h-[4px] bg-white"></div>
    <div class="absolute top-0 right-0 w-[4px] h-[4px] bg-white"></div>

    <slot></slot>
  </div>
</template>

<script setup lang="ts">
// Panel: 通用的方舟风格内容面板积木
// 不包含任何业务逻辑，只负责“长得像方舟面板”
</script>
