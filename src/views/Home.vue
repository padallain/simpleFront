<script setup>
import { computed } from "vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getPendingClientCount,
  getPendingClientQueue,
  queueClientForSync,
  removeQueuedClients,
} from "../services/offlineClientQueue";
import { fetchSession, getAuthState } from "../services/auth";
import { fetchUpcomingVehicleMaintenance } from "../services/vehicleMaintenanceApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const route = useRoute();
const router = useRouter();
const authUser = ref(getAuthState().user || null);
const isAdminUser = computed(() => Boolean(authUser.value?.isAdmin));
const isDriverUser = computed(() => String(authUser.value?.role || "").toLowerCase() === "chofer");
const isWarehouseUser = computed(() => String(authUser.value?.role || "").toLowerCase() === "almacenista");

const latitude = ref("");
const clientCount = ref(0)
const longitude = ref("");
const adminKeyInput = ref("");

const isAdminMode = computed(() => adminKeyInput.value === "4321");
const numberInput = ref("");
const textInput = ref("");
const sucursalInput = ref("");

// --- Búsqueda de sedes de cadena ---
const cadenaSearchId = ref("");
const cadenaSearchResult = ref(null);
const cadenaSearchError = ref("");
const cadenaSearching = ref(false);
const nuevaSedeNombre = ref("");
const nuevaSedeLatitud = ref("");
const nuevaSedeLogitud = ref("");
const guardandoSede = ref(false);
const sedeFeedback = ref(null);
const showCadenaSection = ref(false);
const start = "08:00:00";
const end = "17:00:00";
const serverResponse = ref(null);
const clientData = ref(null);
const homeFeedback = ref("");
const formErrors = ref([]);
const fieldErrors = ref({
  latitude: "",
  longitude: "",
  clientId: "",
  clientName: "",
});
const isSaving = ref(false);
const isFetchingClient = ref(false);
const isSyncingPending = ref(false);
const pendingClientCount = ref(0);
const isOnline = ref(typeof navigator === "undefined" ? true : navigator.onLine);
const maintenanceSchedule = ref([]);
const selectedMaintenanceDate = ref("");
const selectedTodoDate = ref("");
const todoViewMode = ref("date");
const isLoadingMaintenance = ref(false);
const maintenanceScheduleError = ref("");
const maintenanceTodoTitle = ref("");
const maintenanceTodoDate = ref("");
const maintenanceTodoError = ref("");
const maintenanceTodoList = ref([]);
const warehousePerformanceDate = ref(getDateKeyFromValue(new Date()));
const isLoadingWarehousePerformance = ref(false);
const warehousePerformanceError = ref("");
const warehousePerformance = ref({
  totalPedidos: 0,
  totalCajas: 0,
  responsablesActivos: 0,
  metaPedidosPorAlmacenista: 0,
  almacenistasBajoMeta: 0,
  topResponsables: [],
  bajoMetaResponsables: [],
});

const todayDateKey = getDateKeyFromValue(new Date());

const maintenanceCalendarDays = computed(() => {
  const days = [];
  const groupedByDate = groupMaintenanceByDate(maintenanceSchedule.value);

  for (let index = 0; index < 7; index += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const dateKey = getDateKeyFromValue(date);
    const tasks = groupedByDate[dateKey] || [];

    days.push({
      dateKey,
      dayLabel: new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(date).replace(".", ""),
      dayNumber: String(date.getDate()).padStart(2, "0"),
      taskCount: tasks.length,
      hasOverdueTask: tasks.some((task) => Boolean(task?.isOverdue)),
    });
  }

  return days;
});

const selectedMaintenanceTasks = computed(() => {
  const groupedByDate = groupMaintenanceByDate(maintenanceSchedule.value);
  return groupedByDate[selectedMaintenanceDate.value] || [];
});

const selectedDateTodos = computed(() => {
  if (!selectedTodoDate.value) {
    return [];
  }

  return maintenanceTodoList.value.filter((item) => item.dateKey === selectedTodoDate.value);
});

const pendingTodoCount = computed(() => maintenanceTodoList.value.filter((item) => !item.done).length);
const overdueTodoCount = computed(() => maintenanceTodoList.value.filter((item) => !item.done && item.dateKey < todayDateKey).length);
const todayTodoCount = computed(() => maintenanceTodoList.value.filter((item) => !item.done && item.dateKey === todayDateKey).length);
const overdueTodos = computed(() => maintenanceTodoList.value
  .filter((item) => !item.done && item.dateKey < todayDateKey)
  .sort((leftItem, rightItem) => String(leftItem.dateKey).localeCompare(String(rightItem.dateKey))));
const visibleTodos = computed(() => (todoViewMode.value === "overdue" ? overdueTodos.value : selectedDateTodos.value));

const maintenanceTodoCalendarDays = computed(() => {
  const groupedTodos = maintenanceTodoList.value.reduce((accumulator, item) => {
    if (!item?.dateKey) {
      return accumulator;
    }

    if (!accumulator[item.dateKey]) {
      accumulator[item.dateKey] = [];
    }

    accumulator[item.dateKey].push(item);
    return accumulator;
  }, {});

  const days = [];

  for (let index = 0; index < 7; index += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const dateKey = getDateKeyFromValue(date);
    const todosForDay = groupedTodos[dateKey] || [];

    days.push({
      dateKey,
      dayLabel: new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(date).replace(".", ""),
      dayNumber: String(date.getDate()).padStart(2, "0"),
      totalCount: todosForDay.length,
      completedCount: todosForDay.filter((todo) => Boolean(todo.done)).length,
    });
  }

  return days;
});

const pendingMaintenanceCount = computed(() => maintenanceSchedule.value.length);
const overdueMaintenanceCount = computed(() => maintenanceSchedule.value.filter((task) => Boolean(task?.isOverdue)).length);
const todayMaintenanceCount = computed(() => (
  maintenanceSchedule.value.filter((task) => getDateKeyFromValue(task?.fechaProximoServicio) === todayDateKey).length
));

const selectedMaintenanceDateLabel = computed(() => {
  if (!selectedMaintenanceDate.value) {
    return "Pendientes";
  }

  const parsed = new Date(`${selectedMaintenanceDate.value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "Pendientes";
  }

  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(parsed);
});

const selectedTodoDateLabel = computed(() => {
  if (!selectedTodoDate.value) {
    return "Pendientes";
  }

  const parsed = new Date(`${selectedTodoDate.value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "Pendientes";
  }

  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(parsed);
});

const BACKEND_MESSAGE_MAP = {
  "All fields are required": "Completa todos los campos antes de guardar el cliente.",
  "Client with this ID already exists": "Ya existe un cliente con ese ID.",
  "Error registering client": "No se pudo guardar el cliente por un error del servidor.",
  "Client not found": "No se encontro un cliente con ese ID.",
  "Error getting client": "No se pudo consultar el cliente por un error del servidor.",
};

function translateServerMessage(message, fallback) {
  if (!message) {
    return fallback;
  }

  return BACKEND_MESSAGE_MAP[message] || message;
}

function setServerResponse(type, title, message, details = []) {
  serverResponse.value = {
    type,
    title,
    message,
    details,
  };
}

function resetFieldErrors() {
  fieldErrors.value = {
    latitude: "",
    longitude: "",
    clientId: "",
    clientName: "",
  };
}

function clearFieldError(fieldName) {
  fieldErrors.value = {
    ...fieldErrors.value,
    [fieldName]: "",
  };
}

function validateClientForm() {
  const errors = [];
  const clientId = String(numberInput.value ?? "").trim();
  const clientName = textInput.value.trim();
  const latitudeNumber = Number(latitude.value);
  const longitudeNumber = Number(longitude.value);
  const adminKey = adminKeyInput.value.trim();

  resetFieldErrors();

  if (!clientId) {
    const message = "Falta el ID del cliente.";
    errors.push(message);
    fieldErrors.value.clientId = message;
  }

  if (!clientName) {
    const message = "Falta el nombre del cliente.";
    errors.push(message);
    fieldErrors.value.clientName = message;
  }

  // Solo advertir si los campos están vacíos, no exigir clave admin para guardar
  if (!Number.isFinite(latitudeNumber)) {
    const message = "Falta obtener la latitud.";
    errors.push(message);
    fieldErrors.value.latitude = message;
  }
  if (!Number.isFinite(longitudeNumber)) {
    const message = "Falta obtener la longitud.";
    errors.push(message);
    fieldErrors.value.longitude = message;
  }

  return errors;
}

async function parseJsonResponse(response) {
  return response.json().catch(() => null);
}

function refreshPendingClientCount() {
  pendingClientCount.value = getPendingClientCount();
}

function getDateKeyFromValue(value) {
  const parsedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupMaintenanceByDate(records) {
  return records.reduce((accumulator, record) => {
    const dateKey = getDateKeyFromValue(record?.fechaProximoServicio);

    if (!dateKey) {
      return accumulator;
    }

    if (!accumulator[dateKey]) {
      accumulator[dateKey] = [];
    }

    accumulator[dateKey].push(record);
    return accumulator;
  }, {});
}

function formatMaintenanceDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Sin fecha";
  }

  return parsedDate.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMaintenanceStatus(record) {
  const daysUntilService = Number(record?.daysUntilService);

  if (!Number.isFinite(daysUntilService)) {
    return "Fecha pendiente";
  }

  if (daysUntilService < 0) {
    return `Atrasado ${Math.abs(daysUntilService)} dia(s)`;
  }

  if (daysUntilService === 0) {
    return "Se atiende hoy";
  }

  return `Faltan ${daysUntilService} dia(s)`;
}

function formatTodoDateLabel(dateKey) {
  if (!dateKey) {
    return "Sin fecha";
  }

  const parsedDate = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Sin fecha";
  }

  return parsedDate.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatWarehousePerformanceDate(value) {
  if (!value) {
    return "hoy";
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(parsedDate);
}

function selectMaintenanceDate(dateKey) {
  selectedMaintenanceDate.value = dateKey;
}

function selectTodoDate(dateKey) {
  todoViewMode.value = "date";
  selectedTodoDate.value = dateKey;

  if (dateKey) {
    maintenanceTodoDate.value = dateKey;
  }
}

function showOverdueTodos() {
  todoViewMode.value = "overdue";
}

function getMaintenanceTodoStorageKey() {
  const userId = String(
    authUser.value?._id
    || authUser.value?.id
    || authUser.value?.email
    || "admin",
  );
  return `makeroute-maintenance-todo-${userId}`;
}

function saveMaintenanceTodos() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getMaintenanceTodoStorageKey(), JSON.stringify(maintenanceTodoList.value));
}

