# 当前项目 Vue 模板结构汇总

> 本文件由脚本自动提取，包含 `src/ARK_STATUSBAR/components` 下所有的 Vue `template` 结构，供 UI 设计师与大模型进行参考重构。

## src/ARK_STATUSBAR/components/GlobalStatusBar.vue
```html
<template>
  <!-- [物理外壳层] 完全负责承载物理位移，不参与任何样式形变或渐变过渡 -->
  <div
    v-if="isSystemEnabled"
    v-show="isVisible"
    class="ark-global-statusbar-shell"
    :class="{ 'is-snapping': isSnapping }"
    style="position: fixed; top: 0; z-index: 9999"
    :style="{
      left: currentAnchor === 'left' ? `${transformLeft}px` : 'auto',
      right: currentAnchor === 'right' ? `${transformRight}px` : 'auto',
      transform: `translateY(${transformY}px)`,
    }"
    ref="statusBarEl"
  >
    <!-- [视觉 UI 容器层] 负责所有颜色、尺寸、伸缩渐变。
         根据外壳给定的 currentAnchor 动态调整自己的 transform-origin 
         使得向外展开的动画总是完美的！ -->
    <div
      class="ark-global-statusbar"
      :class="{
        'light-theme': currentConfig?.theme === 'light',
        'dark-theme': currentConfig?.theme === 'dark',
        'transparent-theme': currentConfig?.theme === 'transparent',
        'mini-mode': currentUiMode === UiMode.MINI,
        'edge-snapped': currentUiMode === UiMode.BUBBLE,
        'edge-snapped-left': isSnappedToEdge === 'left',
        'edge-snapped-right': isSnappedToEdge === 'right',
        'is-dragging': isDraggingState,
      }"
      :style="{
        'transform-origin': currentAnchor === 'left' ? 'left top' : 'right top',
        '--ui-width':
          currentUiMode === UiMode.MINI ? '180px' : (previewUiWidth ?? currentConfig?.uiWidth ?? 400) + 'px',
        '--ui-font-size': (previewUiFontSize ?? currentConfig?.uiFontSize ?? 14) + 'px',
        '--snapped-width': isSnappedToEdge ? `${snappedStretchWidth}px` : '32px',
        '--ui-height-content': currentConfig?.uiHeight ? currentConfig.uiHeight + 'px' : '400px',
      }"
    >
      <!-- 气泡窗变身把手，利用原 UI 的极限压缩产生无缝融合效果 -->
      <div
        v-show="currentUiMode === UiMode.BUBBLE"
        class="edge-snap-indicator"
        @mousedown="startDrag"
        @touchstart="startDrag"
        title="向屏幕内侧拖动以展开窗口"
      >
        <span class="icon">📖</span>
      </div>

      <!-- 常规完整面板内容 (包含 FULL 和 MINI 模式) -->
      <template v-if="currentUiMode !== UiMode.BUBBLE">
        <div class="statusbar-header" @mousedown="startDrag" @touchstart="startDrag" title="拖拽移动">
          <div class="title" v-if="currentUiMode === UiMode.FULL"><span class="icon">📖</span> 方舟世界书控制台</div>
          <div class="title mini" v-else><span class="icon">📖</span> 世界书 (预警: {{ pendingEntries.length }})</div>
          <div class="controls">
            <!-- 引入了沙盒版的四角翻转按钮 -->
            <button
              class="icon-btn toggle-btn"
              @click="toggleMinimize"
              title="折叠/展开"
              :class="{ 'is-mini': currentUiMode === UiMode.MINI }"
            >
              <div class="corner top-left"></div>
              <div class="corner top-right"></div>
              <div class="corner bottom-left"></div>
              <div class="corner bottom-right"></div>
            </button>
          </div>
        </div>

        <!-- 高跷防护：使用 Grid 0fr 方案包裹内容 -->
        <div class="statusbar-content-wrapper" :class="{ 'is-full-expanded': currentUiMode === UiMode.FULL }">
          <div class="statusbar-content-inner">
            <div class="statusbar-tabs" v-show="currentUiMode === UiMode.FULL">
              <button :class="{ active: currentTab === 'interceptor' }" @click="currentTab = 'interceptor'">
                拦截预警
              </button>
              <button :class="{ active: currentTab === 'all' }" @click="currentTab = 'all'">全部条目</button>
              <button :class="{ active: currentTab === 'history' }" @click="currentTab = 'history'">记录(Git)</button>
              <button :class="{ active: currentTab === 'settings' }" @click="currentTab = 'settings'">设置</button>
            </div>

            <div class="statusbar-content" v-show="currentUiMode === UiMode.FULL">
              <InterceptorTab v-show="currentTab === 'interceptor'" @close-panel="currentUiMode = UiMode.MINI" />
              <WorldbookTab v-show="currentTab === 'all'" />
              <HistoryTab v-show="currentTab === 'history'" />
              <SettingsTab v-show="currentTab === 'settings'" />
            </div>
          </div>
        </div>

        <!-- [FEATURE: MINI_SNAPSHOT] -> Compact list shown ONLY in mini mode -->
        <div class="statusbar-mini-content" v-show="currentUiMode === UiMode.MINI">
          <div
            v-if="(pendingEntries.length > 0 ? pendingEntries : lastTriggeredEntries).length === 0"
            class="mini-empty"
          >
            无近期触发记录
          </div>
          <ul v-else class="mini-entry-list">
            <li
              v-for="entry in pendingEntries.length > 0 ? pendingEntries : lastTriggeredEntries"
              :key="entry.uid || Math.random()"
            >
              <span class="indicator" :class="{ blocked: entry.enabled === false }"></span>
              <span class="text">{{
                entry.name || (entry.strategy?.keys && entry.strategy.keys.length ? entry.strategy.keys[0] : '未知')
              }}</span>
            </li>
          </ul>
        </div>
        <!-- [FEATURE: MINI_SNAPSHOT] END -->
      </template>
```

