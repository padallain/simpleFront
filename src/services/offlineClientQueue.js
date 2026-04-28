const OFFLINE_CLIENT_QUEUE_KEY = "makeroute.pendingClients";

function readQueue() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(OFFLINE_CLIENT_QUEUE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (_error) {
    return [];
  }
}

function writeQueue(queue) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OFFLINE_CLIENT_QUEUE_KEY, JSON.stringify(queue));
}

function buildQueueId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getPendingClientQueue() {
  return readQueue();
}

export function getPendingClientCount() {
  return readQueue().length;
}

export function queueClientForSync(payload) {
  const queue = readQueue();
  const queueItem = {
    queueId: buildQueueId(),
    payload,
    queuedAt: new Date().toISOString(),
  };

  queue.push(queueItem);
  writeQueue(queue);

  return queueItem;
}

export function removeQueuedClients(queueIds) {
  if (!Array.isArray(queueIds) || queueIds.length === 0) {
    return getPendingClientQueue();
  }

  const idSet = new Set(queueIds);
  const nextQueue = readQueue().filter((item) => !idSet.has(item.queueId));
  writeQueue(nextQueue);
  return nextQueue;
}