function loadMaintenanceTodos() {
  if (typeof window === "undefined") {
    return;
  }

  const storedValue = window.localStorage.getItem(getMaintenanceTodoStorageKey());

  if (!storedValue) {
    maintenanceTodoList.value = [];
    return;
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    maintenanceTodoList.value = Array.isArray(parsedValue)
      ? parsedValue.filter((item) => item && item.id && item.title && item.dateKey)
      : [];
  } catch (_error) {
    maintenanceTodoList.value = [];
  }
}

function addMaintenanceTodo() {
  const title = maintenanceTodoTitle.value.trim();
  const dateKey = maintenanceTodoDate.value || selectedTodoDate.value || todayDateKey;

  if (!title) {
    maintenanceTodoError.value = "Escribe una tarea antes de agregar.";
    return;
  }

  if (!dateKey) {
    maintenanceTodoError.value = "Selecciona una fecha para la tarea.";
    return;
  }

  maintenanceTodoList.value = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      dateKey,
      done: false,
      createdAt: new Date().toISOString(),
    },
    ...maintenanceTodoList.value,
  ];

  maintenanceTodoTitle.value = "";
  maintenanceTodoDate.value = dateKey;
  selectedTodoDate.value = dateKey;
  todoViewMode.value = "date";
  maintenanceTodoError.value = "";
  saveMaintenanceTodos();
}

function toggleMaintenanceTodo(todoId) {
  maintenanceTodoList.value = maintenanceTodoList.value.map((item) => (
    item.id === todoId ? { ...item, done: !item.done } : item
  ));
  saveMaintenanceTodos();
}

function deleteMaintenanceTodo(todoId) {
  maintenanceTodoList.value = maintenanceTodoList.value.filter((item) => item.id !== todoId);
  saveMaintenanceTodos();
}

async function loadMaintenanceAgenda() {
  isLoadingMaintenance.value = true;
  maintenanceScheduleError.value = "";

  try {
    const result = await fetchUpcomingVehicleMaintenance(30);
    maintenanceSchedule.value = Array.isArray(result?.mantenimientos) ? result.mantenimientos : [];

    if (!selectedMaintenanceDate.value) {
      selectedMaintenanceDate.value = todayDateKey;
    }

    if (!selectedTodoDate.value) {
      selectedTodoDate.value = todayDateKey;
    }

    if (!maintenanceTodoDate.value) {
      maintenanceTodoDate.value = todayDateKey;
    }
  } catch (error) {
    maintenanceSchedule.value = [];
    maintenanceScheduleError.value = error?.message || "No se pudo cargar la agenda de mantenimiento.";
  } finally {
    isLoadingMaintenance.value = false;
  }
}

async function loadWarehousePerformance() {
  if (!isAdminUser.value) {
    return;
  }

  if (!warehousePerformanceDate.value) {
    warehousePerformanceError.value = "Selecciona una fecha valida para consultar picking.";
    return;
  }

  isLoadingWarehousePerformance.value = true;
  warehousePerformanceError.value = "";

  try {
    const response = await fetch(
      `${API_BASE_URL}/internal/admin/picking-reports/daily-performance?fecha=${encodeURIComponent(warehousePerformanceDate.value)}`,
    );
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      warehousePerformanceError.value = result?.message || "No se pudo cargar el rendimiento diario de picking.";
      warehousePerformance.value = {
        totalPedidos: 0,
        totalCajas: 0,
        responsablesActivos: 0,
        metaPedidosPorAlmacenista: 0,
        almacenistasBajoMeta: 0,
        topResponsables: [],
        bajoMetaResponsables: [],
      };
      return;
    }

    warehousePerformance.value = {
      totalPedidos: Number(result?.resumen?.totalPedidos) || 0,
      totalCajas: Number(result?.resumen?.totalCajas) || 0,
      responsablesActivos: Number(result?.resumen?.responsablesActivos) || 0,
      metaPedidosPorAlmacenista: Number(result?.resumen?.metaPedidosPorAlmacenista) || 0,
      almacenistasBajoMeta: Number(result?.resumen?.almacenistasBajoMeta) || 0,
      topResponsables: Array.isArray(result?.topResponsables) ? result.topResponsables : [],
      bajoMetaResponsables: Array.isArray(result?.bajoMetaResponsables) ? result.bajoMetaResponsables : [],
    };
  } catch (_error) {
    warehousePerformanceError.value = "No se pudo conectar para cargar el rendimiento diario de picking.";
    warehousePerformance.value = {
      totalPedidos: 0,
      totalCajas: 0,
      responsablesActivos: 0,
      metaPedidosPorAlmacenista: 0,
      almacenistasBajoMeta: 0,
      topResponsables: [],
      bajoMetaResponsables: [],
    };
  } finally {
    isLoadingWarehousePerformance.value = false;
  }
}

function resetClientForm() {
  latitude.value = "";
  longitude.value = "";
  numberInput.value = "";
  textInput.value = "";
  sucursalInput.value = "";
  adminKeyInput.value = "";
  formErrors.value = [];
  resetFieldErrors();
}

async function buscarSedes() {
  const id = cadenaSearchId.value.trim();
  if (!id) {
    cadenaSearchError.value = "Ingresa un ID para buscar.";
    return;
  }
  cadenaSearching.value = true;
  cadenaSearchError.value = "";
  cadenaSearchResult.value = null;
  sedeFeedback.value = null;
  nuevaSedeNombre.value = "";
  nuevaSedeLatitud.value = "";
  nuevaSedeLogitud.value = "";

  try {
    const response = await fetch(`${API_BASE_URL}/getClient/${id}/sedes`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      cadenaSearchError.value = data?.message || "Cliente no encontrado.";
    } else {
      cadenaSearchResult.value = data;
    }
  } catch {
    cadenaSearchError.value = "No se pudo conectar con el servidor.";
  } finally {
    cadenaSearching.value = false;
  }
}

