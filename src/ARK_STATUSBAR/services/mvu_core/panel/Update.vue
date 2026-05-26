<template>
    <Section label="变量更新方式">
        <template #label-suffix>
            <HelpIcon :help="update_method_help" />
        </template>
        <template #content>
            <Method />

            <template v-if="store.settings.更新方式 === '额外模型解析'">
                <Prompt />
                <Request />
                <Source />
            </template>
        </template>
    </Section>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';
import HelpIcon from './component/HelpIcon.vue';
import Section from './component/Section.vue';
import Method from './update/Method.vue';
import Prompt from './update/Prompt.vue';
import Request from './update/Request.vue';
import Source from './update/Source.vue';
import update_method_help from './update_method.md';

const store = useDataStore();
</script>
