import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import Charge from "../views/Charge.vue";
import Routes from "../views/Routes.vue";
import Sign from "../views/Sign.vue";
import Login from "../views/Login.vue";
import DailyCheck from "../views/DailyCheck.vue";
import DailyCheckHistory from "../views/DailyCheckHistory.vue";


const routes = [
  { path: "/", component: Home },
  { path: "/charge", component: Charge },
  { path: "/routes", component: Routes },
  { path: "/signup", component: Sign },
  { path: "/login", component: Login },
  { path: "/daily-check", component: DailyCheck },
  { path: "/daily-check-history", component: DailyCheckHistory },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  console.log("[router] navigating", {
    from: from.fullPath,
    to: to.fullPath,
    matched: to.matched.map((record) => record.path),
  });
  next();
});

router.afterEach((to) => {
  console.log("[router] navigation resolved", {
    to: to.fullPath,
    matched: to.matched.map((record) => record.path),
  });
});

export default router;
