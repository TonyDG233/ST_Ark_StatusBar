<template>
    <div v-if="store.should_enable" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>MVU 变量框架</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>

        <div class="inline-drawer-content">
            <Version />
            <Notification />
            <Update />
            <Button />
            <Cleanup />
            <Compatibility />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';
import Button from './Button.vue';
import Cleanup from './Cleanup.vue';
import Compatibility from './Compatibility.vue';
import Notification from './Notification.vue';
import Update from './Update.vue';
import Version from './Version.vue';

const store = useDataStore();
</script>

<style scoped>
.inline-drawer-content {
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.5rem;
}
</style>
