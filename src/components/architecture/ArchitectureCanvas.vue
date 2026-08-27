<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Graph } from '@antv/x6'
import { useArchitectureStore } from '@/stores/architecture'
const host=ref<HTMLDivElement>(); const store=useArchitectureStore(); let graph: Graph
function sync(){if(!graph)return;graph.fromJSON({nodes:store.current.nodes.map(n=>({id:n.id,shape:'rect',x:n.position.x,y:n.position.y,width:n.size.width,height:n.size.height,label:n.name,attrs:{body:{fill:'#111b30',stroke:n.id===store.selectedId?'#38bdf8':'#334766',strokeWidth:n.id===store.selectedId?2:1,rx:10,ry:10},label:{fill:'#e2e8f0',fontSize:14}}})),edges:store.current.connections.map(c=>({id:c.id,source:c.sourceId,target:c.targetId,router:{name:'orth'},connector:{name:'rounded'},attrs:{line:{stroke:'#526889',strokeWidth:1.5,targetMarker:'classic'}}}))})}
onMounted(()=>{if(!host.value)return;graph=new Graph({container:host.value,background:{color:'#0b1020'},grid:{size:16,visible:true,type:'dot',args:{color:'#1c2a43',thickness:1}},panning:true,mousewheel:{enabled:true,modifiers:[]}});graph.on('node:click',({node})=>store.select(node.id));graph.on('node:moving',({node})=>{const n=store.current.nodes.find(item=>item.id===node.id);if(n){n.position={x:node.position().x,y:node.position().y}}});sync()});watch(()=>[store.current.nodes,store.current.connections,store.selectedId],sync,{deep:true});onBeforeUnmount(()=>graph?.dispose())
</script>
<template><div ref="host" class="h-full w-full" aria-label="系統架構圖畫布" /></template>