async function guardarNuevaSede() {
  if (!cadenaSearchResult.value) return;
  const sucursal = nuevaSedeNombre.value.trim();
  const lat = Number(nuevaSedeLatitud.value);
  const lon = Number(nuevaSedeLogitud.value);

  if (!sucursal || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    sedeFeedback.value = { type: "error", message: "Nombre de sede, latitud y longitud son obligatorios." };
    return;
  }

  guardandoSede.value = true;
  sedeFeedback.value = null;

  try {
    const response = await fetch(`${API_BASE_URL}/registerClient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: cadenaSearchResult.value.id,
        nombre: cadenaSearchResult.value.nombre,
        sucursal,
        latitude: lat,
        longitude: lon,
        start: "08:00:00",
        end: "17:00:00",
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      sedeFeedback.value = { type: "success", message: `Sede "${sucursal}" registrada.` };
      nuevaSedeNombre.value = "";
      nuevaSedeLatitud.value = "";
      nuevaSedeLogitud.value = "";
      await buscarSedes();
    } else {
      sedeFeedback.value = { type: "error", message: data?.message || "No se pudo registrar la sede." };
    }
  } catch {
    sedeFeedback.value = { type: "error", message: "Error de conexion con el servidor." };
  } finally {
    guardandoSede.value = false;
  }
}

async function submitClientPayload(payload) {
  const response = await fetch(`${API_BASE_URL}/registerClient`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await parseJsonResponse(response);

  return {
    ok: response.ok,
    result,
  };
}

async function syncPendingClients(options = {}) {
  if (isSyncingPending.value || !isOnline.value) {
    refreshPendingClientCount();
    return { syncedCount: 0, remainingCount: getPendingClientCount() };
  }

  const { silent = false } = options;
  const queue = getPendingClientQueue();

  if (queue.length === 0) {
    refreshPendingClientCount();
    return { syncedCount: 0, remainingCount: 0 };
  }

  isSyncingPending.value = true;
  const syncedQueueIds = [];
  let syncedCount = 0;
  let blockedByServer = false;

  try {
    for (const item of queue) {
      try {
        const submission = await submitClientPayload(item.payload);

        if (!submission.ok) {
          blockedByServer = true;
          break;
        }

        syncedQueueIds.push(item.queueId);
        syncedCount += 1;
      } catch (_error) {
        break;
      }
    }

    if (syncedQueueIds.length > 0) {
      removeQueuedClients(syncedQueueIds);
      await fetchClientCount();
    }

    refreshPendingClientCount();

    if (!silent) {
      if (syncedCount > 0 && pendingClientCount.value === 0) {
        setServerResponse(
          "success",
          "Sincronizacion completada",
          `Se enviaron ${syncedCount} cliente(s) pendientes al servidor.`,
        );
      } else if (syncedCount > 0) {
        setServerResponse(
          "info",
          "Sincronizacion parcial",
          `Se enviaron ${syncedCount} cliente(s). Aun quedan ${pendingClientCount.value} pendientes.`,
        );
      } else if (blockedByServer) {
        setServerResponse(
          "error",
          "No se pudieron sincronizar los pendientes",
          "El servidor rechazo al menos un cliente pendiente. Revisa los datos antes de reintentar.",
        );
      }
    }

    return {
      syncedCount,
      remainingCount: pendingClientCount.value,
    };
  } finally {
    isSyncingPending.value = false;
  }
}

function handleOnline() {
  isOnline.value = true;
  syncPendingClients();
}

function handleOffline() {
  isOnline.value = false;
}

const fetchClientCount = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/countClients`);
    if (response.ok) {
      const data = await response.json();
      clientCount.value = data.count;
    } else {
      clientCount.value = 0;
    }
  } catch (error) {
    clientCount.value = 0;
  }
};

// Llama a la función al montar el componente
onMounted(async () => {
  const queryClientId = typeof route.query.clientId === "string" ? route.query.clientId.trim() : "";

  if (queryClientId) {
    numberInput.value = queryClientId;
  }

  refreshPendingClientCount();
  fetchClientCount();
  syncPendingClients({ silent: true });
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  try {
    const sessionState = await fetchSession({ force: true });
    authUser.value = sessionState.user || null;

    if (isAdminUser.value) {
      loadMaintenanceAgenda();
      loadMaintenanceTodos();
      loadWarehousePerformance();

      if (!maintenanceTodoDate.value) {
        maintenanceTodoDate.value = selectedMaintenanceDate.value || todayDateKey;
      }
    }
  } catch (_error) {
    authUser.value = null;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
});


const getGeolocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude.value = position.coords.latitude;
        longitude.value = position.coords.longitude;
        clearFieldError("latitude");
        clearFieldError("longitude");
      },
      (error) => {
        console.error("Error obteniendo la geolocalización:", error);
        setServerResponse(
          "error",
          "No se pudo obtener la geolocalizacion",
          "Activa el permiso de ubicacion del navegador e intenta de nuevo.",
        );
      }
    );
  } else {
    console.error("La geolocalización no es soportada por este navegador.");
    setServerResponse(
      "error",
      "Navegador no compatible",
      "Este navegador no permite obtener la geolocalizacion.",
    );
  }
};

const saveClient = async () => {
  formErrors.value = validateClientForm();
  clientData.value = null;
  homeFeedback.value = "";

  if (formErrors.value.length > 0) {
    setServerResponse(
      "error",
      "Revisa el formulario",
      "Corrige los datos marcados antes de guardar el cliente.",
      formErrors.value,
    );
    return;
  }

  const payload = {
    id: numberInput.value.toString().trim(),
    nombre: textInput.value,
    sucursal: sucursalInput.value.trim(),
    latitude: parseFloat(latitude.value),
    longitude: parseFloat(longitude.value),
    start,
    end,
  };

  isSaving.value = true;

  try {
    if (!isOnline.value) {
      queueClientForSync(payload);
      refreshPendingClientCount();
      setServerResponse(
        "info",
        "Cliente guardado sin internet",
        `La ubicacion se capturo y el cliente quedo almacenado en este telefono. Hay ${pendingClientCount.value} pendiente(s) por sincronizar.`,
      );
      clientData.value = null;
      homeFeedback.value = "";
      resetClientForm();
      return;
    }

    const submission = await submitClientPayload(payload);

    if (submission.ok) {
      setServerResponse(
        "success",
        "Cliente guardado",
        translateServerMessage(submission.result?.message, "El cliente se guardo correctamente."),
      );
      clientData.value = null;
      homeFeedback.value = "";
      resetClientForm();
      await fetchClientCount();
    } else {
      setServerResponse(
        "error",
        "No se pudo guardar el cliente",
        translateServerMessage(submission.result?.message, "Ocurrio un problema al guardar el cliente."),
      );
    }
  } catch (error) {
    queueClientForSync(payload);
    refreshPendingClientCount();
    setServerResponse(
      "info",
      "Cliente guardado para sincronizar",
      `No fue posible comunicarse con el servidor, pero la ubicacion quedo almacenada localmente. Hay ${pendingClientCount.value} pendiente(s).`,
    );
    clientData.value = null;
    homeFeedback.value = "";
    resetClientForm();
  } finally {
    isSaving.value = false;
  }
};


const getClientAddress = async () => {
  const clientId = numberInput.value.toString();
  homeFeedback.value = "";
  formErrors.value = [];

  if (!clientId.trim()) {
    setServerResponse(
      "error",
      "Falta el ID del cliente",
      "Ingresa un ID valido para consultar la direccion del cliente.",
    );
    clientData.value = null;
    return;
  }

  isFetchingClient.value = true;

  try {
    const response = await fetch(
      `${API_BASE_URL}/getClient/${clientId}`,
      {
        method: "GET",
      }
    );

    const result = await parseJsonResponse(response);

    if (response.ok) {
      clientData.value = result;
      const title = result?.esCadena
        ? `Cadena encontrada — ${result.totalSedes} sedes registradas`
        : "Cliente encontrado";
      setServerResponse("info", title, `Datos del cliente ${clientId.trim()}.`);
    } else {
      clientData.value = null;
      setServerResponse(
        "error",
        "No se pudo obtener la direccion",
        translateServerMessage(result?.message, response.statusText || "Consulta no disponible."),
      );
    }
  } catch (error) {
    clientData.value = null;
    setServerResponse(
      "error",
      "Sin conexion con el servidor",
      error.message || "No fue posible consultar el cliente.",
    );
  } finally {
    isFetchingClient.value = false;
  }
};

async function copyMapsLink() {
  if (!clientData.value?.googleMapsLink) {
    return;
  }

  homeFeedback.value = "";

  try {
    await navigator.clipboard.writeText(clientData.value.googleMapsLink);
    homeFeedback.value = "Link de Google Maps copiado.";
  } catch (_error) {
    homeFeedback.value = "No se pudo copiar automaticamente.";
  }
}

const goToClientLocationReports = () => {
  router.push('/client-location-reports');
};

const goToDailyCheck = () => {
  router.push('/daily-check');
};

const goToDriverRoute = () => {
  router.push('/driver-route');
};

const goToFuelReport = () => {
  router.push('/fuel-report');
};

const goToRouteManagement = () => {
  router.push('/route-management');
};

const goToDailyCheckHistory = () => {
  router.push('/daily-check-history');
};

const goToDispatchStatus = () => {
  router.push('/dispatch-status');
};

const goToWarehousePicking = () => {
  router.push('/warehouse-picking');
};

const goToVehicleMaintenance = () => {
  router.push('/vehicle-maintenance-history');
};

