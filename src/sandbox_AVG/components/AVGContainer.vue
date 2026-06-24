<template>
  <div class="arknights-avg-container">
    <div class="common_style" id="sys_fullscreen">
      <div id="sys_offset">
        <div id="sys_main">
          <div class="common_style" id="sys_camera">
            <div class="common_style" id="sys_back"></div>
            <div class="common_style" id="sys_char"></div>
            <div class="common_style" id="sys_cutin"></div>
            <div class="common_style" id="sys_item"></div>
            <div class="common_style" id="sys_image"></div>
            <div class="common_style" id="sys_video"></div>
          </div>
          <div class="common_style" id="sys_blocker"></div>
          <div class="common_style" id="sys_masker"></div>
          <div class="common_style" id="sys_subtitle"></div>
          <div id="sys_dialog">
            <div class="dialog_style header"></div>
            <div class="dialog_style footer">
              <div class="name"><span id="dialog_name">剧情模拟器</span></div>
              <div class="content"><span id="dialog_output">页面载入中...<br /><s>少女折寿中...</s>&#160;&#160;&#160;:3</span></div>
            </div>
          </div>
          <div class="common_style" id="sys_clicker"></div>
          <div class="common_style hidden" id="sys_decision"></div>
          <div class="button_style right forbid" id="button_auto"></div>
          <div class="button_style right forbid" id="button_reset"></div>
          <div class="button_style left normal" id="button_playback"></div>
          <div class="button_style left normal hidden" id="button_fullscreen"></div>
          <div class="button_style left normal hidden" id="button_playback_all"></div>
          <div class="button_style left normal hidden nomobile" id="button_report">
            <div class="report common hidden">
              <h4>报告错误</h4>
              <label>已自动收集的信息：</label>
              <textarea class="playback_common" id="report_collected" disabled placeholder="display collected data."></textarea>
              <label>留言备注：</label>
              <textarea class="playback_common" id="report_note" placeholder="必填。请在此附上您需要补充的信息"></textarea>
              <button type="submit" id="report_submit">提交</button>
              <svg viewBox="0 0 1024 1024" width="15" height="15">
                <path d="M523.085935 101.849403m-101.850403 0a101.850403 101.850403 0 1 0 203.700806 0 101.850403 101.850403 0 1 0-203.700806 0Z"></path>
                <path d="M769.836489 187.508901m-96.031437 0a96.031437 96.031437 0 1 0 192.062875 0 96.031437 96.031437 0 1 0-192.062875 0Z"></path>
                <path d="M903.286707 381.395765m-90.210471 0a90.210471 90.210471 0 1 0 180.420943 0 90.210471 90.210471 0 1 0-180.420943 0Z"></path>
                <path d="M905.950692 609.722427m-84.390506 0a84.390506 84.390506 0 1 0 168.781011 0 84.390506 84.390506 0 1 0-168.781011 0Z"></path>
                <path d="M799.997313 786.127394m-78.57054 0a78.57054 78.57054 0 1 0 157.141079 0 78.57054 78.57054 0 1 0-157.141079 0Z"></path>
                <path d="M605.196454 889.708787m-72.750574 0a72.750574 72.750574 0 1 0 145.501148 0 72.750574 72.750574 0 1 0-145.501148 0Z"></path>
                <path d="M397.148673 877.857856m-66.931608 0a66.931608 66.931608 0 1 0 133.863216 0 66.931608 66.931608 0 1 0-133.863216 0Z"></path>
                <path d="M223.665689 762.483532m-61.110641 0a61.110642 61.110642 0 1 0 122.221283 0 61.110642 61.110642 0 1 0-122.221283 0Z"></path>
                <path d="M134.483212 587.14856m-55.290676 0a55.290676 55.290676 0 1 0 110.581352 0 55.290676 55.290676 0 1 0-110.581352 0Z"></path>
                <path d="M135.396207 408.896604m-49.47071 0a49.47071 49.47071 0 1 0 98.94142 0 49.47071 49.47071 0 1 0-98.94142 0Z"></path>
                <path d="M205.336797 260.047476m-43.650744 0a43.650744 43.650744 0 1 0 87.301488 0 43.650744 43.650744 0 1 0-87.301488 0Z"></path>
                <path d="M315.81515 159.990063m-37.829779 0a37.829778 37.829778 0 1 0 75.659557 0 37.829778 37.829778 0 1 0-75.659557 0Z"></path>
              </svg>
              <button type="button" id="report_cancel">取消</button>
            </div>
          </div>
          <div class="common_style playback_common hidden" id="sys_playback">
            <ul class="log_style" id="playback_result"></ul>
          </div>
          <div class="common_style playback_common hidden" id="sys_playback_all">
            <ul class="log_style" id="playback_all_result"></ul>
          </div>
        </div>
      </div>
    </div>
    <div id="sys_audio" style="display:none;"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { loadPRTSDataLocal } from '../core/DataLoader';
import { system } from '../core/../store/avgState';
import { globalTimer } from '../core/../store/avgState';

onMounted(() => {
  console.log("[AVGContainer] Mounted. Initiating Ignition Sequence...");
  
  // 1. 注入静态数据
  loadPRTSDataLocal();

  // 2. 初始化资源预加载系统并绑定初次启动事件
  system.preload.init();
});

onUnmounted(() => {
  console.log("[AVGContainer] Unmounted. Cleaning up...");
  globalTimer.clearAll();
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');
@import url('https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css');
@import url('https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.15.4/css/all.min.css');
@import url('https://cdn.jsdelivr.net/npm/animate.css@3.7.2/animate.min.css');

@import '../assets/arknights-scenario.css';

.arknights-avg-container {
    background-color: #222 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    width: 100%;
    height: 100%;
    position: relative;
}

.arknights-avg-container * {
    font-family: 'Noto Sans SC', sans-serif !important;
}
</style>
