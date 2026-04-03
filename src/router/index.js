import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import Charge from "../views/Charge.vue";
import Routes from "../views/Routes.vue";
import Sign from "../views/Sign.vue";
import Login from "../views/Login.vue";
import DailyCheck from "../views/DailyCheck.vue";
import DailyCheckHistory from "../views/DailyCheckHistory.vue";
import DriverRoute from "../views/DriverRoute.vue";
import ClientCleanup from "../views/ClientCleanup.vue";
import ReportClientLocation from "../views/ReportClientLocation.vue";
import ClientLocationReports from "../views/ClientLocationReports.vue";
import DispatchIssueReports from "../views/DispatchIssueReports.vue";
import RouteDispatchIssueSummary from "../views/RouteDispatchIssueSummary.vue";


const routes = [
  { path: "/", component: Home },
  { path: "/charge", component: Charge },
  { path: "/routes", component: Routes },
  { path: "/signup", component: Sign },
  { path: "/login", component: Login },
  { path: "/daily-check", component: DailyCheck },
  { path: "/daily-check-history", component: DailyCheckHistory },
  { path: "/driver-route", component: DriverRoute },
  { path: "/driver-route/:routeId/issues-summary", component: RouteDispatchIssueSummary },
  { path: "/report-client-location", component: ReportClientLocation },
  { path: "/internal/dev/client-location-reports", component: ClientLocationReports },
  { path: "/internal/dev/dispatch-issue-reports", component: DispatchIssueReports },
  { path: "/internal/dev/client-cleanup", component: ClientCleanup },
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