const handleMaintenanceAgendaClick = (event) => {
  const clickedElement = event?.target;
  if (clickedElement instanceof Element && clickedElement.closest('button, a, input, select, textarea, label')) {
    return;
  }

  goToVehicleMaintenance();
};

const goToAdminUsers = () => {
  router.push('/admin-users');
};


</script>

<template>
  <section class="home-page">
    <div class="home-container">

      <!-- ── Hero ──────────────────────────────────── -->
      <header class="home-hero">
        <div class="hero-status">
          <span class="hero-status-dot" :class="isOnline ? 'dot-online' : 'dot-offline'"></span>
          <span>{{ isOnline ? 'Conectado' : 'Sin conexión' }}</span>
          <span class="hero-status-sep">·</span>
          <span>MakeRoute</span>
        </div>
        <h1 class="home-title">
          Alta y consulta
          <span class="title-gradient">de clientes</span>
        </h1>
        <p class="home-subtitle">
          Captura ubicaciones, registra clientes y consulta datos guardados desde una sola pantalla.
        </p>
      </header>

      <!-- ── Stat bar ───────────────────────────────── -->
      <div class="stat-bar">
        <div class="stat-item">
          <strong class="stat-number">{{ clientCount }}</strong>
          <span class="stat-label">Clientes en BD</span>
        </div>
        <div class="stat-sep"></div>
        <div class="stat-item">
          <strong class="stat-number" :class="pendingClientCount > 0 ? 'stat-number-warn' : ''">{{ pendingClientCount }}</strong>
          <span class="stat-label">Pendientes sync</span>
        </div>
        <div class="stat-sep stat-hide-sm"></div>
        <div class="stat-item stat-item-status stat-hide-sm">
          <span class="status-indicator" :class="isOnline ? 'status-online' : 'status-offline'"></span>
          <span class="stat-label">{{ isOnline ? 'En línea' : 'Sin conexión' }}</span>
        </div>
      </div>

      <section v-if="isAdminUser" class="warehouse-performance-panel" aria-label="Rendimiento diario de almacenistas">
        <div class="warehouse-performance-header">
          <div>
            <p class="warehouse-performance-kicker">Rendimiento de almacen</p>
            <h2>Picking diario por almacenista</h2>
            <p>
              Resumen del {{ formatWarehousePerformanceDate(warehousePerformanceDate) }} con foco en actividad y alertas de bajo picking.
            </p>
          </div>

          <div class="warehouse-performance-search">
            <label for="warehousePerformanceDate">Fecha</label>
            <div class="warehouse-performance-search-row">
              <input id="warehousePerformanceDate" v-model="warehousePerformanceDate" type="date" />
              <button class="btn btn-secondary" type="button" :disabled="isLoadingWarehousePerformance" @click="loadWarehousePerformance">
                {{ isLoadingWarehousePerformance ? "Consultando..." : "Consultar" }}
              </button>
            </div>
          </div>
        </div>

        <p v-if="warehousePerformanceError" class="warehouse-performance-error">{{ warehousePerformanceError }}</p>

        <div class="warehouse-performance-stats">
          <article class="warehouse-performance-stat">
            <strong>{{ warehousePerformance.totalPedidos }}</strong>
            <span>Pedidos del dia</span>
          </article>
          <article class="warehouse-performance-stat">
            <strong>{{ warehousePerformance.totalCajas }}</strong>
            <span>Cajas registradas</span>
          </article>
          <article class="warehouse-performance-stat">
            <strong>{{ warehousePerformance.responsablesActivos }}</strong>
            <span>Almacenistas activos</span>
          </article>
          <article class="warehouse-performance-stat warehouse-performance-stat-alert">
            <strong>{{ warehousePerformance.almacenistasBajoMeta }}</strong>
            <span>Bajo meta</span>
          </article>
        </div>

        <div class="warehouse-performance-lists">
          <article class="warehouse-performance-list-card">
            <div class="warehouse-performance-list-header">
              <strong>Top rendimiento</strong>
              <span>Meta: {{ warehousePerformance.metaPedidosPorAlmacenista }} pedidos</span>
            </div>
            <p v-if="!warehousePerformance.topResponsables.length" class="warehouse-performance-empty">
              No hay registros de picking para esta fecha.
            </p>
            <ul v-else class="warehouse-performance-list">
              <li v-for="worker in warehousePerformance.topResponsables" :key="`top-${worker.responsableId}`">
                <span>{{ worker.responsableId }}</span>
                <strong>{{ worker.totalPedidos }} pedidos · {{ worker.totalCajas }} cajas</strong>
              </li>
            </ul>
          </article>

          <article class="warehouse-performance-list-card">
            <div class="warehouse-performance-list-header">
              <strong>Alertas de bajo picking</strong>
              <span>{{ warehousePerformance.bajoMetaResponsables.length }} almacenista(s)</span>
            </div>
            <p v-if="!warehousePerformance.bajoMetaResponsables.length" class="warehouse-performance-empty">
              No hay alertas. Todos cumplen la meta del dia.
            </p>
            <ul v-else class="warehouse-performance-list">
              <li v-for="worker in warehousePerformance.bajoMetaResponsables" :key="`low-${worker.responsableId}`">
                <span>{{ worker.responsableId }}</span>
                <strong>Faltan {{ worker.faltanPedidos }} pedidos</strong>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <div v-if="isAdminUser" class="admin-agenda-row">
        <section class="maintenance-agenda" aria-label="Agenda de mantenimiento" @click="handleMaintenanceAgendaClick">
          <div class="maintenance-agenda-header">
            <div>
              <p class="agenda-eyebrow">Tareas pendientes</p>
              <h2>Agenda de mantenimiento</h2>
              <p class="agenda-copy">Al entrar puedes revisar de inmediato que unidades necesitan atencion.</p>
            </div>
            <div class="agenda-actions">
              <button class="btn btn-secondary" type="button" :disabled="isLoadingMaintenance" @click="loadMaintenanceAgenda">
                {{ isLoadingMaintenance ? "Actualizando..." : "Actualizar agenda" }}
              </button>
              <button class="btn btn-save" type="button" @click="goToVehicleMaintenance">Abrir mantenimiento</button>
            </div>
          </div>

          <div class="agenda-stat-grid">
            <article class="agenda-stat-item">
              <strong>{{ pendingMaintenanceCount }}</strong>
              <span>Total pendientes</span>
            </article>
            <article class="agenda-stat-item agenda-stat-alert">
              <strong>{{ overdueMaintenanceCount }}</strong>
              <span>Atrasados</span>
            </article>
            <article class="agenda-stat-item">
              <strong>{{ todayMaintenanceCount }}</strong>
              <span>Para hoy</span>
            </article>
          </div>

          <p v-if="maintenanceScheduleError" class="agenda-error">{{ maintenanceScheduleError }}</p>

          <div class="agenda-calendar-strip">
            <button
              v-for="day in maintenanceCalendarDays"
              :key="day.dateKey"
              class="calendar-day"
              :class="{
                'calendar-day-active': selectedMaintenanceDate === day.dateKey,
                'calendar-day-has-overdue': day.hasOverdueTask,
              }"
              type="button"
              @click="selectMaintenanceDate(day.dateKey)"
            >
              <span class="calendar-day-label">{{ day.dayLabel }}</span>
              <span class="calendar-day-number">{{ day.dayNumber }}</span>
              <span class="calendar-day-count">{{ day.taskCount }}</span>
            </button>
          </div>

          <div class="agenda-task-list">
            <h3>{{ selectedMaintenanceDateLabel }}</h3>
            <p v-if="isLoadingMaintenance" class="agenda-empty">Cargando mantenimientos pendientes...</p>
            <p v-else-if="!selectedMaintenanceTasks.length" class="agenda-empty">No hay tareas pendientes para este dia.</p>
            <article v-for="task in selectedMaintenanceTasks" :key="task._id || `${task.placa}-${task.fechaProximoServicio}`" class="agenda-task-card">
              <div>
                <p class="agenda-task-title">{{ task.titulo || "Mantenimiento" }}</p>
                <p class="agenda-task-meta">
                  <strong>{{ task.placa || "Sin placa" }}</strong>
                  <span>{{ task.tipoServicio || "Servicio" }}</span>
                  <span>{{ formatMaintenanceDate(task.fechaProximoServicio) }}</span>
                </p>
              </div>
              <span class="agenda-task-status" :class="task.isOverdue ? 'agenda-task-status-alert' : ''">
                {{ formatMaintenanceStatus(task) }}
              </span>
            </article>
          </div>
        </section>

          <div class="agenda-todo-panel" aria-label="Tareas pendientes">
            <h3 class="agenda-todo-title">Tareas pendientes</h3>
            <p class="agenda-todo-copy">Agrega recordatorios manuales para la fecha seleccionada.</p>

            <div class="agenda-stat-grid agenda-todo-stat-grid">
              <article class="agenda-stat-item">
                <strong>{{ pendingTodoCount }}</strong>
                <span>Total pendientes</span>
              </article>
              <button
                class="agenda-stat-item agenda-stat-alert agenda-stat-item-button"
                :class="{ 'agenda-stat-item-active': todoViewMode === 'overdue' }"
                type="button"
                @click="showOverdueTodos"
              >
                <strong>{{ overdueTodoCount }}</strong>
                <span>Atrasados</span>
              </button>
              <article class="agenda-stat-item">
                <strong>{{ todayTodoCount }}</strong>
                <span>Para hoy</span>
              </article>
            </div>

            <div class="agenda-todo-form">
              <input
                v-model="maintenanceTodoTitle"
                type="text"
                maxlength="90"
                placeholder="Ej. Comprar filtro de aceite"
              />
              <input
                v-model="maintenanceTodoDate"
                type="date"
              />
              <button class="btn btn-save" type="button" @click="addMaintenanceTodo">Agregar</button>
            </div>

            <p v-if="maintenanceTodoError" class="agenda-error">{{ maintenanceTodoError }}</p>

            <div class="agenda-todo-calendar-strip">
              <button
                v-for="day in maintenanceTodoCalendarDays"
                :key="`todo-${day.dateKey}`"
                class="calendar-day todo-calendar-day"
                :class="{
                  'calendar-day-active': selectedTodoDate === day.dateKey,
                }"
                type="button"
                @click="selectTodoDate(day.dateKey)"
              >
                <span class="calendar-day-label">{{ day.dayLabel }}</span>
                <span class="calendar-day-number">{{ day.dayNumber }}</span>
                <span class="calendar-day-count">{{ day.totalCount }}</span>
                <span class="todo-day-progress" v-if="day.totalCount > 0">{{ day.completedCount }}/{{ day.totalCount }}</span>
              </button>
            </div>

            <div class="agenda-todo-list">
              <h4 class="agenda-todo-list-title">
                {{ todoViewMode === "overdue" ? "To-dos atrasados" : `To-dos del ${selectedTodoDateLabel}` }}
              </h4>
              <p v-if="!visibleTodos.length" class="agenda-empty">
                {{ todoViewMode === "overdue" ? "No hay to-dos atrasados." : "No hay to-dos para este dia." }}
              </p>
              <article v-for="todo in visibleTodos" :key="todo.id" class="agenda-todo-item agenda-todo-card">
                <div class="agenda-todo-main">
                  <label class="agenda-todo-check">
                    <input type="checkbox" :checked="todo.done" @change="toggleMaintenanceTodo(todo.id)" />
                    <span :class="todo.done ? 'agenda-todo-done' : ''">{{ todo.title }}</span>
                  </label>
                  <span class="agenda-todo-date">{{ formatTodoDateLabel(todo.dateKey) }}</span>
                </div>
                <button class="agenda-todo-delete" type="button" @click="deleteMaintenanceTodo(todo.id)">Quitar</button>
              </article>
            </div>
          </div>
        </div>

      <!-- ── Module navigation ──────────────────────── -->
      <nav class="modules-grid" aria-label="Módulos del sistema">
        <button v-if="isDriverUser" class="module-card" type="button" @click="goToDriverRoute">
          <span class="mod-icon" style="--c:#60a5fa;--b:rgba(96,165,250,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18l6-6-6-6"/><path d="M3 12h12"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Mi ruta</strong>
            <em>Ver y editar paradas</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button v-if="isDriverUser" class="module-card" type="button" @click="goToDailyCheck">
          <span class="mod-icon" style="--c:#34d399;--b:rgba(52,211,153,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Reporte diario</strong>
            <em>Estado del vehiculo</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button v-if="isDriverUser" class="module-card" type="button" @click="goToFuelReport">
          <span class="mod-icon" style="--c:#f59e0b;--b:rgba(245,158,11,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2z"/><path d="M6 7h8v14H6z"/><path d="M18 7h1a2 2 0 0 0 2-2V4"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Combustible</strong>
            <em>Registrar recarga</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <template v-if="isAdminUser || isWarehouseUser">
        <button v-if="isWarehouseUser || isAdminUser" class="module-card module-card-wide" type="button" @click="goToWarehousePicking">
          <span class="mod-icon" style="--c:#2dd4bf;--b:rgba(45,212,191,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Picking</strong>
            <em>Registrar cajas y pedidos</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button v-if="isAdminUser" class="module-card" type="button" @click="goToWarehousePickerAnalytics">
          <span class="mod-icon" style="--c:#38bdf8;--b:rgba(56,189,248,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Analisis almacenistas</strong>
            <em>Resumen de productividad</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <template v-if="isAdminUser">
        <button class="module-card" type="button" @click="goToClientLocationReports">
          <span class="mod-icon" style="--c:#f59e0b;--b:rgba(245,158,11,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Denuncias</strong>
            <em>Reportes públicos</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button class="module-card" type="button" @click="goToRouteManagement">
          <span class="mod-icon" style="--c:#60a5fa;--b:rgba(96,165,250,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Rutas</strong>
            <em>Administrar</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button class="module-card" type="button" @click="goToDailyCheckHistory">
          <span class="mod-icon" style="--c:#34d399;--b:rgba(52,211,153,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Chequeos</strong>
            <em>Historial camiones</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button class="module-card" type="button" @click="goToDispatchStatus">
          <span class="mod-icon" style="--c:#a78bfa;--b:rgba(167,139,250,0.12)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Despachos</strong>
            <em>Estatus de rutas</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>

        <button v-if="isAdminUser" class="module-card module-card-admin" type="button" @click="goToAdminUsers">
          <span class="mod-icon" style="--c:#fb7185;--b:rgba(251,113,133,0.14)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </span>
          <span class="mod-text">
            <strong>Usuarios admin</strong>
            <em>Aprobar y gestionar accesos</em>
          </span>
          <span class="mod-chevron">›</span>
        </button>
        </template>
        </template>
      </nav>

      <!-- ── Form card ──────────────────────────────── -->
      <div class="form-card">
        <div class="form-card-header">
          <div class="form-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <div>
            <h2 class="form-card-title">Alta de cliente</h2>
            <p class="form-card-desc">Completa los datos para registrar o consultar un cliente.</p>
          </div>
        </div>

        <div class="offline-banner" :class="isOnline ? '' : 'offline-banner-warning'">
          <div>
            <strong>{{ isOnline ? 'Modo sincronizable' : 'Modo sin internet' }}</strong>
            <p>
              {{ isOnline
                ? `Hay ${pendingClientCount} cliente(s) pendiente(s) por sincronizar en este dispositivo.`
                : `Puedes capturar ubicaciones sin internet. Se guardaran localmente y luego se enviaran. Pendientes: ${pendingClientCount}.` }}
            </p>
          </div>
          <button class="btn btn-secondary sync-button" :disabled="isSyncingPending || pendingClientCount === 0 || !isOnline" @click="syncPendingClients()">
            {{ isSyncingPending ? "Sincronizando..." : "Sincronizar" }}
          </button>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="adminKeyInput">Clave admin</label>
            <input id="adminKeyInput" type="password" v-model="adminKeyInput" maxlength="8" placeholder="Solo para edición manual" />
          </div>
          <div class="form-group">
            <label for="latitude">Latitud</label>
            <input id="latitude" :class="{ 'input-error': fieldErrors.latitude }" type="text" v-model="latitude" :readonly="!isAdminMode" />
            <p v-if="fieldErrors.latitude" class="field-error">{{ fieldErrors.latitude }}</p>
          </div>
          <div class="form-group">
            <label for="longitude">Longitud</label>
            <input id="longitude" :class="{ 'input-error': fieldErrors.longitude }" type="text" v-model="longitude" :readonly="!isAdminMode" />
            <p v-if="fieldErrors.longitude" class="field-error">{{ fieldErrors.longitude }}</p>
          </div>
          <div class="form-group">
            <label for="numberInput">ID del cliente</label>
            <input id="numberInput" :class="{ 'input-error': fieldErrors.clientId }" type="text" inputmode="numeric" v-model="numberInput" placeholder="Ej. 0504036749" @input="clearFieldError('clientId')" />
            <p v-if="fieldErrors.clientId" class="field-error">{{ fieldErrors.clientId }}</p>
          </div>
          <div class="form-group">
            <label for="textInput">Nombre del cliente</label>
            <input id="textInput" :class="{ 'input-error': fieldErrors.clientName }" type="text" v-model="textInput" maxlength="80" @input="clearFieldError('clientName')" />
            <p v-if="fieldErrors.clientName" class="field-error">{{ fieldErrors.clientName }}</p>
          </div>
          <div class="form-group">
            <label for="sucursalInput">Sede (solo para cadenas)</label>
            <input id="sucursalInput" type="text" v-model="sucursalInput" maxlength="60" placeholder="Sede Norte — dejar vacío si no es cadena" />
          </div>
        </div>

        <div v-if="formErrors.length" class="validation-card">
          <strong>Corrige esto antes de continuar:</strong>
          <ul>
            <li v-for="error in formErrors" :key="error">{{ error }}</li>
          </ul>
        </div>

        <div class="button-group">
          <button class="btn btn-geo" type="button" @click="getGeolocation">Obtener ubicación</button>
          <button class="btn btn-save" type="button" :disabled="isSaving" @click="saveClient">{{ isSaving ? "Guardando..." : "Guardar cliente" }}</button>
          <button class="btn btn-query" type="button" :disabled="isFetchingClient" @click="getClientAddress">{{ isFetchingClient ? "Consultando..." : "Consultar cliente" }}</button>
        </div>

        <!-- Sección de cadenas y sedes -->
        <div class="cadena-toggle-row">
          <button class="cadena-toggle-btn" type="button" @click="showCadenaSection = !showCadenaSection">
            {{ showCadenaSection ? '▲ Ocultar sedes de cadena' : '▼ Ver / agregar sedes de una cadena' }}
          </button>
        </div>

        <div v-if="showCadenaSection" class="cadena-section">
          <p class="cadena-desc">Busca un cliente por ID para ver todas sus sedes registradas o agregar una nueva.</p>

          <div class="cadena-search-row">
            <input
              v-model="cadenaSearchId"
              type="text"
              placeholder="ID del cliente cadena"
              class="cadena-input"
              @keyup.enter="buscarSedes"
            />
            <button class="btn btn-save cadena-search-btn" type="button" :disabled="cadenaSearching" @click="buscarSedes">
              {{ cadenaSearching ? 'Buscando...' : 'Buscar' }}
            </button>
          </div>

          <p v-if="cadenaSearchError" class="field-error">{{ cadenaSearchError }}</p>

          <div v-if="cadenaSearchResult" class="cadena-result">
            <p class="cadena-result-title">
              <strong>{{ cadenaSearchResult.nombre }}</strong>
              — {{ cadenaSearchResult.totalSedes }} sede(s) registrada(s)
            </p>

            <div class="sedes-grid">
              <a
                v-for="sede in cadenaSearchResult.sedes"
                :key="sede.sucursal || '_'"
                :href="sede.googleMapsLink || '#'"
                target="_blank"
                class="sede-chip"
                :title="sede.googleMapsLink ? 'Ver en Google Maps' : ''"
              >
                <strong>{{ sede.sucursal || 'Principal' }}</strong>
                <span>{{ sede.location?.latitude?.toFixed(4) }}, {{ sede.location?.longitude?.toFixed(4) }}</span>
              </a>
            </div>

            <div class="nueva-sede-form">
              <p class="nueva-sede-label">Agregar nueva sede a <strong>{{ cadenaSearchResult.nombre }}</strong>:</p>
              <div class="nueva-sede-grid">
                <input v-model="nuevaSedeNombre" type="text" placeholder="Nombre de la sede (ej. Sede Este)" class="cadena-input" />
                <input v-model="nuevaSedeLatitud" type="number" step="any" placeholder="Latitud" class="cadena-input" />
                <input v-model="nuevaSedeLogitud" type="number" step="any" placeholder="Longitud" class="cadena-input" />
              </div>
              <button class="btn btn-save" type="button" :disabled="guardandoSede" @click="guardarNuevaSede">
                {{ guardandoSede ? 'Registrando...' : 'Registrar sede' }}
              </button>
              <p v-if="sedeFeedback" :class="['sede-feedback', sedeFeedback.type === 'success' ? 'sede-feedback-ok' : 'sede-feedback-err']">
                {{ sedeFeedback.message }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="serverResponse"
        :class="[
          'response-card',
          `response-card-${serverResponse.type || 'info'}`,
        ]"
      >
        <strong>{{ serverResponse.title }}</strong>
        <p class="response-message">{{ serverResponse.message }}</p>
        <ul v-if="serverResponse.details?.length" class="response-list">
          <li v-for="detail in serverResponse.details" :key="detail">{{ detail }}</li>
        </ul>
      </div>

      <div v-if="clientData" class="response-card response-card-info">
        <strong>Datos del cliente:</strong>
        <pre>{{ typeof clientData === 'string' ? clientData : JSON.stringify(clientData, null, 2) }}</pre>
        <div v-if="clientData.googleMapsLink" class="maps-link-row">
          <input :value="clientData.googleMapsLink" type="text" readonly class="maps-link-input" />
          <button class="btn btn-secondary maps-copy-button" type="button" @click="copyMapsLink">Copiar link</button>
          <a
            :href="clientData.googleMapsLink"
            target="_blank"
            class="maps-link"
          >
            Ver ubicación en Google Maps
          </a>
        </div>
        <p v-if="homeFeedback" class="maps-feedback">{{ homeFeedback }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Base ─────────────────────────────────────────── */
.home-page {
  min-height: calc(100vh - 56px);
  height: calc(100vh - 56px);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 2rem 1rem 3rem;
  background:
    radial-gradient(circle at top left, rgba(87, 140, 255, 0.18), transparent 34%),
    radial-gradient(circle at top right, rgba(124, 58, 237, 0.16), transparent 28%),
    linear-gradient(180deg, #0b1321 0%, #10213c 52%, #0b1321 100%);
}

.home-container {
  max-width: 960px;
  margin: 0 auto;
  text-align: center;
}

/* ── Hero ─────────────────────────────────────────── */
.home-hero {
  margin-bottom: 1.75rem;
}

.hero-status {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 1rem;
  padding: 0.3rem 0.9rem;
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(159, 209, 255, 0.14);
  font-size: 0.78rem;
  color: rgba(243, 246, 251, 0.6);
}

.hero-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-online {
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.7);
}

.dot-offline {
  background: #f87171;
  box-shadow: 0 0 6px rgba(248, 113, 113, 0.6);
}

.hero-status-sep {
  opacity: 0.3;
}

.home-title {
  margin: 0;
  color: #f3f6fb;
  font-size: clamp(1.9rem, 4.5vw, 2.9rem);
  line-height: 1.18;
  letter-spacing: -0.02em;
}

.title-gradient {
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.home-subtitle {
  max-width: 580px;
  margin: 0.8rem auto 0;
  color: rgba(243, 246, 251, 0.58);
  font-size: 0.97rem;
  line-height: 1.6;
}

/* ── Stat bar ─────────────────────────────────────── */
.stat-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;
  padding: 1rem 2rem;
  border-radius: 20px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.12);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-item-status {
  flex-direction: row;
  gap: 0.5rem;
}

.stat-number {
  font-size: 1.6rem;
  font-weight: 700;
  color: #f3f6fb;
  line-height: 1;
}

.stat-number-warn {
  color: #fbbf24;
}

.stat-label {
  font-size: 0.72rem;
  color: rgba(243, 246, 251, 0.42);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.stat-sep {
  width: 1px;
  height: 32px;
  background: rgba(159, 209, 255, 0.1);
  flex-shrink: 0;
}

.status-indicator {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-online {
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.55);
}

.status-offline {
  background: #f87171;
  box-shadow: 0 0 8px rgba(248, 113, 113, 0.5);
}

/* ── Warehouse performance ────────────────────────── */
.warehouse-performance-panel {
  margin-bottom: 1.15rem;
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.74);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
  text-align: left;
}

.warehouse-performance-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.warehouse-performance-kicker {
  margin: 0;
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(159, 209, 255, 0.75);
}

.warehouse-performance-header h2 {
  margin: 0.28rem 0 0;
  color: #f3f6fb;
  font-size: 1.28rem;
}

.warehouse-performance-header p {
  margin: 0.45rem 0 0;
  color: rgba(243, 246, 251, 0.58);
  font-size: 0.88rem;
}

.warehouse-performance-search {
  min-width: 240px;
}

.warehouse-performance-search label {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.82rem;
  color: rgba(243, 246, 251, 0.72);
}

.warehouse-performance-search-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.warehouse-performance-search-row input {
  min-width: 0;
}

.warehouse-performance-error {
  margin: 0.85rem 0 0;
  color: #ffb4b4;
  font-size: 0.87rem;
}

.warehouse-performance-stats {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}

.warehouse-performance-stat {
  border-radius: 14px;
  padding: 0.75rem 0.8rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(159, 209, 255, 0.14);
  display: grid;
  gap: 0.2rem;
}

.warehouse-performance-stat strong {
  color: #f3f6fb;
  font-size: 1.2rem;
  line-height: 1;
}

.warehouse-performance-stat span {
  color: rgba(243, 246, 251, 0.62);
  font-size: 0.78rem;
}

.warehouse-performance-stat-alert {
  border-color: rgba(248, 113, 113, 0.38);
  background: rgba(86, 26, 26, 0.35);
}

.warehouse-performance-lists {
  margin-top: 0.95rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.warehouse-performance-list-card {
  border-radius: 16px;
  padding: 0.9rem;
  border: 1px solid rgba(159, 209, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
}

.warehouse-performance-list-header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: baseline;
}

.warehouse-performance-list-header strong {
  color: #f3f6fb;
}

.warehouse-performance-list-header span {
  color: rgba(243, 246, 251, 0.58);
  font-size: 0.78rem;
}

.warehouse-performance-empty {
  margin: 0.7rem 0 0;
  color: rgba(243, 246, 251, 0.62);
  font-size: 0.86rem;
}

.warehouse-performance-list {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.55rem;
}

.warehouse-performance-list li {
  padding: 0.55rem 0.6rem;
  border-radius: 12px;
  border: 1px solid rgba(159, 209, 255, 0.12);
  background: rgba(10, 19, 34, 0.55);
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
}

.warehouse-performance-list li span {
  color: rgba(243, 246, 251, 0.8);
  overflow-wrap: anywhere;
}

.warehouse-performance-list li strong {
  color: #f3f6fb;
  font-size: 0.86rem;
  text-align: right;
}

/* ── Maintenance agenda ───────────────────────────── */
.admin-agenda-row {
  margin-bottom: 1.25rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
  align-items: stretch;
}

.maintenance-agenda {
  padding: 1.2rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.74);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
  text-align: left;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.maintenance-agenda-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.agenda-eyebrow {
  margin: 0;
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(159, 209, 255, 0.75);
}

.maintenance-agenda h2 {
  margin: 0.28rem 0 0;
  color: #f3f6fb;
  font-size: 1.28rem;
}

.agenda-copy {
  margin: 0.45rem 0 0;
  color: rgba(243, 246, 251, 0.58);
  font-size: 0.88rem;
}

.agenda-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.agenda-stat-grid {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.agenda-stat-item {
  border-radius: 14px;
  padding: 0.75rem 0.8rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(159, 209, 255, 0.14);
  display: grid;
  gap: 0.2rem;
}

.agenda-stat-item strong {
  color: #f3f6fb;
  font-size: 1.2rem;
  line-height: 1;
}

.agenda-stat-item span {
  color: rgba(243, 246, 251, 0.62);
  font-size: 0.78rem;
}

.agenda-stat-alert {
  border-color: rgba(248, 113, 113, 0.38);
  background: rgba(86, 26, 26, 0.35);
}

.agenda-error {
  margin: 0.9rem 0 0;
  color: #ffb4b4;
  font-size: 0.87rem;
}

.agenda-calendar-strip {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
}

.calendar-day {
  border-radius: 12px;
  border: 1px solid rgba(159, 209, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(243, 246, 251, 0.82);
  min-height: 82px;
  display: grid;
  place-content: center;
  gap: 0.1rem;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.18s, background 0.18s, transform 0.12s;
}

.calendar-day:hover {
  border-color: rgba(159, 209, 255, 0.36);
  background: rgba(69, 167, 255, 0.11);
}

.calendar-day:active {
  transform: scale(0.98);
}

.calendar-day-label {
  text-transform: capitalize;
  font-size: 0.73rem;
}

.calendar-day-number {
  font-size: 1.05rem;
  font-weight: 700;
}

.calendar-day-count {
  display: inline-flex;
  justify-content: center;
  min-width: 20px;
  padding: 0.1rem 0.35rem;
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 0.7rem;
  font-weight: 600;
  margin: 0 auto;
}

.calendar-day-active {
  border-color: rgba(96, 165, 250, 0.8);
  background: rgba(69, 167, 255, 0.24);
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.48);
}

.calendar-day-has-overdue {
  border-color: rgba(248, 113, 113, 0.4);
}

.agenda-task-list {
  margin-top: 1rem;
  display: grid;
  gap: 0.65rem;
}

.agenda-task-list h3 {
  margin: 0;
  color: #f3f6fb;
  font-size: 0.95rem;
  text-transform: capitalize;
}

.agenda-empty {
  margin: 0;
  color: rgba(243, 246, 251, 0.6);
  font-size: 0.85rem;
}

.agenda-task-card {
  border-radius: 14px;
  border: 1px solid rgba(159, 209, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.72rem 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.agenda-task-title {
  margin: 0;
  color: #f3f6fb;
  font-size: 0.9rem;
}

.agenda-task-meta {
  margin: 0.3rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  color: rgba(243, 246, 251, 0.56);
  font-size: 0.78rem;
}

.agenda-task-meta strong {
  color: rgba(243, 246, 251, 0.82);
}

.agenda-task-status {
  flex-shrink: 0;
  padding: 0.3rem 0.58rem;
  border-radius: 100px;
  font-size: 0.74rem;
  color: #8df0b4;
  background: rgba(22, 52, 36, 0.42);
  border: 1px solid rgba(42, 181, 125, 0.3);
}

.agenda-task-status-alert {
  color: #ffb4b4;
  background: rgba(86, 26, 26, 0.42);
  border-color: rgba(248, 113, 113, 0.34);
}

.agenda-todo-panel {
  border-radius: 16px;
  padding: 0.85rem;
  border: 1px solid rgba(159, 209, 255, 0.16);
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 0.72rem;
  height: 100%;
  align-content: start;
  text-align: left;
}

.agenda-todo-stat-grid {
  margin-top: 0;
}

.agenda-todo-title {
  margin: 0;
  font-size: 0.95rem;
  color: #f3f6fb;
}

.agenda-todo-copy {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(243, 246, 251, 0.56);
}

.agenda-todo-form {
  display: grid;
  gap: 0.5rem;
}

.agenda-todo-list {
  display: grid;
  gap: 0.5rem;
}

.agenda-todo-list-title {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(243, 246, 251, 0.74);
}

.agenda-todo-calendar-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.todo-calendar-day {
  min-height: 92px;
}

.todo-day-progress {
  font-size: 0.66rem;
  color: rgba(243, 246, 251, 0.62);
}

.agenda-todo-item {
  border-radius: 12px;
  border: 1px solid rgba(159, 209, 255, 0.14);
  background: rgba(255, 255, 255, 0.03);
  padding: 0.5rem 0.6rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.45rem;
}

.agenda-todo-card {
  background: rgba(255, 255, 255, 0.05);
}

.agenda-stat-item-button {
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  appearance: none;
}

.agenda-stat-item-button:hover {
  border-color: rgba(248, 113, 113, 0.55);
}

.agenda-stat-item-button:focus-visible {
  outline: 2px solid rgba(248, 113, 113, 0.6);
  outline-offset: 2px;
}

.agenda-stat-item-active {
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.5) inset;
}

.agenda-todo-main {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.agenda-todo-check {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: flex-start;
  gap: 0.48rem;
  color: #f3f6fb;
  font-size: 0.82rem;
  min-width: 0;
  width: 100%;
}

.agenda-todo-check input {
  margin-top: 0.12rem;
  align-self: start;
}

.agenda-todo-check span {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.agenda-todo-done {
  text-decoration: line-through;
  color: rgba(243, 246, 251, 0.46);
}

.agenda-todo-date {
  font-size: 0.72rem;
  color: rgba(243, 246, 251, 0.54);
  margin-left: 1.5rem;
}

.agenda-todo-delete {
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(86, 26, 26, 0.38);
  color: #ffb4b4;
  min-height: auto;
  border-radius: 9px;
  padding: 0.26rem 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
  margin-left: auto;
}

.agenda-todo-delete:hover {
  background: rgba(86, 26, 26, 0.56);
}

/* ── Module navigation ────────────────────────────── */
.modules-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.module-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.95rem 1.1rem;
  border-radius: 18px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.12);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s;
}

.module-card:hover {
  transform: translateX(3px);
  border-color: rgba(159, 209, 255, 0.28);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}

.module-card-wide {
  grid-column: 1 / -1;
}

.mod-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--b);
  color: var(--c);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mod-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
}

.mod-text strong {
  font-size: 0.92rem;
  font-weight: 600;
  color: #f3f6fb;
  display: block;
}

.mod-text em {
  font-size: 0.78rem;
  font-style: normal;
  color: rgba(243, 246, 251, 0.46);
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mod-chevron {
  color: rgba(159, 209, 255, 0.3);
  font-size: 1.5rem;
  font-weight: 200;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.18s, transform 0.18s;
}

.module-card:hover .mod-chevron {
  color: rgba(159, 209, 255, 0.7);
  transform: translateX(2px);
}

/* ── Form card ────────────────────────────────────── */
.form-card {
  padding: 1.5rem;
  border-radius: 24px;
  background: rgba(10, 20, 36, 0.7);
  border: 1px solid rgba(159, 209, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.form-card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid rgba(159, 209, 255, 0.08);
  text-align: left;
}

.form-header-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 14px;
  background: rgba(96, 165, 250, 0.12);
  color: #60a5fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-card-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #f3f6fb;
}

.form-card-desc {
  margin: 0.25rem 0 0;
  font-size: 0.83rem;
  color: rgba(243, 246, 251, 0.48);
}

/* ── Offline banner ───────────────────────────────── */
.offline-banner {
  margin-bottom: 1.25rem;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  text-align: left;
  background: rgba(8, 17, 29, 0.6);
  border: 1px solid rgba(159, 209, 255, 0.1);
}

.offline-banner strong {
  color: #f3f6fb;
  font-size: 0.9rem;
}

.offline-banner p {
  margin: 0.3rem 0 0;
  color: rgba(243, 246, 251, 0.62);
  font-size: 0.84rem;
}

.offline-banner-warning {
  border-color: rgba(245, 158, 11, 0.38);
  background: rgba(71, 39, 5, 0.38);
}

.sync-button {
  min-width: 130px;
  flex-shrink: 0;
}

/* ── Form ─────────────────────────────────────────── */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

label {
  margin-bottom: 0.35rem;
  font-size: 0.84rem;
  font-weight: 500;
  color: rgba(243, 246, 251, 0.75);
}

input {
  padding: 0.8rem 1rem;
  width: 100%;
  color: #1f2937;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.97);
  box-sizing: border-box;
  font-size: 0.95rem;
  font-family: inherit;
}

.input-error {
  border-color: #f87171;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.14);
}

.field-error {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: #ffb4b4;
}

/* ── Buttons ──────────────────────────────────────── */
button {
  font-family: inherit;
}

.btn {
  min-height: 48px;
  padding: 0.8rem 1.35rem;
  font-size: 0.95rem;
  cursor: pointer;
  border-radius: 14px;
  border: none;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.12s;
  white-space: nowrap;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-geo {
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.3);
  color: #93c5fd;
}

.btn-geo:hover:not(:disabled) {
  background: rgba(96, 165, 250, 0.2);
  border-color: rgba(96, 165, 250, 0.55);
}

.btn-save {
  background: linear-gradient(135deg, #45a7ff 0%, #0b57d0 100%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(11, 87, 208, 0.28);
}

.btn-save:hover:not(:disabled) {
  background: linear-gradient(135deg, #2d95f5 0%, #0a4cb8 100%);
  box-shadow: 0 6px 20px rgba(11, 87, 208, 0.4);
}

.btn-query {
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.28);
  color: #c4b5fd;
}

.btn-query:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.5);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(159, 209, 255, 0.18);
  color: #9fd1ff;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(159, 209, 255, 0.32);
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  justify-content: center;
  margin-top: 1.25rem;
}

/* ── Validation / Response cards ──────────────────── */
.validation-card {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  text-align: left;
  color: #ffe0b2;
  background: rgba(120, 53, 15, 0.3);
  border: 1px solid rgba(251, 191, 36, 0.25);
}

.validation-card ul,
.response-list {
  margin: 0.7rem 0 0;
  padding-left: 1.2rem;
}

.response-card {
  margin-top: 1rem;
  padding: 1.1rem 1.25rem;
  border-radius: 20px;
  text-align: left;
  border: 1px solid rgba(159, 209, 255, 0.14);
  background: rgba(10, 20, 36, 0.7);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.2);
}

.response-message {
  margin: 0.5rem 0 0;
  line-height: 1.5;
  font-size: 0.93rem;
}

.response-card-error {
  color: #ffb4b4;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(86, 26, 26, 0.45);
}

.response-card-success {
  color: #8df0b4;
  border-color: rgba(42, 181, 125, 0.25);
  background: rgba(22, 52, 36, 0.45);
}

.response-card-info {
  color: #a8d0ff;
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(20, 44, 82, 0.42);
}

.maps-link-row {
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
}

.maps-link {
  color: #8dc7ff;
  font-size: 0.9rem;
}

.maps-link-input {
  color: #1f2937;
}

.maps-copy-button {
  width: 100%;
}

.maps-feedback {
  margin: 0.75rem 0 0;
  color: #8df0b4;
  font-size: 0.88rem;
}

/* ── Chain / Cadenas section ──────────────────────── */
.cadena-toggle-row {
  margin-top: 1.25rem;
  display: flex;
  justify-content: center;
}

.cadena-toggle-btn {
  min-height: auto;
  padding: 0.45rem 1.1rem;
  font-size: 0.84rem;
  font-weight: 600;
  border-radius: 100px;
  border: 1px solid rgba(159, 209, 255, 0.2);
  background: rgba(69, 167, 255, 0.07);
  color: #9fd1ff;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.cadena-toggle-btn:hover {
  background: rgba(69, 167, 255, 0.14);
}

.cadena-section {
  margin-top: 1rem;
  padding: 1.1rem;
  border-radius: 16px;
  border: 1px dashed rgba(159, 209, 255, 0.18);
  background: rgba(69, 167, 255, 0.04);
  display: grid;
  gap: 0.9rem;
}

.cadena-desc {
  margin: 0;
  color: rgba(243, 246, 251, 0.6);
  font-size: 0.87rem;
}

.cadena-search-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cadena-input {
  flex: 1 1 160px;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.97);
  color: #1f2937;
  font-size: 0.93rem;
  box-sizing: border-box;
  font-family: inherit;
}