## src/ARK_STATUSBAR/components/global_tabs/history/CommitHistoryPanel.vue
```html
<template>
  <div>
    <!-- 区域 B：操作历史 (Git Log) -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px">
      <h4 style="margin: 0">📖 操作历史记录</h4>
    </div>

    <div
      style="
        font-size: 0.8em;
        color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.6));
        opacity: 0.8;
        margin-bottom: 12px;
        line-height: 1.4;
      "
    >
      <strong style="color: var(--SmartThemeBodyColor, #ccc); font-weight: bold">【恢复】</strong
      >：撤销该记录的操作，将世界书条目的状态回滚，并从这里删除记录。<br />
      <strong style="color: var(--SmartThemeBodyColor, #ccc); font-weight: bold">【删除】</strong
      >：仅清理这条历史记录，但保持世界书现在的状态不变。
    </div>

    <!-- 筛选工具栏 -->
    <div
      class="filter-bar"
      style="
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        padding: 5px;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 4px;
      "
    >
      <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 200px">
        <label style="font-size: 0.9em; opacity: 0.8; white-space: nowrap">🔍 属性筛选：</label>
        <select
          v-model="selectedFilter"
          style="
            background: var(--SmartThemeChatBackgroundColor);
            color: var(--SmartThemeBodyColor);
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 4px;
            padding: 4px;
            flex: 1;
            min-width: 0;
          "
        >
          <option value="all">显示全部 ({{ currentConfig?.commits?.length || 0 }})</option>
          <option v-for="filter in availableFilters" :key="filter.value" :value="filter.value">
            {{ filter.label }} ({{ filter.count }})
          </option>
        </select>
      </div>

      <button
        v-if="currentConfig?.commits?.length"
        class="icon-btn tiny"
        style="
          padding: 4px 8px;
          border: 1px solid var(--SmartThemeBorderColor, #444);
          background: rgba(0, 0, 0, 0.2);
          white-space: nowrap;
        "
        @click="toggleBatchMode"
      >
        {{ isBatchMode ? '退出多选' : '批量多选' }}
      </button>
    </div>

    <!-- 批量操作工具栏 -->
    <div
      v-if="isBatchMode"
      class="batch-toolbar compact"
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        background: rgba(0, 0, 0, 0.2);
        padding: 8px;
        border-radius: 4px;
        border: 1px dashed rgba(255, 255, 255, 0.2);
      "
    >
      <label style="display: flex; align-items: center; gap: 5px; cursor: pointer">
        <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" /> 全选
      </label>
      <div style="display: flex; gap: 8px">
        <button
          class="icon-btn tiny"
          style="border: 1px solid #1e90ff; color: #1e90ff"
          @click="batchRevertCommits"
          :disabled="selectedCommits.length === 0"
        >
          ⏪ 恢复选中
        </button>
        <button
          class="icon-btn tiny"
          style="border: 1px solid #dc3545; color: #ff6b6b"
          @click="batchDeleteCommits"
          :disabled="selectedCommits.length === 0"
        >
          ❌ 删除选中
        </button>
      </div>
    </div>

    <div v-if="!currentConfig?.commits?.length" class="empty-state">暂无修改记录。</div>
    <div v-else-if="filteredCommits.length === 0" class="empty-state">没有符合当前筛选条件的记录。</div>
    <ul v-else class="commit-list">
      <li
        v-for="commit in filteredCommits"
        :key="commit.id"
        class="commit-item"
        :class="{ selectable: isBatchMode }"
        @click="isBatchMode ? toggleSelection(commit.id) : null"
      >
        <div class="commit-header">
          <div style="display: flex; align-items: center; gap: 8px">
            <input v-if="isBatchMode" type="checkbox" :value="commit.id" v-model="selectedCommits" @click.stop />
            <span class="commit-id">#{{ commit.id }}</span>
          </div>
          <span class="commit-time">{{ new Date(commit.timestamp).toLocaleString() }}</span>
        </div>
        <div class="commit-desc">{{ commit.description }}</div>
        <div v-if="commit.worldbook" style="font-size: 0.8em; opacity: 0.7; margin-bottom: 5px">
          📁 来源: {{ commit.worldbook }}
          <span v-if="commit.isHeavy" style="color: #ffc107; margin-left: 5px">(重度修改)</span>
        </div>
        <ul class="commit-changes">
          <li v-for="change in commit.changes" :key="change.uid">
            {{ change.comment }}
            <span v-if="change.path" style="color: #1e90ff">[{{ change.path }}]</span>
            :
            <span style="color: #dc3545; text-decoration: line-through">{{ getChangeText(commit, change.from) }}</span>
            <span v-if="change.to !== undefined">
              -> <span style="color: #28a745">{{ getChangeText(commit, change.to) }}</span></span
            >
          </li>
        </ul>
        <div
          v-if="!isBatchMode"
          class="commit-actions"
          style="margin-top: 8px; text-align: right; display: flex; justify-content: flex-end; gap: 8px"
        >
          <button
            class="icon-btn tiny"
            @click.stop="togglePinCommit(commit)"
            :title="commit.isPinned ? '取消保护' : '置顶保护，防止被自动清理'"
            :style="{
              border: commit.isPinned ? '1px solid #ffc107' : '1px solid #888',
              color: commit.isPinned ? '#ffc107' : '#888',
            }"
          >
            {{ commit.isPinned ? '📌 已保护' : '📍 保护' }}
          </button>
          <button
            class="icon-btn tiny"
            style="border: 1px solid #1e90ff; color: #1e90ff"
            @click.stop="revertCommit(commit)"
            title="撤销修改并还原状态"
          >
            ⏪ 恢复
          </button>
          <button
            class="icon-btn tiny"
            style="border: 1px solid #dc3545; color: #ff6b6b"
            @click.stop="deleteCommit(commit)"
            title="仅删除记录，不改变当前状态"
          >
            ❌ 删除
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/history/FullBackupPanel.vue
```html
<template>
  <div>
    <!-- 全量备份区域 (新) -->
    <div
      class="warning-box"
      style="
        margin-top: 20px;
        margin-bottom: 0;
        padding: 10px;
        border-radius: 6px 6px 0 0;
        border-bottom: none;
        background-color: rgba(23, 162, 184, 0.1);
        border-color: #17a2b8;
      "
    >
      <strong style="display: block; margin-bottom: 4px; color: #17a2b8">💾 世界书全量备份</strong>
      <p style="margin: 0; font-size: 0.9em; opacity: 0.9">
        克隆目标世界书所有的条目内容与状态并创建独立文件。适用于大范围编辑或重构前的安全兜底。
      </p>
    </div>
    <div
      class="snapshot-controls"
      style="
        border: 1px solid rgba(23, 162, 184, 0.4);
        border-top: none;
        border-radius: 0 0 6px 6px;
        padding: 15px;
        background: rgba(0, 0, 0, 0.15);
      "
    >
      <div
        v-if="backupWarningMsg"
        class="warning-box"
        style="margin-bottom: 10px; background-color: rgba(255, 193, 7, 0.2); border-color: #ffc107; color: #ffc107"
      >
        <strong>⚠️ 备份数量警告</strong>
        <p style="margin: 0; font-size: 0.85em">{{ backupWarningMsg }}</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px">
        <select v-model="selectedFullBackupWorldbook" class="filter-select" style="width: 100%">
          <option value="">选择要全量备份的世界书 (默认主书)</option>
          <option v-for="wbName in allAvailableWorldbooks" :key="wbName" :value="wbName">{{ wbName }}</option>
        </select>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <input
            type="text"
            v-model="newFullBackupName"
            placeholder="自定义标识 (如: v1.2版本)..."
            class="search-input"
            style="flex: 1; min-width: 150px"
          />
          <button
            class="btn-primary"
            @click="createFullBackup"
            style="
              padding: 6px 12px;
              white-space: nowrap;
              flex-grow: 1;
              background-color: #17a2b8;
              border-color: #17a2b8;
            "
          >
            新建独立备份
          </button>
        </div>
      </div>

      <div v-if="!fullBackupsList.length" class="empty-state" style="padding: 10px">暂无本地全量备份文件。</div>
      <ul v-else class="entry-list read-only" style="margin: 0; max-height: 200px; overflow-y: auto">
        <li
          v-for="snap in fullBackupsList"
          :key="snap"
          style="
            flex-direction: column;
            align-items: stretch;
            background: rgba(255, 255, 255, 0.05);
            margin-bottom: 8px;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px">
            <strong style="font-size: 0.95em">{{ extractBackupName(snap) }}</strong>
          </div>
          <div style="font-size: 0.8em; opacity: 0.7; margin-bottom: 8px">📁 实体文件: {{ snap }}</div>
          <div class="action-bar compact">
            <button class="btn-success tiny" @click="restoreFullBackup(snap)" style="padding: 4px; font-size: 0.85em">
              ✅ 完整覆盖
            </button>
            <button class="btn-danger tiny" @click="deleteFullBackup(snap)" style="padding: 4px; font-size: 0.85em">
              ❌ 删除文件
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/history/HighRiskActionPanel.vue
```html
<template>
  <div
    v-if="isArknightsCard"
    style="
      margin-top: 15px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
    "
  >
    <div style="font-size: 0.85em; color: rgba(255, 255, 255, 0.8); margin-bottom: 12px; line-height: 1.4">
      <span style="color: orange; font-weight: bold">⚠️ 角色卡主书专属操作</span><br />
      以下操作仅作用于当前角色的主世界书: <strong>{{ currentPrimaryWorldbook || '无' }}</strong
      >。<br />
      如果需要大规模修改或回滚状态，强烈建议您优先使用上方更安全的【快照】功能。
    </div>

    <div class="action-bar compact" style="flex-wrap: wrap">
      <button
        class="btn-danger tiny"
        @click="resetToBaseline"
        style="flex: 1; min-width: 140px; padding: 8px; font-size: 0.9em"
      >
        ↺ 恢复初始状态 (Baseline)
      </button>
      <button
        class="btn-warning tiny"
        @click="closeSingleChar"
        style="flex: 1; min-width: 140px; padding: 8px; font-size: 0.9em"
      >
        ⚡ 屏蔽所有单字干员
      </button>
    </div>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/history/HistoryTab.vue
```html
<template>
  <div class="tab-panel flex-col">
    <!-- 区域 A：快照与高危操作 -->
    <div class="snapshot-panel" style="margin-bottom: 20px">
      <SnapshotPanel />
      <FullBackupPanel />
      <HighRiskActionPanel />
    </div>

    <hr class="record-divider" style="margin-bottom: 15px" />

    <!-- 区域 B：操作历史 (Git Log) -->
    <CommitHistoryPanel />
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/history/SnapshotPanel.vue
```html
<template>
  <div>
    <div
      v-if="!isArknightsCard && !hasSnapshotForPrimary && currentPrimaryWorldbook"
      class="warning-box"
      style="margin-bottom: 10px; background-color: rgba(220, 53, 69, 0.2); border-color: #dc3545"
    >
      <strong style="color: #ff6b6b; display: block; margin-bottom: 4px">⚠️ 警告：检测到角色卡主书快照缺失</strong>
      <p style="margin: 0; font-size: 0.9em; opacity: 0.9">
        检测到当前角色卡世界书尚无快照。在您首次操作世界书前，强烈建议您拍摄一张快照，以便在需要时无损回滚。
      </p>
    </div>

    <!-- 快照管理顶栏 (黄框介绍) -->
    <div class="warning-box" style="margin-bottom: 0; padding: 10px; border-radius: 6px 6px 0 0; border-bottom: none">
      <strong style="display: block; margin-bottom: 4px">📸 世界书快照管理</strong>
      <p style="margin: 0; font-size: 0.9em; opacity: 0.9">
        此处可以对任意世界书保存当前所有条目 “蓝/绿灯”，“开启/禁用状态” 的快照，并在日后随时无损恢复。
      </p>
    </div>

    <!-- 实际的快照操作区域 -->
    <div
      class="snapshot-controls"
      style="
        border: 1px solid rgba(255, 165, 0, 0.4);
        border-top: none;
        border-radius: 0 0 6px 6px;
        padding: 15px;
        background: rgba(0, 0, 0, 0.15);
      "
    >
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px">
        <select v-model="selectedSnapshotWorldbook" class="filter-select" style="width: 100%">
          <option value="">选择要拍摄的世界书 (默认主书)</option>
          <option v-for="wbName in allAvailableWorldbooks" :key="wbName" :value="wbName">{{ wbName }}</option>
        </select>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <input
            type="text"
            v-model="newSnapshotName"
            placeholder="输入快照名称 (留空自动生成时间戳)..."
            class="search-input"
            style="flex: 1; min-width: 150px"
          />
          <button
            class="btn-primary"
            @click="createSnapshot"
            style="padding: 6px 12px; white-space: nowrap; flex-grow: 1"
          >
            拍摄快照
          </button>
        </div>
      </div>

      <div v-if="!currentConfig?.snapshots?.length" class="empty-state" style="padding: 10px">暂无保存的快照。</div>
      <ul v-else class="entry-list read-only" style="margin: 0; max-height: 200px; overflow-y: auto">
        <li
          v-for="snap in currentConfig?.snapshots"
          :key="snap.id"
          style="
            flex-direction: column;
            align-items: stretch;
            background: rgba(255, 255, 255, 0.05);
            margin-bottom: 8px;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px">
            <strong style="font-size: 0.95em">{{ snap.name }}</strong>
            <span style="font-size: 0.8em; opacity: 0.7">{{ new Date(snap.timestamp).toLocaleString() }}</span>
          </div>
          <div style="font-size: 0.8em; opacity: 0.7; margin-bottom: 8px">📁 来源: {{ snap.worldbook }}</div>
          <div class="action-bar compact">
            <button class="btn-success tiny" @click="restoreSnapshot(snap.id)" style="padding: 4px; font-size: 0.85em">
              ✅ 恢复状态
            </button>
            <button class="btn-danger tiny" @click="deleteSnapshot(snap.id)" style="padding: 4px; font-size: 0.85em">
              ❌ 删除
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/interceptor/InterceptorTab.vue
```html
<template>
  <div class="tab-panel flex-col">
    <div
      class="panel-header-action"
      style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap"
    >
      <div style="display: flex; align-items: center; gap: 10px">
        <label>发送预检拦截</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <button
        class="icon-btn tiny"
        style="border: 1px solid var(--SmartThemeBorderColor, #444); padding: 4px 8px"
        @click="runManualTest"
        title="主动测试当前输入和上下文会触发的条目"
      >
        🔍 主动检测
      </button>
    </div>

    <div v-if="!currentConfig?.isInterceptorEnabled && !isTestMode" class="empty-state">
      ⚠️ 预检拦截已关闭，发送请求将直接通行。
    </div>
    <div v-else-if="pendingEntries.length === 0" class="empty-state">
      <div v-if="!isTestMode">
        当前没有被拦截的发送请求。
        <p class="hint">点击发送按钮时，即将触发的条目将在此等待确认。</p>
      </div>
      <div v-else>
        <strong style="color: #007bff">🔍 测试结果</strong>
        <p>根据当前上下文，未触发任何条件世界书条目。</p>
        <div class="action-bar compact" style="margin-top: 15px">
          <button class="btn-primary" @click="clearTestResults" title="清除测试结果">清除测试结果</button>
        </div>
      </div>

      <div v-if="!isTestMode && lastTriggeredEntries.length > 0" class="last-record-box">
        <hr class="record-divider" />
        <strong>上一轮触发记录</strong>
        <ul class="entry-list read-only">
          <li
            v-for="entry in sortedLastTriggeredEntries"
            :key="entry.uid || Math.random()"
            :class="{ 'disabled-entry': !entry.enabled }"
          >
            <div class="entry-info">
              <span class="entry-name">
                <span v-if="isPinned(entry)" class="pin-icon">📌</span>
                <span style="font-size: 0.9em; margin-right: 4px">{{
                  getEntryType(entry) === 'constant' ? '🔵' : '🟢'
                }}</span>
                {{
                  entry.name || (entry.strategy?.keys && entry.strategy.keys.length ? entry.strategy.keys[0] : '未知')
                }}
                <span v-if="entryTokenCountCache[getEntryKey(entry)] !== undefined" class="token-badge">
                  ~{{ entryTokenCountCache[getEntryKey(entry)] }} tok
                </span>
                <span v-if="entry.world" style="font-size: 0.8em; opacity: 0.7; margin-left: 5px"
                  >({{ entry.world }})</span
                >
              </span>
              <span class="badge" v-if="entry.enabled !== false">已发送</span>
              <span class="badge blocked" v-else>已阻断</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <div v-else>
      <div
        class="warning-box"
        :style="isTestMode ? 'background: rgba(0, 123, 255, 0.2); border-left-color: #007bff;' : ''"
      >
        <strong v-if="!isTestMode">⚠️ 拦截预警</strong>
        <strong v-else>🔍 测试结果</strong>
        <p v-if="!isTestMode">
          本次回复将触发以下世界书条目：<br />
          <span style="opacity: 0.8; font-size: 0.9em">(预计 Token: {{ currentTokenCount }})</span>
        </p>
        <p v-else>
          根据当前上下文，模拟检测触发了以下条目：<br />
          <span style="opacity: 0.8; font-size: 0.9em">(预计 Token: {{ currentTokenCount }})</span>
        </p>
      </div>
      <ul class="entry-list stacked">
        <li
          v-for="entry in sortedPendingEntries"
          :key="entry.uid || Math.random()"
          :class="{ 'disabled-entry': entry.enabled === false && !entry.tempDisabled }"
        >
          <div class="entry-name">
            <span v-if="isPinned(entry)" class="pin-icon">📌</span>
            <span style="font-size: 0.9em; margin-right: 4px">{{
              getEntryType(entry) === 'constant' ? '🔵' : '🟢'
            }}</span>
            {{ entry.name || (entry.strategy?.keys && entry.strategy.keys.length ? entry.strategy.keys[0] : '未知') }}
            <span v-if="entryTokenCountCache[getEntryKey(entry)] !== undefined" class="token-badge">
              ~{{ entryTokenCountCache[getEntryKey(entry)] }} tok
            </span>
            <div v-if="entry.world" style="font-size: 0.75em; color: var(--ui-text-secondary); margin-top: 2px">
              📁 来源: {{ entry.world }}
            </div>
          </div>
          <div class="entry-footer">
            <div class="status-badges">
              <span class="badge" v-if="entry.enabled !== false && !entry.tempDisabled">将被发送</span>
              <span class="badge warning" v-else-if="entry.tempDisabled">临时阻断</span>
              <span class="badge blocked" v-else>已阻断</span>
            </div>
            <div class="action-btns">
              <!-- 如果当前是彻底关闭状态，只显示恢复开启 -->
              <button
                v-if="entry.enabled === false && !entry.tempDisabled"
                class="icon-btn tiny"
                style="color: #28a745; border-color: rgba(40, 167, 69, 0.4)"
                title="重新开启此条目"
                @click="togglePendingEntry(entry)"
              >
                ✅ 开启
              </button>

              <template v-else>
                <button
                  v-if="!entry.tempDisabled"
                  class="icon-btn tiny"
                  style="color: #ff9800; border-color: rgba(255, 152, 0, 0.4)"
                  title="本次发送阻断，发送后自动恢复"
                  @click="toggleTempDisable(entry)"
                >
                  ⏳ 单次
                </button>
                <button
                  v-else
                  class="icon-btn tiny"
                  style="color: #28a745; border-color: rgba(40, 167, 69, 0.4)"
                  title="取消临时阻断，重新加入本次发送"
                  @click="toggleTempDisable(entry)"
                >
                  ✅ 恢复
                </button>
                <button
                  class="icon-btn tiny"
                  style="color: #dc3545; border-color: rgba(220, 53, 69, 0.4)"
                  title="彻底阻断此条目，不再自动恢复"
                  @click="togglePendingEntry(entry)"
                >
                  ❎ 彻底
                </button>
              </template>
