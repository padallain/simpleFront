import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import Charge from "../views/Charge.vue";
import Routes from "../views/Routes.vue";
import Sign from "../views/Sign.vue";
import Login from "../views/Login.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/charge", component: Charge },
  { path: "/routes", component: Routes },
  { path: "/signup", component: Sign },
  { path: "/login", component: Login },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
