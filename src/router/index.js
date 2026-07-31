import { createRouter, createWebHashHistory } from "vue-router";
import Login from "../views/Login.vue";
import RecoverPassword from "../views/RecoverPassword.vue";
import RecoverPasswordCode from "../views/RecoverPasswordCode.vue";
import RecoverPasswordReset from "../views/RecoverPasswordReset.vue";
import { AUTH_ROUTE_PATHS, fetchSession, getAuthState } from "../services/auth";

const Home = () => import("../views/Home.vue");
const Charge = () => import("../views/Charge.vue");
const Routes = () => import("../views/Routes.vue");
const DailyCheck = () => import("../views/DailyCheck.vue");
const DailyCheckHistory = () => import("../views/DailyCheckHistory.vue");
const DriverRoute = () => import("../views/DriverRoute.vue");
const ClientCleanup = () => import("../views/ClientCleanup.vue");
const ReportClientLocation = () => import("../views/ReportClientLocation.vue");
const ClientLocationReports = () => import("../views/ClientLocationReports.vue");
const DispatchIssueReports = () => import("../views/DispatchIssueReports.vue");
const RouteDispatchIssueSummary = () => import("../views/RouteDispatchIssueSummary.vue");
const RouteManagement = () => import("../views/RouteManagement.vue");
const DispatchStatus = () => import("../views/DispatchStatus.vue");
const DriverAnalytics = () => import("../views/DriverAnalytics.vue");
const WarehousePickerAnalytics = () => import("../views/WarehousePickerAnalytics.vue");
const WarehousePicking = () => import("../views/WarehousePicking.vue");
const ClientesCadena = () => import("../views/ClientesCadena.vue");
const VehicleMaintenanceHistory = () => import("../views/VehicleMaintenanceHistory.vue");
const DispatchControl = () => import("../views/DispatchControl.vue");
const AdminUsers = () => import("../views/AdminUsers.vue");

const ROUTER_SESSION_TIMEOUT_MS = Number(import.meta.env.VITE_ROUTER_SESSION_TIMEOUT_MS || 9000);

async function resolveSessionStateWithTimeout(currentAuthState) {
  let timeoutId = null;

  try {
    const sessionTimeoutPromise = new Promise((resolve) => {
      timeoutId = window.setTimeout(() => {
        resolve({
          ...currentAuthState,
          checked: true,
          authenticated: false,
          user: null,
        });
      }, ROUTER_SESSION_TIMEOUT_MS);
    });

    return await Promise.race([
      fetchSession({ force: !currentAuthState.checked }),
      sessionTimeoutPromise,
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}


const routes = [
  { path: "/", component: Home },
  { path: "/charge", component: Charge },
  { path: "/routes", component: Routes },
  { path: "/login", component: Login },
  { path: "/recover-password", component: RecoverPassword },
  { path: "/recover-password/code", component: RecoverPasswordCode },
  { path: "/recover-password/new-password", component: RecoverPasswordReset },
  { path: "/daily-check", component: DailyCheck },
  { path: "/daily-check-history", component: DailyCheckHistory },
  { path: "/driver-route", component: DriverRoute },
  { path: "/driver-route/:routeId/issues-summary", component: RouteDispatchIssueSummary },
  { path: "/dispatch-status", component: DispatchStatus },
  { path: "/dispatch-control", component: DispatchControl },
  { path: "/driver-analytics", component: DriverAnalytics },
  { path: "/warehouse-picker-analytics", component: WarehousePickerAnalytics },
  { path: "/warehouse-picking", component: WarehousePicking },
  { path: "/clientes-cadena", component: ClientesCadena },
  { path: "/vehicle-maintenance-history", component: VehicleMaintenanceHistory },
  { path: "/report-client-location", component: ReportClientLocation },
  { path: "/route-management", component: RouteManagement },
  { path: "/admin-users", component: AdminUsers, meta: { requiresAdmin: true } },
  { path: "/client-location-reports", component: ClientLocationReports },
  { path: "/internal/dev/client-location-reports", component: ClientLocationReports },
  { path: "/internal/dev/dispatch-issue-reports", component: DispatchIssueReports },
  { path: "/internal/dev/client-cleanup", component: ClientCleanup },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const targetPath = to.path;
  const isAuthRoute = AUTH_ROUTE_PATHS.has(targetPath);
  const currentAuthState = getAuthState();

  // Do not block the login/signup/recovery views on first load.
  if (isAuthRoute) {
    if (currentAuthState.checked) {
      if (currentAuthState.authenticated) {
        next("/");
        return;
      }

      next();
      return;
    }

    next();

    resolveSessionStateWithTimeout(currentAuthState)
      .then((sessionState) => {
        const activePath = router.currentRoute.value.path;

        if (sessionState.authenticated && AUTH_ROUTE_PATHS.has(activePath)) {
          router.replace("/");
        }
      })
      .catch((error) => {
        console.warn("[router] deferred auth check failed", error);
      });
    return;
  }

  const sessionState = currentAuthState.checked
    ? currentAuthState
    : await resolveSessionStateWithTimeout(currentAuthState);

  console.log("[router] navigating", {
    from: from.fullPath,
    to: to.fullPath,
    matched: to.matched.map((record) => record.path),
    authenticated: sessionState.authenticated,
  });

  if (!sessionState.authenticated && !isAuthRoute) {
    next({
      path: "/login",
      query: {
        reason: "auth-required",
        redirect: to.fullPath,
      },
    });
    return;
  }

  if (to.meta?.requiresAdmin && !sessionState.user?.isAdmin) {
    next({
      path: "/",
      query: {
        reason: "admin-only",
      },
    });
    return;
  }

  if (sessionState.authenticated && isAuthRoute) {
    next("/");
    return;
  }

  next();
});

router.afterEach((to) => {
  console.log("[router] navigation resolved", {
    to: to.fullPath,
    matched: to.matched.map((record) => record.path),
  });
});

export default router;
