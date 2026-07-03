<template>
    <div class="evt-log">
        <div v-if="!entries.length" class="evt-log__hint">{{ hint }}</div>
        <div v-for="e in entries" :key="e.id" class="evt-log__line">
            <span class="evt-log__type" :style="{ color: accent }">{{ e.type }}</span>
            <span class="evt-log__detail">{{ e.detail }}<span v-if="e.count > 1" class="evt-log__count"> ×{{ e.count }}</span></span>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'

// A small, self-contained event log for the interactive gallery cards. It owns
// its own state so a card's page component never re-renders when events arrive —
// which would otherwise reset the code-group's selected tab.
defineOptions({ name: 'EventLog' })

const props = defineProps({
    accent: { type: String, default: '#6366f1' },
    hint: { type: String, default: 'Interact with the graph…' },
    coalesce: { type: Boolean, default: false },
    max: { type: Number, default: 40 }
})

const entries = ref([])
let seq = 0

function push(type, detail) {
    const head = entries.value[0]
    if (props.coalesce && head && head.type === type && head.detail === detail) {
        head.count++
        return
    }
    entries.value = [{ id: ++seq, type, detail, count: 1 }, ...entries.value].slice(0, props.max)
}

defineExpose({ push })
</script>

<style scoped>
.evt-log {
    margin: 0 0 1em;
    padding: 8px 12px;
    max-height: 150px;
    overflow: auto;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: var(--vp-code-block-bg, var(--vp-c-bg-alt));
    font-family: var(--vp-font-family-mono, ui-monospace, monospace);
    font-size: 12px;
    line-height: 1.65;
}
.evt-log__hint {
    color: var(--vp-c-text-3);
    font-family: var(--vp-font-family-base);
}
.evt-log__line {
    display: flex;
    gap: 10px;
    white-space: nowrap;
}
.evt-log__type {
    flex: 0 0 auto;
    min-width: 84px;
    font-weight: 600;
}
.evt-log__detail { color: var(--vp-c-text-2); }
.evt-log__count { color: var(--vp-c-text-3); }
</style>
