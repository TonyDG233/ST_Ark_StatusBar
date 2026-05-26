<template>
    <Section label="当前版本">
        <template #content>
            <span> {{ build_date }} ({{ commit_id }}) </span>
        </template>
    </Section>
</template>

<script setup lang="ts">
import Section from './component/Section.vue';

const build_date = 'Unknown';
const commit_id = 'Unknown';
</script>