```

## src/ARK_STATUSBAR/components/global_tabs/settings/SettingsTab.vue
```html
<template>
  <div class="tab-panel">
    <div class="setting-item">
      <label>UI 主题</label>
      <div class="theme-buttons">
        <button :class="{ active: currentConfig?.theme === 'light' }" @click="updateTheme('light')">默认(白)</button>
        <button :class="{ active: currentConfig?.theme === 'dark' }" @click="updateTheme('dark')">夜间(黑)</button>
        <button :class="{ active: currentConfig?.theme === 'transparent' }" @click="updateTheme('transparent')">
          透明
        </button>
      </div>
    </div>

    <!-- 增加一个固定宽度的内部容器，防止拖动滑块时因为整体UI实时缩放导致鼠标相对位置产生巨大偏移（“发抖”、“极度灵敏”现象） -->
    <div style="width: 100%; max-width: 300px">
      <div class="setting-item flex-col-align-start">
        <label>UI 宽度 ({{ displayWidth }}px)</label>
        <!-- 将实时 @input 修改为 @change，仅在松开鼠标时应用变化，彻底根治拉条与页面宽度耦合带来的鬼畜抖动问题 -->
        <input
          type="range"
          min="200"
          max="1000"
          step="10"
          :value="displayWidth"
          @change="commitUiWidth"
          class="slider-input"
        />
      </div>

      <div class="setting-item flex-col-align-start">
        <label>
          UI 内容高度: ({{ displayHeight ? displayHeight + 'px' : '默认 (400px)' }})
          <span class="mobile-scale-hint">/ 仅在电脑端等宽屏生效</span>
        </label>
        <input
          type="range"
          min="200"
          max="1200"
          step="20"
          :value="displayHeight"
          @change="commitUiHeight"
          class="slider-input"
        />
      </div>

      <div class="setting-item flex-col-align-start">
        <label
          >字体大小 (<span class="mobile-scale-hint">移动端自动 -2px / </span>当前基准: {{ displayFontSize }}px)</label
        >
        <!-- 字体大小虽然影响较小，但也改为 @change，统一体验 -->
        <input
          type="range"
          min="10"
          max="24"
          step="1"
          :value="displayFontSize"
          @change="commitUiFontSize"
          class="slider-input"
        />
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">松开滑块后应用宽度变化。</p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>发送预检拦截</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        开启后，点击发送按钮时将无痕预览即将触发的世界书，防止暴走。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>回车键拦截预警</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.enableEnterToIntercept" @change="toggleEnterInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        开启后，按下回车键发送也将被拦截预览。默认关闭，以方便习惯回车换行或原生发送的用户。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>显示常驻(蓝灯)条目</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.showConstantEntries" @change="toggleShowConstantEntries" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        开启后，无论是在被动发送拦截还是主动检测中，都将展示被激活的常驻条目（仅供检查调试）。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>Token 计算器 (性能选项)</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.enableTokenCalculator" @change="toggleTokenCalculator" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        预检拦截时，同时估算即将发送的 Token 消耗。<strong style="color: #ff9800"
          >如果遇到拦截严重卡顿或超时，请关闭此项。</strong
        >
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label style="color: #dc3545; font-weight: bold">🔧 开启调试日志导出</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.isDebugMode" @change="toggleDebugMode" />
          <span class="slider round" :style="currentConfig?.isDebugMode ? 'background-color: #dc3545;' : ''"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8; color: #dc3545">
        开启后将记录所有底层检测流。当遇到检测失效等 Bug 时，请开启此项，进行一次检测，然后检查名为
        "[SYS_DEBUG]系统调试日志导出" 的世界书条目内容并反馈给开发者。
      </p>
    </div>

    <div class="setting-action">
      <div style="margin-bottom: 15px">
        <button class="btn-warning" @click="clearPins">清空所有偏好置顶</button>
        <p class="hint">取消全部条目的置顶状态。</p>
      </div>

      <div style="border-top: 1px dashed rgba(128, 128, 128, 0.3); padding-top: 15px">
        <button class="btn-danger" @click="factoryReset">恢复初始设置</button>
        <p class="hint warning">将清除本插件的所有配置、手动修改记录和快照，彻底恢复至初始状态。此操作不可逆！</p>
      </div>
    </div>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/worldbook/WorldbookEntryEditor.vue