.cadena-search-btn {
  min-height: 44px;
  white-space: nowrap;
}

.cadena-result {
  display: grid;
  gap: 0.85rem;
}

.cadena-result-title {
  margin: 0;
  color: #f3f6fb;
  font-size: 0.93rem;
}

.sedes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.sede-chip {
  display: grid;
  gap: 0.2rem;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(159, 209, 255, 0.18);
  text-decoration: none;
  color: #f3f6fb;
  font-size: 0.86rem;
  transition: background 0.15s;
}

.sede-chip:hover {
  background: rgba(69, 167, 255, 0.14);
}

.sede-chip span {
  color: rgba(243, 246, 251, 0.55);
  font-size: 0.76rem;
}

.nueva-sede-form {
  display: grid;
  gap: 0.75rem;
  padding: 0.9rem;
  border-radius: 12px;
  border: 1px solid rgba(159, 209, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
}

.nueva-sede-label {
  margin: 0;
  color: rgba(243, 246, 251, 0.75);
  font-size: 0.88rem;
}

.nueva-sede-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 0.6rem;
}

.sede-feedback {
  margin: 0;
  font-size: 0.88rem;
  padding: 0.55rem 0.8rem;
  border-radius: 10px;
}

.sede-feedback-ok {
  color: #8df0b4;
  background: rgba(22, 52, 36, 0.45);
}

