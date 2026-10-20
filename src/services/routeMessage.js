const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

function parseStop(value, lineNumber) {
  const match = value.match(/^([^|]+?)(?:\s*\|\s*Sede\s*:\s*(.+))?$/i);
  if (!match || !match[1].trim()) throw new Error(`Linea ${lineNumber}: indica un ID de cliente y, si aplica, | Sede: nombre.`);
  return { clientId: match[1].trim(), sucursal: match[2]?.trim() || '' };
}

export function parseRouteMessage(message) {
  const result = { driverId: '', driverName: '', routeWeight: 0, routeComment: '', stops: [], priority: null };
  const seenStops = new Set();
  const seenFields = new Set();
  const fields = new Map([
    ['chofer id', 'driverId'], ['nombre del chofer', 'driverName'],
    ['peso total (kg)', 'routeWeight'], ['comentario', 'routeComment'],
    ['primera parada obligatoria', 'priority'],
  ]);
  for (const [index, rawLine] of String(message || '').split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || ['crear ruta', 'clientes'].includes(normalized(line))) continue;
    const separator = line.indexOf(':');
    const label = separator < 0 ? '' : normalized(line.slice(0, separator));
    const value = separator < 0 ? '' : line.slice(separator + 1).trim();
    if (label === 'id') {
      const stop = parseStop(value, index + 1);
      const key = JSON.stringify([stop.clientId, normalized(stop.sucursal)]);
      if (!seenStops.has(key)) { result.stops.push(stop); seenStops.add(key); }
      continue;
    }
    const field = fields.get(label);
    if (!field) throw new Error(`Linea ${index + 1}: campo no reconocido. Usa el formato CREAR RUTA con clientes ID: ...`);
    if (seenFields.has(field)) throw new Error(`Linea ${index + 1}: el campo ${line.slice(0, separator)} esta repetido.`);
    seenFields.add(field);
    if (field === 'routeWeight') {
      if (value && !/^\d+(?:[.,]\d+)?$/.test(value)) throw new Error('El peso total debe ser un numero no negativo, sin separadores de miles.');
      result.routeWeight = value ? Number(value.replace(',', '.')) : 0;
      if (!Number.isFinite(result.routeWeight)) throw new Error('El peso total no es valido.');
    } else if (field === 'priority') {
      result.priority = !value || normalized(value) === 'ninguna' ? null : parseStop(value.replace(/^ID\s*:\s*/i, ''), index + 1);
    } else result[field] = value;
  }
  if (!result.stops.length) throw new Error('Incluye al menos un cliente con el formato ID: J123456789.');
  if (result.stops.length > 200) throw new Error('Puedes importar hasta 200 paradas por mensaje.');
  if (result.priority) {
    const matches = result.stops.filter(stop => stop.clientId === result.priority.clientId
      && (!result.priority.sucursal || normalized(stop.sucursal) === normalized(result.priority.sucursal)));
    if (matches.length !== 1) throw new Error('La primera parada debe corresponder a un cliente de la lista. Indica su sede si hay varias.');
    result.priority = matches[0];
  }
  return result;
}

export function parseGuideMessage(message) {
  const routeLines = ['CREAR RUTA'];
  const guides = [];
  let currentGuide = null;
  let currentOrder = null;
  const routeFields = new Set(['chofer id', 'nombre del chofer', 'peso total (kg)', 'comentario', 'primera parada obligatoria']);
  for (const [index, rawLine] of String(message || '').split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || ['crear guia', 'crear guias', 'crear guias y ruta', 'clientes'].includes(normalized(line))) continue;
    const separator = line.indexOf(':');
    const label = separator < 0 ? '' : normalized(line.slice(0, separator));
    const value = separator < 0 ? '' : line.slice(separator + 1).trim();
    if (routeFields.has(label)) { routeLines.push(line); continue; }
    if (label === 'empresa') {
      if (!value) throw new Error(`Linea ${index + 1}: escribe el nombre de la empresa.`);
      if (guides.some(guide => normalized(guide.companyName) === normalized(value))) throw new Error(`La empresa ${value} esta repetida en el mensaje.`);
      currentGuide = { companyName: value, number: '', orders: [] };
      currentOrder = null;
      guides.push(currentGuide);
      continue;
    }
    if (!currentGuide) throw new Error(`Linea ${index + 1}: indica EMPRESA antes de la guia y sus pedidos.`);
    if (label === 'guia') {
      if (currentGuide.number || !value) throw new Error(`Linea ${index + 1}: indica un unico numero de guia por empresa.`);
      currentGuide.number = value;
      continue;
    }
    if (label === 'cliente id' || label === 'id') {
      currentOrder = { ...parseStop(value, index + 1), orderNumber: '', date: '', total: null };
      currentGuide.orders.push(currentOrder);
      continue;
    }
    if (!currentOrder) throw new Error(`Linea ${index + 1}: indica Cliente ID antes de los datos del pedido.`);
    const orderField = new Map([['sede', 'sucursal'], ['pedido', 'orderNumber'], ['fecha', 'date'], ['monto ($)', 'total']]).get(label);
    if (!orderField) throw new Error(`Linea ${index + 1}: campo de pedido no reconocido.`);
    if (currentOrder[orderField] !== '' && currentOrder[orderField] !== null) throw new Error(`Linea ${index + 1}: el campo ${line.slice(0, separator)} esta repetido.`);
    if (orderField === 'total') {
      if (value && !/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error(`Linea ${index + 1}: el monto debe ser no negativo, sin separadores de miles y con hasta dos decimales.`);
      currentOrder.total = value ? Number(value.replace(',', '.')) : null;
      if (value && !Number.isSafeInteger(Math.round(currentOrder.total * 100))) throw new Error(`Linea ${index + 1}: el monto no es valido.`);
    } else if (orderField === 'date') {
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
        || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error(`Linea ${index + 1}: la fecha debe ser valida y usar AAAA-MM-DD.`);
      currentOrder.date = value;
    } else currentOrder[orderField] = value;
  }
  if (!guides.length) throw new Error('Incluye al menos una EMPRESA con sus pedidos.');
  for (const guide of guides) {
    if (!guide.orders.length) throw new Error(`La empresa ${guide.companyName} no tiene pedidos.`);
    for (const order of guide.orders) routeLines.push(`ID: ${order.clientId}${order.sucursal ? ` | Sede: ${order.sucursal}` : ''}`);
  }
  if (guides.reduce((count, guide) => count + guide.orders.length, 0) > 200) throw new Error('Puedes importar hasta 200 pedidos por mensaje.');
  return { ...parseRouteMessage(routeLines.join('\n')), guides };
}