```html
<template>
  <div class="wb-editor-panel">
    <div class="editor-header">
      <h4>编辑条目: {{ localEntry.name }}</h4>
      <button class="icon-btn tiny close-btn" @click="$emit('cancel')" title="取消编辑">✖</button>
    </div>

    <div class="editor-body">
      <!-- 1. 基本信息 (标题, 蓝绿灯) -->
      <div class="form-group row">
        <div class="form-item flex-2">
          <label>标题/备注 (Title)</label>
          <input type="text" v-model="localEntry.name" class="editor-input" />
        </div>
        <div class="form-item flex-1">
          <label>触发类型 (Type)</label>
          <select v-model="localEntry.strategy.type" class="editor-select">
            <option value="selective">条件 (🟢 绿灯)</option>
            <option value="constant">常驻 (🔵 蓝灯)</option>
          </select>
        </div>
      </div>

      <!-- 2. 绿灯专属：关键词与逻辑 -->
      <div class="form-group" v-if="localEntry.strategy.type === 'selective'">
        <label>主关键词 (逗号分隔)</label>
        <input
          type="text"
          :value="joinKeys(localEntry.strategy.keys)"
          @input="updateKeys($event, 'keys')"
          class="editor-input"
          placeholder="例如: 阿米娅, 罗德岛"
        />

        <div class="row" style="margin-top: 8px">
          <div class="form-item flex-1">
            <label>可选逻辑 (Logic)</label>
            <select v-model="localEntry.strategy.keys_secondary.logic" class="editor-select">
              <option value="and_any">与任意 (AND ANY)</option>
              <option value="and_all">与所有 (AND ALL)</option>
              <option value="not_any">非任意 (NOT ANY)</option>
              <option value="not_all">非所有 (NOT ALL)</option>
            </select>
          </div>
          <div class="form-item flex-2">
            <label>可选过滤器/次要关键词 (逗号分隔)</label>
            <input
              type="text"
              :value="joinKeys(localEntry.strategy.keys_secondary.keys)"
              @input="updateKeys($event, 'keys_secondary')"
              class="editor-input"
              placeholder="需要结合可选逻辑生效..."
            />
          </div>
        </div>
      </div>

      <!-- 3. 插入位置与顺序 -->
      <div class="form-group row">
        <div class="form-item flex-1">
          <label>插入位置 (Position)</label>
          <select v-model="localEntry.position.type" class="editor-select">
            <option value="before_character_definition">角色定义前</option>
            <option value="after_character_definition">角色定义后</option>
            <option value="before_example_messages">示例消息前</option>
            <option value="after_example_messages">示例消息后</option>
            <option value="before_author_note">作者注释前</option>
            <option value="after_author_note">作者注释后</option>
            <option value="at_depth">指定深度 (@ Depth)</option>
          </select>
        </div>
        <div class="form-item flex-1">
          <label>顺序 (Order)</label>
          <input type="number" v-model.number="localEntry.position.order" class="editor-input" />
        </div>
        <div class="form-item flex-1">
          <label>触发概率% (Prob)</label>
          <input type="number" v-model.number="localEntry.probability" min="0" max="100" class="editor-input" />
        </div>
      </div>

      <!-- 指定深度专属设置 -->
      <div class="form-group row" v-if="localEntry.position.type === 'at_depth'">
        <div class="form-item flex-1">
          <label>角色身份 (Role)</label>
          <select v-model="localEntry.position.role" class="editor-select">
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
        <div class="form-item flex-1">
          <label>深度 (Depth)</label>
          <input type="number" v-model.number="localEntry.position.depth" min="0" class="editor-input" />
        </div>
      </div>

      <!-- 4. 递归与特殊选项 -->
      <div class="form-group check-group">
        <label class="check-label">
          <input type="checkbox" v-model="localEntry.recursion.prevent_incoming" />
          不可递归 (防止被其他激活)
        </label>
        <label class="check-label">
          <input type="checkbox" v-model="localEntry.recursion.prevent_outgoing" />
          防止进一步递归 (不激活其他)
        </label>
        <label class="check-label">
          <input type="checkbox" :checked="localEntry.recursion.delay_until !== null" @change="toggleDelayUntil" />
          延迟到递归
        </label>
      </div>

      <!-- 5. 正文内容 -->
      <div class="form-group">
        <label>内容 (Content)</label>
        <textarea v-model="localEntry.content" class="editor-textarea" rows="6"></textarea>
      </div>
    </div>

    <div class="editor-footer">
      <button class="btn-secondary" @click="$emit('cancel')">取消</button>
      <button class="btn-primary" @click="saveChanges">保存更改</button>
    </div>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/worldbook/WorldbookEntryItem.vue
```html
<template>
  <div class="wb-item" :class="{ 'disabled-entry': !entry.enabled }">
    <div class="wb-info">
      <!-- Checkbox for batch mode -->
      <label v-if="isBatchMode" class="batch-checkbox-container">
        <input type="checkbox" :value="entry.uid" v-model="isSelected" />
      </label>

      <!-- Entry Basic Info -->
      <div class="wb-info-text">
        <div class="wb-name">
          <span v-if="entry._isPinned" class="pin-icon">📌</span>
          {{ entry.name || (entry.strategy?.keys ? entry.strategy.keys[0] : '未知') }}
        </div>
        <div class="wb-keys" v-if="entry.strategy?.keys && entry.strategy.keys.length">
          触发词: {{ entry.strategy.keys.join(', ') }}
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="wb-action">
      <button class="icon-btn tiny" @click="toggleEdit" title="编辑完整属性">✏️</button>
      <button
        class="icon-btn tiny pin-btn"
        @click="togglePin"
        :title="entry._isPinned ? '取消置顶' : '偏好置顶'"
        :class="{ pinned: entry._isPinned }"
      >
        {{ entry._isPinned ? '📌' : '📍' }}
      </button>
      <button
        class="icon-btn tiny"
        @click="toggleType"
        :title="entry._computedType === 'constant' ? '当前：蓝灯(常驻)，点击切换' : '当前：绿灯(条件)，点击切换'"
      >
        {{ entry._computedType === 'constant' ? '🔵' : '🟢' }}
      </button>
      <label class="switch" title="开启/关闭">
        <input type="checkbox" :checked="entry.enabled" @change="toggleEnabled" />
        <span class="slider round"></span>
      </label>
      <button class="icon-btn tiny" style="color: #ff6b6b" @click="deleteEntry" title="删除条目">🗑️</button>
    </div>
  </div>

  <!-- 内联展开的完整编辑器 -->
  <WorldbookEntryEditor v-if="isEditing" :entry="entry" @save="onSave" @cancel="isEditing = false" />
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/worldbook/WorldbookEntryList.vue
```html
<template>
  <div class="wb-entries-wrapper">
    <div class="filters" style="margin-bottom: 5px">
      <input type="text" v-model="filterEntryTexts" placeholder="搜索此书内的条目..." class="search-input" />

      <div v-if="isEntryBatchMode" class="batch-toolbar compact">
        <label style="cursor: pointer; display: flex; align-items: center; gap: 4px">
          <input type="checkbox" :checked="isAllEntriesSelected" @change="toggleSelectAllEntries" /> 全选
        </label>
        <div style="display: flex; gap: 6px; flex-wrap: wrap">
          <button class="icon-btn pill tiny" @click="actions.batchPinEntries(selectedEntries, true)">📌置顶</button>
          <button class="icon-btn pill tiny" @click="actions.batchPinEntries(selectedEntries, false)">📍消顶</button>
          <button class="icon-btn pill tiny" @click="actions.batchToggleEntryType(wbName, selectedEntries)">
            🔵/🟢切换
          </button>
          <button class="icon-btn pill tiny" @click="actions.batchToggleEntryEnabled(wbName, selectedEntries, true)">
            ✅开启
          </button>
          <button class="icon-btn pill tiny" @click="actions.batchToggleEntryEnabled(wbName, selectedEntries, false)">
            🚫关闭
          </button>
          <button class="icon-btn pill tiny" style="color: #ff6b6b; border-color: #ff6b6b55" @click="handleBatchDelete">
            🗑️删除
          </button>
        </div>
      </div>

      <div class="filter-row" v-if="!isEntryBatchMode">
        <select v-model="filterCategory" class="filter-select">
          <option value="">全部类别</option>
          <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="filterType" class="filter-select">
          <option value="">全部类型(蓝/绿灯)</option>
          <option value="constant">常驻 (🔵 蓝灯)</option>
          <option value="selective">条件 (🟢 绿灯)</option>
        </select>
      </div>
    </div>

    <div style="display: flex; gap: 20px; justify-content: center">
      <button class="icon-btn pill tiny" title="新建条目" @click="createNewEntry">➕ 新建条目</button>
      <button
        class="icon-btn pill tiny"
        title="批量管理条目"
        @click="toggleEntryBatchMode"
        :class="{ active: isEntryBatchMode }"
      >
        📑 批量管理
      </button>
    </div>

    <div v-if="isLoadingWb === wbName" class="empty-state" style="padding: 10px">加载中...</div>
    <div
      v-else-if="!worldbookEntriesCache[wbName] || worldbookEntriesCache[wbName].length === 0"
      class="empty-state"
      style="padding: 10px"
    >
      此世界书没有包含有效条目。
    </div>
    <div v-else class="wb-entries-container">
      <WorldbookEntryItem
        v-for="entry in visibleEntries"
        :key="entry.uid"
        :entry="entry"
        :wbName="wbName"
        :isBatchMode="isEntryBatchMode"
        v-model:selectedEntries="selectedEntries"
      />

      <!-- 渐进式加载 -->
      <div v-if="hasMoreEntries" class="load-more-container" style="text-align: center; padding: 10px 0">
        <button
          class="btn-primary"
          style="
            padding: 4px 12px;
            font-size: 0.9em;
            border-radius: 4px;
            background: rgba(0, 123, 255, 0.2);
            cursor: pointer;
          "
          @click="loadMoreEntries"
        >
          往下加载更多... (当前显示 {{ visibleEntries.length }} / {{ processedEntries.length }})
        </button>
      </div>

      <div v-if="processedEntries.length === 0" class="empty-state" style="padding: 5px">没有找到匹配的条目。</div>
    </div>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/worldbook/WorldbookItem.vue
```html
<template>
  <div class="wb-accordion-item">
    <div class="wb-accordion-header" @click="!isGlobalBatchMode && toggleAccordion()">
      <div class="wb-accordion-title">
        <input v-if="isGlobalBatchMode" type="checkbox" :value="wb.name" v-model="isSelected" @click.stop />
        <span v-if="wb.isPinned" class="pin-icon">📌</span>
        <span class="wb-type-badge" :class="wb.type">
          {{ wb.type === 'char' ? '角色绑定' : wb.type === 'global' ? '已挂载' : '未挂载' }}
        </span>
        <span class="wb-name-text">{{ wb.name }}</span>
      </div>
      <div class="wb-accordion-actions">
        <button
          class="icon-btn tiny pin-btn"
          @click.stop="toggleWorldbookPin"
          :title="wb.isPinned ? '取消置顶' : '置顶世界书'"
          :class="{ pinned: wb.isPinned }"
        >
          {{ wb.isPinned ? '📌' : '📍' }}
        </button>
        <button
          v-if="wb.type !== 'char'"
          class="icon-btn tiny"
          @click.stop="toggleGlobalMountUI"
          :title="wb.type === 'global' ? '卸载' : '挂载'"
        >
          {{ wb.type === 'global' ? '⛓️' : '🔗' }}
        </button>
        <button class="icon-btn tiny" style="color: #ff6b6b" @click.stop="deleteWorldbookUI" title="删除世界书">
          🗑️
        </button>
        <span class="accordion-arrow" v-if="!isGlobalBatchMode">{{ isExpanded ? '▼' : '▶' }}</span>
      </div>
    </div>

    <WorldbookEntryList v-if="isExpanded" :wbName="wb.name" />
  </div>