.sede-feedback-err {
  color: #ffb4b4;
  background: rgba(86, 26, 26, 0.35);
}

/* ── Responsive ───────────────────────────────────── */
@media (max-width: 600px) {
  .home-page {
    padding: 1.25rem 0.85rem 2rem;
  }

  .stat-bar {
    gap: 1.2rem;
    padding: 0.9rem 1.2rem;
  }

  .stat-hide-sm {
    display: none;
  }

  .modules-grid {
    grid-template-columns: 1fr;
  }

  .admin-agenda-row {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .warehouse-performance-header,
  .warehouse-performance-search-row,
  .warehouse-performance-list li,
  .warehouse-performance-list-header {
    flex-direction: column;
    align-items: stretch;
  }

  .warehouse-performance-search {
    min-width: 0;
  }

  .warehouse-performance-stats,
  .warehouse-performance-lists {
    grid-template-columns: 1fr;
  }

  .warehouse-performance-list li strong {
    text-align: left;
  }

  .maintenance-agenda,
  .agenda-todo-panel {
    height: auto;
  }

  .maintenance-agenda-header {
    flex-direction: column;
  }

  .agenda-actions {
    width: 100%;
  }

  .agenda-actions .btn {
    flex: 1;
  }

  .agenda-stat-grid {
    grid-template-columns: 1fr;
  }

  .agenda-calendar-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .agenda-task-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .module-card-wide {
    grid-column: auto;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .offline-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .button-group {
    flex-direction: column;
    gap: 0.7rem;
  }

  .btn {
    width: 100%;
  }

  .sync-button {
    min-width: 0;
  }

  .nueva-sede-grid {
    grid-template-columns: 1fr;
  }

  .cadena-search-row {
    flex-direction: column;
  }
}
</style>