<template>
    <div ref="container" style="margin: 1em 0 1em 0; height: 400px; border: 1px solid #cccccc99"></div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Pivotick } from '../../../dist/pivotick.js'
import '../../../dist/pivotick.css'

defineOptions({
    name: 'Pivotick'
})

const props = defineProps({
    data: {
        type: Object,
        required: true,
    },
    options: {
        type: Object,
        required: true,
    },
    onMountedCallback: {
        type: Function,
        required: false,
    },
    onLoadedCallback: {
        type: Function,
        required: false,
    },
})

const localData = computed(() => ({ ...props.data }))
const localOptions = computed(() => ({
    ...props.options,
    simulation: {
        useWorker: false,
    },
}))

const container = ref(null)
let graph = null

onMounted(() => {
    graph = new Pivotick(container.value, localData.value, localOptions.value)
    props.onMountedCallback?.(container.value)
    graph.ready.then(() => {
        props.onLoadedCallback?.(graph)
    })
})

onBeforeUnmount(() => {
    if (graph?.destroy)
        graph.destroy()
    graph = null
})

</script>