</template>
```

## src/ARK_STATUSBAR/components/global_tabs/worldbook/WorldbookTab.vue
```html
<template>
  <div class="tab-panel flex-col">
    <div class="filters">
      <input type="text" v-model="filterText" placeholder="搜索世界书..." class="search-input" />
      <div style="display: flex; gap: 20px; justify-content: center">
        <button class="icon-btn pill tiny" title="新建世界书" @click="actions.createNewWorldbook">➕ 新建世界书</button>
        <button
          class="icon-btn pill tiny"
          title="批量管理"
          @click="toggleGlobalBatchMode"
          :class="{ active: isGlobalBatchMode }"
        >
          📑 批量管理
        </button>
      </div>
    </div>

    <div v-if="isGlobalBatchMode" class="batch-toolbar compact" style="margin-bottom: 10px">
      <label style="cursor: pointer; display: flex; align-items: center; gap: 4px">
        <input type="checkbox" :checked="isAllWorldbooksSelected" @change="toggleSelectAllWorldbooks" /> 全选
      </label>
      <div style="display: flex; gap: 6px; flex-wrap: wrap">
        <button class="icon-btn pill tiny" @click="actions.batchPinWorldbooks(selectedWorldbooks, true)">📌置顶</button>
        <button class="icon-btn pill tiny" @click="actions.batchPinWorldbooks(selectedWorldbooks, false)">
          📍消顶
        </button>
        <button class="icon-btn pill tiny" @click="actions.batchMountWorldbooks(selectedWorldbooks, true)">
          🔗挂载
        </button>
        <button class="icon-btn pill tiny" @click="actions.batchMountWorldbooks(selectedWorldbooks, false)">
          ⛓️卸载
        </button>
        <button class="icon-btn pill tiny" style="color: #ff6b6b; border-color: #ff6b6b55" @click="handleBatchDelete">
          🗑️删除
        </button>
      </div>
    </div>

    <div class="all-wbs-list">
      <WorldbookItem
        v-for="wb in filteredWorldbooks"
        :key="wb.name"
        :wb="wb"
        :isGlobalBatchMode="isGlobalBatchMode"
        v-model:selectedWorldbooks="selectedWorldbooks"
      />
      <div v-if="filteredWorldbooks.length === 0" class="empty-state">没有找到匹配的世界书。</div>
    </div>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/ReturnButton.vue
