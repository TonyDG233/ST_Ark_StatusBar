<template>
  <div class="relative flex flex-col overflow-hidden h-full box-border">
    
    <div class="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto ark-scrollbar p-2">
      
      <!-- Header Area -->
      <div class="tab-header flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent transition-all">
        <div class="font-mono text-primary-text mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider">
          <span class="w-1.5 h-1.5 bg-primary"></span>
          SYS_MODULE // HISTORY
        </div>
        <div class="flex flex-col min-w-0 w-full">
          <h1 class="font-display text-xl md:text-2xl font-bold text-on-surface break-words whitespace-normal leading-tight uppercase">
            历史记录管理
          </h1>
          <p class="tab-desc font-body text-on-surface-variant text-xs break-words whitespace-normal mt-1 leading-snug transition-all">
            管理当前系统的快照与变更历史，提供无损回滚机制。请谨慎执行全局状态重置等破坏性指令。
          </p>
        </div>
      </div>

      <!-- Action Panels Area -->
      <div class="flex flex-col gap-2 flex-shrink-0">
        <!-- Snapshot Card -->
        <HistoryActionCardDesign
          label="ACTION_01"
          title="创建快照 (Snapshot)"
          description="将当前世界书内容克隆并保存，以便在需要时无损回滚。"
          icon="camera"
          type="primary"
        >
          <div class="flex flex-col gap-2">
            <select class="bg-surface text-[11px] text-on-surface border border-outline-variant px-2 py-1 outline-none w-full">
              <option>选择要拍摄的世界书 (默认主书)</option>
              <option>Rhodes_Island_Core</option>
            </select>
            <div class="flex gap-2 items-center flex-wrap">
              <input type="text" placeholder="输入快照名称 (留空自动生成时间戳)..." class="bg-surface border border-outline-variant px-2 py-1 flex-1 min-w-[150px] text-[11px] text-on-surface outline-none placeholder:text-on-surface-variant/50" />
              <button class="bg-primary text-on-primary font-bold px-3 py-1 text-[11px] uppercase tracking-wider hover:bg-primary-container transition-colors shrink-0 outline-none">
                拍摄快照
              </button>
            </div>

            <!-- Snapshot List -->
            <div class="flex flex-col gap-1 mt-2 border-t border-outline-variant/50 pt-2">
              <div class="flex flex-col border border-outline-variant bg-surface-container-lowest p-2 min-w-0">
                 <div class="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 mb-1">
                   <div class="text-[11px] font-bold text-on-surface break-all min-w-0">Snapshot_v1.0</div>
                   <div class="text-[9px] text-on-surface-variant font-mono whitespace-nowrap">2023-10-27 10:00</div>
                 </div>
                 <div class="text-[10px] text-primary-text/80 mb-2 truncate max-w-full">📁 来源: Rhodes_Island_Core</div>
                 <div class="flex flex-wrap gap-2 justify-end">
                   <ActionToggle type="restore">恢复状态</ActionToggle>
                   <ActionToggle type="delete">删除</ActionToggle>
                 </div>
              </div>
            </div>
          </div>
        </HistoryActionCardDesign>

        <!-- Full Backup Card -->
        <HistoryActionCardDesign
          label="ACTION_02"
          title="全量备份 (Full Backup)"
          description="克隆目标世界书所有的条目内容与状态并创建独立文件。适用于大范围重构前的兜底。"
          icon="save"
          type="default"
        >
          <div class="flex flex-col gap-2">
            <!-- Warning -->
            <div class="bg-[#ffc107]/10 border border-[#ffc107]/30 p-2 flex flex-col gap-1">
              <div class="text-[#ffc107] text-[10px] font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">warning</span> 备份数量警告</div>
              <div class="text-[#ffc107]/80 text-[10px]">当前备份数量已接近系统上限 (8/10)。</div>
            </div>
            <select class="bg-surface text-[11px] text-on-surface border border-outline-variant px-2 py-1 outline-none w-full">
              <option>选择要全量备份的世界书 (默认主书)</option>
              <option>Rhodes_Island_Core</option>
            </select>
            <div class="flex gap-2 items-center flex-wrap">
              <input type="text" placeholder="自定义标识 (如: v1.2版本)..." class="bg-surface border border-outline-variant px-2 py-1 flex-1 min-w-[150px] text-[11px] text-on-surface outline-none placeholder:text-on-surface-variant/50" />
              <button class="bg-[#17a2b8] text-white font-bold px-3 py-1 text-[11px] uppercase tracking-wider hover:bg-[#17a2b8]/80 transition-colors shrink-0 outline-none">
                新建独立备份
              </button>
            </div>

            <!-- Backup List -->
            <div class="flex flex-col gap-1 mt-2 border-t border-outline-variant/50 pt-2">
              <div class="flex flex-col border border-outline-variant bg-surface-container-lowest p-2 min-w-0">
                 <div class="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 mb-1">
                   <div class="text-[11px] font-bold text-on-surface break-words min-w-0">备份 - v1.2版本</div>
                   <div class="text-[9px] text-on-surface-variant font-mono whitespace-nowrap">2023:10:28 08:30</div>
                 </div>
                 <div class="text-[10px] text-on-surface-variant mb-2 truncate max-w-full">📁 实体文件: [ARK_BACKUP_Rhodes_Island_Core]_v1.2版本</div>
                 <div class="flex flex-wrap gap-2 justify-end">
                   <ActionToggle type="restore">完整覆盖</ActionToggle>
                   <ActionToggle type="delete">删除文件</ActionToggle>
                 </div>
              </div>
            </div>
          </div>
        </HistoryActionCardDesign>

        <!-- Reset Baseline Card -->
        <HistoryActionCardDesign
          label="CRITICAL"
          title="恢复基准状态 (Reset Baseline)"
          description="一键还原至初始状态，这将清空所有历史修改记录。操作仅作用于当前主书。"
          icon="warning"
          type="danger"
        >
          <div class="flex gap-2 flex-wrap">
            <button class="flex-1 min-w-[140px] bg-error/20 text-error border border-error/50 font-bold px-3 py-2 text-[11px] hover:bg-error/30 transition-colors outline-none flex justify-center items-center gap-1 text-center">
              <span class="material-symbols-outlined text-[14px]">settings_backup_restore</span> 恢复初始状态 (Baseline)
            </button>
            <button class="flex-1 min-w-[140px] bg-[#ffc107]/20 text-[#ffc107] border border-[#ffc107]/50 font-bold px-3 py-2 text-[11px] hover:bg-[#ffc107]/30 transition-colors outline-none flex justify-center items-center gap-1 text-center">
              <span class="material-symbols-outlined text-[14px]">bolt</span> 屏蔽所有单字干员
            </button>
          </div>
        </HistoryActionCardDesign>
      </div>

      <!-- Commit Log Timeline Area -->
      <div class="flex flex-col flex-shrink-0 mt-4">
        <!-- Section Title & Tools -->
        <div class="flex flex-col gap-2 pb-2 border-b border-outline-variant mb-4">
          <div class="font-display text-[11px] font-bold tracking-widest uppercase text-on-surface-variant flex justify-between items-center px-1 flex-wrap gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span>COMMIT_LOG / 操作历史</span>
              <div class="text-[9px] px-1.5 py-0.5 rounded-sm bg-error/10 text-error border border-error/20 flex items-center gap-1 font-mono normal-case tracking-normal shrink-0">
                <span class="material-symbols-outlined text-[10px]">warning</span>
                重度修改额度: 3/30
              </div>
            </div>
            <span class="text-[9px] opacity-70">3 条记录</span>
          </div>
          <!-- Filter and Batch Tools -->
          <div class="flex flex-wrap items-center justify-between gap-2 bg-surface-variant/30 p-2 border border-outline-variant/50 min-w-0">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">filter_list</span>
              <select class="bg-surface text-[11px] text-on-surface border border-outline-variant px-1 py-0.5 flex-1 min-w-0 outline-none w-full">
                <option>显示全部 (3)</option>
                <option>状态开关 (1)</option>
                <option>修改触发类型 (1)</option>
                <option>新建快照 (1)</option>
              </select>
            </div>
            <button class="border border-outline-variant px-2 py-0.5 text-[10px] uppercase tracking-wider text-on-surface hover:bg-surface-variant whitespace-nowrap shrink-0 transition-colors"
                    @click="isBatchMode = !isBatchMode">
              {{ isBatchMode ? '退出多选' : '批量多选' }}
            </button>
          </div>

          <!-- Batch Action Bar -->
          <div v-if="isBatchMode" class="flex flex-wrap justify-between items-center gap-2 mt-2 bg-surface-variant/30 p-2 border border-dashed border-outline-variant/50">
            <label class="flex items-center gap-2 cursor-pointer text-[11px] text-on-surface">
              <input type="checkbox" class="accent-primary" /> 全选
            </label>
            <div class="flex gap-2">
              <ActionToggle type="restore">恢复选中</ActionToggle>
              <ActionToggle type="delete">删除选中</ActionToggle>
            </div>
          </div>
        </div>

        <!-- Timeline Items Container -->
        <div class="relative flex flex-col ml-1 pl-4 pb-4 border-l border-outline-variant border-dashed">
          
          <HistoryCommitItemDesign
            commitId="c8f9a2"
            time="2023-10-27 10:00"
            title="修改条目: Kal'tsit"
            source="Rhodes_Island_Core"
            :isPinned="true"
            :isHeavy="true"
            :isBatchMode="isBatchMode"
            :changes="[
              { label: '更新属性', path: 'strategy.type', from: '绿灯(条件)', to: '蓝灯(常驻)' },
              { label: '更新属性', path: 'probability', from: '50', to: '100' }
            ]"
          />

          <HistoryCommitItemDesign
            commitId="1a2b3c"
            time="2023-10-26 15:20"
            title="切换状态: Amiya"
            source="Rhodes_Island_Core"
            :isPinned="false"
            :isBatchMode="isBatchMode"
            :changes="[
              { label: '切换', path: 'enabled', from: '关闭', to: '开启' }
            ]"
          />

        </div>
        
        <!-- Safe Area Spacer for BottomNav/SubNav -->
        <div class="h-14 w-full shrink-0 pointer-events-none"></div>
      </div>
      
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ActionToggle from '../../../ARK_STATUSBAR/components/ActionToggle.vue';
import HistoryActionCardDesign from './HistoryActionCard_Design.vue';
import HistoryCommitItemDesign from './HistoryCommitItem_Design.vue';

const isBatchMode = ref(false);
</script>

<style scoped>
</style>
