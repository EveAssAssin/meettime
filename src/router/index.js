import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/Home.vue') },
    { path: '/r/:code', name: 'countdown', component: () => import('../views/Countdown.vue') },
    { path: '/r/:code/widget', name: 'widget', component: () => import('../views/Widget.vue') },
  ],
})