```html
<template>
  <a class="director-return-button" @click="handleReturn"> 返回开局 </a>
</template>
```

## src/ARK_STATUSBAR/components/StartupNavigator.vue
```html
<template>
  <div
    class="ark-startup-container"
    :class="{ 'dark-theme': theme === 'dark', 'transparent-theme': theme === 'transparent' }"
    :style="{ '--ui-font-size': displayFontSize + 'px' }"
  >
    <div class="main-container">
      <div class="content-wrapper">
        <!-- Header Section -->
        <div class="header-section">
          <div class="arknights-logo-container">
            <img :src="ASSETS.LOGO_URL" alt="Arknights Logo" class="arknights-logo" />
          </div>
          <p class="author-info">初版作者：我是特蕾西娅(旧称“豌豆”) | v版核心作者：F.o.x.i.o</p>
          <p class="author-info">项目贡献者：TonyDG233(UI), 晚鸢尾(UI demo)</p>
          <p class="author-info">暗中观察信长“死芒”(剧情), 政委x(剧情), Rylan(剧情), rdq9909(剧情), “血先生”(剧情)</p>
          <p class="author-info">小额(剧情), Void(剧情), 空弦(剧情), 飨舞(剧情)</p>
          <p class="author-info">UI重构项目：ARK_STATUSBAR</p>
        </div>

        <div class="copyright-notice">
          <strong>版权声明</strong><br />
          本卡完全免费，永远禁止商业化行为，如果您是购买获得，请立即退款并向购买平台举报贩卖者，维护创作者和您自身的权益。
        </div>

        <div class="usage-instructions">
          <strong>使用说明</strong><br />
          请第一次使用本角色卡的用户，务必前往最后一个开局阅读<strong style="color: var(--warning-accent)"
            >“狐の言（在首次游玩前请一定要看！）”</strong
          >。<br />
          若需管理单字干员/重置世界书状态，或管理悬浮窗UI，请点击右上角按钮打开侧边栏进行操作。
        </div>

        <div class="section-title">◆ 简介</div>
        <p class="intro-desc">
          从先史文明的终焉开始，到萨卡兹的第一位魔王，再到移动城市的拔地而起……<br />
          如今的泰拉已经历经许多，源石将诅咒与馈赠印刻于这片大地，列国的城邦永无止境地在天灾轨迹中迁徙，感染者的悲鸣与帝国的号角于风雪中交织，仇恨浸染大地，而希望亦如天光。<br />
          现在，你来到于此。<br />
          你将作何抉择？你将行向何方？<br />
          你是……谁？
        </p>

        <!-- Scenarios Grid -->
        <div class="section-title">◆ 点击—开启故事</div>
        <div class="opening-section">
          <div class="opening-grid">
            <div
              v-for="scenario in scenarios"
              :key="scenario.swipeId"
              class="opening-card"
              @click="handleScenarioClick(scenario)"
            >
              <div class="opening-title">{{ scenario.title }}</div>

              <!-- Decorational Info -->
              <div class="opening-info" v-if="scenario.linkedWorldInfo && scenario.linkedWorldInfo.length > 0">
                <span class="info-label">开启:</span> {{ scenario.linkedWorldInfo.slice(0, 3).join(', ')
                }}{{ scenario.linkedWorldInfo.length > 3 ? '...' : '' }}
              </div>
              <div class="opening-info" v-if="scenario.disabledWorldInfo && scenario.disabledWorldInfo.length > 0">
                <span class="info-label">关闭:</span> {{ scenario.disabledWorldInfo.slice(0, 3).join(', ')
                }}{{ scenario.disabledWorldInfo.length > 3 ? '...' : '' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Toggle -->
      <div class="settings-tab" :class="{ 'is-open': isSettingsOpen }" @click="toggleSettings">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
          <path d="M0 0h24v24H0V0z" fill="none" />
          <path
            d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12-.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"
          />
        </svg>
      </div>

      <StartupSettingsPanel
        :is-open="isSettingsOpen"
        :config="currentConfig"
        :wb-status="wbStatus"
        @close="isSettingsOpen = false"
        @update:config="updateConfig"
        @close-single-char="handleCloseSingleChar"
        @restore-worldbook="handleRestoreWorldbook"
      />
    </div>
  </div>
</template>
```

