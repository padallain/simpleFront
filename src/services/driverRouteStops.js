const text = value => String(value ?? '').trim();
const coordinate = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '' : Number(value);

export function driverStopKey(stop) {
  const id = text(stop?.clientId ?? stop?.id);
  const branch = text(stop?.sucursal);
  return branch ? JSON.stringify([id, branch]) : JSON.stringify([id, '', text(stop?.nombre),
    coordinate(stop?.location?.latitude), coordinate(stop?.location?.longitude)]);
}

export function normalizeDriverStops(stops, orders = []) {
  const unique = new Map();
  for (const value of Array.isArray(stops) ? stops : []) {
    const stop = { ...value };
    if (!text(stop.sucursal)) {
      const name = text(stop.nombre).toLocaleLowerCase('es');
      const branches = [...new Set(orders.filter(order => text(order.clientId) === text(stop.clientId)).map(order => text(order.sucursal)).filter(Boolean))];
      const matched = branches.filter(branch => name.endsWith(`(${branch.toLocaleLowerCase('es')})`)
        || name.endsWith(`\u2014 ${branch.toLocaleLowerCase('es')}`));
      if (matched.length === 1) stop.sucursal = matched[0];
    }
    const key = driverStopKey(stop);
    if (!unique.has(key)) unique.set(key, { ...stop, stopKey: key });
    else {
      const previous = unique.get(key);
      const bothDispatched = Boolean(previous.dispatched) && Boolean(stop.dispatched);
      previous.dispatched = bothDispatched;
      previous.dispatchedAt = bothDispatched ? previous.dispatchedAt || stop.dispatchedAt || null : null;
    }
  }
  return [...unique.values()].map((stop, index) => ({ ...stop, order: index + 1 }));
}

export function normalizedDriverRoute(route) {
  return route ? { ...route, stops: normalizeDriverStops(route.stops, route.loadGuide?.orders),
    originalStops: normalizeDriverStops(route.originalStops, route.loadGuide?.orders) } : route;
}