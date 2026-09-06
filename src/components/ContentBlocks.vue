<script setup lang="ts">
import { safeContentUrl, blockStyle, type ContentBlock } from '../content/site-pages';
defineProps<{blocks:ContentBlock[]}>();
</script>
<template>
  <div class="content-blocks" data-no-translate>
    <template v-for="(block,i) in blocks" :key="i">
      <h2 v-if="block.type==='heading'" :style="blockStyle(block.style)">{{block.text}}</h2>
      <figure v-else-if="block.type==='image'"><img v-if="safeContentUrl(block.url)" :src="safeContentUrl(block.url)" :alt="block.text" loading="lazy" referrerpolicy="no-referrer" /></figure>
      <p v-else-if="block.type==='button'"><a :href="safeContentUrl(block.url) || undefined" target="_blank" rel="noopener noreferrer">{{block.text}}</a></p>
      <p v-else :style="blockStyle(block.style)">{{block.text}}</p>
    </template>
  </div>
</template>
<style scoped>
.content-blocks { line-height:1.75; overflow-wrap:anywhere; }
p,h2 { white-space:pre-wrap; } img { max-width:100%; height:auto; } figure { margin:20px 0; } a { color:inherit; text-decoration:underline; }
</style>