## src/ARK_STATUSBAR/components/startup_tabs/StartupSettingsPanel.vue
```html
<template>
  <!-- Settings Overlay (Mobile Backdrop) -->
  <div class="settings-overlay" v-if="isOpen" @click="$emit('close')"></div>

  <!-- Settings Panel -->
  <div class="settings-panel" :class="{ 'is-open': isOpen }">
    <h3>世界书控制</h3>

    <div class="wb-status-display" :class="wbStatusClass">
      <div class="status-label">SYSTEM STATUS</div>
      <div class="status-value">{{ wbStatusText }}</div>
      <div class="status-diff" v-if="config?.commits?.length">
        最近修改: {{ config.commits[config.commits.length - 1].description }}
        <br />
        共计 {{ config.commits.length }} 条修改记录
      </div>
      <div class="status-decor"></div>
    </div>

    <div class="wb-actions">
      <div class="ark-btn warning" @click="$emit('close-single-char')">
        <div class="btn-content">
          <span class="btn-icon">⚡</span>
          <span class="btn-text">屏蔽单字干员</span>
        </div>
        <div class="btn-decor"></div>
      </div>
      <div class="ark-btn danger" @click="$emit('restore-worldbook')">
        <div class="btn-content">
          <span class="btn-icon">↺</span>
          <span class="btn-text">还原世界书</span>
        </div>
        <div class="btn-decor"></div>
      </div>
    </div>

    <div id="wb-control-hint" class="warning-box">
      <strong style="color: orange">[!] 世界书管理提示</strong>
      <p style="font-size: 0.85em; margin-top: 5px; line-height: 1.6">本面板会智能识别并管理当前角色的世界书状态。</p>
      <p style="font-size: 0.85em; margin-top: 5px; line-height: 1.6">
        若您手动修改了世界书（如自行开启了某些条目），状态将显示为<strong style="color: #ff9800">“已修改”</strong
        >。此时切换开局可能会触发冲突警告，请按需选择继续或重置。
      </p>
    </div>

    <div class="settings-divider"></div>

    <h3>功能组件控制</h3>
    <div class="setting-item" style="margin-top: 10px">
      <label>世界书控制台开关</label>
      <label class="switch">
        <input type="checkbox" :checked="isSystemEnabled" @change="toggleSystem" />
        <span class="slider round"></span>
      </label>
    </div>
    <p style="font-size: 0.8em; color: var(--ui-text-secondary); margin-bottom: 20px">
      关闭后将彻底隐藏方舟世界书控制台，并暂停预检拦截系统。
    </p>

    <div class="settings-divider"></div>

    <h3>终端主题</h3>
    <div class="theme-buttons-container">
      <div class="theme-button light" :class="{ active: theme === 'light' }" @click="setTheme('light')">
        <span>默认(白)</span>
      </div>
      <div class="theme-button dark" :class="{ active: theme === 'dark' }" @click="setTheme('dark')">
        <span>夜间(黑)</span>
      </div>
      <div
        class="theme-button transparent"
        :class="{ active: theme === 'transparent' }"
        @click="setTheme('transparent')"
      >
        <span>透明</span>
      </div>
    </div>
  </div>
</template>
```

