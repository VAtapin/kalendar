<script setup lang="ts">
import WelcomePage from './WelcomePage.vue';
import { navigate } from '../navigation';
import { setInterfaceLanguage } from '../i18n/interface-language';
import { onMounted, onBeforeUnmount, ref } from 'vue';
const compact = ref(window.innerWidth <= 1000);
const resize = () => { compact.value = window.innerWidth <= 1000; };
onMounted(() => window.addEventListener('resize', resize));
onBeforeUnmount(() => window.removeEventListener('resize', resize));
</script>
<template>
  <WelcomePage :recent-project-names="[]" :shared-projects="[]"
    :compact-mode="compact" @create="navigate('/calendar/new')" @open="navigate('/account')"
    @account="navigate('/account')" @admin="navigate('/admin')" @help="navigate('/help')"
    @language-change="setInterfaceLanguage" />
</template>
