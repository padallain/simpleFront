import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as vue from 'vue';
import { parse } from '@vue/compiler-sfc';
import { parseRouteMessage, parseGuideMessage } from './routeMessage.js';

test('Lee el formato de ruta con metadatos y sedes sin perder ceros del ID', () => {
  const route = parseRouteMessage(`CREAR RUTA
Chofer ID: CH-12
Nombre del chofer: Juan Perez
Peso total (kg): 1200,50
Comentario: Entrega: manana
CLIENTES
ID: 00123
ID: J987654321 | Sede: Norte
Primera parada obligatoria: J987654321 | Sede: Norte`);
  assert.equal(route.driverId, 'CH-12');
  assert.equal(route.driverName, 'Juan Perez');
  assert.equal(route.routeWeight, 1200.5);
  assert.equal(route.routeComment, 'Entrega: manana');
  assert.deepEqual(route.stops, [{ clientId: '00123', sucursal: '' }, { clientId: 'J987654321', sucursal: 'Norte' }]);
  assert.deepEqual(route.priority, route.stops[1]);
});

test('Admite campos vacios, acentos y saltos de linea Windows', () => {
  const route = parseRouteMessage('CREAR RUTA\r\nChofer ID:\r\nNombre del chófer:\r\nPeso total (kg):\r\nComentario:\r\nCLIENTES\r\nID: CLIENTE\r\nPrimera parada obligatoria: ninguna');
  assert.equal(route.driverId, '');
  assert.equal(route.routeWeight, 0);
  assert.equal(route.priority, null);
});

test('Consolida repetidos sin mezclar sedes diferentes', () => {
  const route = parseRouteMessage('ID: A | Sede: Norte\nID: A | Sede: norte\nID: A | Sede: Sur');
  assert.equal(route.stops.length, 2);
});

test('Rechaza texto desconocido, mensajes de guias e IDs vacios', () => {
  for (const text of ['CREAR GUIAS Y RUTA\nID: A', 'ID: A\nEmpresa: A', 'ID:', 'ID: A | Sede:']) {
    assert.throws(() => parseRouteMessage(text), /Linea/);
  }
});

test('Rechaza pesos invalidos y campos repetidos', () => {
  for (const weight of ['-1', '1.200,50', 'Infinity']) {
    assert.throws(() => parseRouteMessage(`Peso total (kg): ${weight}\nID: A`), /peso/);
  }
  assert.throws(() => parseRouteMessage('Chofer ID: A\nChofer ID: B\nID: A'), /repetido/);
});

test('Valida la primera parada y exige sede cuando hay ambiguedad', () => {
  assert.throws(() => parseRouteMessage('ID: A\nPrimera parada obligatoria: B'), /primera parada/);
  assert.throws(() => parseRouteMessage('ID: A | Sede: Norte\nID: A | Sede: Sur\nPrimera parada obligatoria: A'), /sede/);
});

test('Rechaza listas vacias o demasiado largas', () => {
  assert.throws(() => parseRouteMessage('CREAR RUTA'), /al menos/);
  assert.throws(() => parseRouteMessage(Array.from({ length: 201 }, (_, index) => `ID: ${index}`).join('\n')), /200/);
});

test('Formulario: importa, calcula sin guia y conserva la lista ante errores o cancelacion', async () => {
  const component = readFileSync(new URL('../views/Routes.vue', import.meta.url), 'utf8');
  const source = parse(component).descriptor.scriptSetup.content
    .replace(/^import .*;\r?$/gm, '').replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
  const requests = [];
  let confirmReplacement = true;
  const client = { nombre: 'Cliente', location: { latitude: 10.65, longitude: -71.63 } };
  const fetchMock = async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/getClient/')) {
      return { ok: !url.endsWith('/MISSING') && !url.endsWith('/SERVER_ERROR'), status: url.endsWith('/MISSING') ? 404 : url.endsWith('/SERVER_ERROR') ? 500 : 200, json: async () => url.endsWith('/CHAIN')
        ? { esCadena: true, sedes: [{ ...client, sucursal: 'Norte' }, { ...client, sucursal: 'Sur' }] } : client };
    }
    return { ok: true, json: async () => ({ route: [], routeOptions: [], routeType: 'closest' }) };
  };
  const createForm = new Function('vue', 'parseRouteMessage', 'parseGuideMessage', 'fetch', 'window', `
    const {computed,nextTick,reactive,ref,watch} = vue;
    const onMounted = () => {}; const onBeforeUnmount = () => {};
    const useRoute = () => ({query:{}}); const useRouter = () => ({replace:async()=>{}});
    ${source}
    return {createRouteFromMessage,routeMessageInput,paradas,errorMessage,feedback,driverId,routeWeight,routeComment,loading,creationMode,routeMessageImported,submitRoute,companyCatalog,companyIdInput,guideNumbersByCompany,makeRoute,assignPendingGuideCompany,addStopStatus,addStopStatusType,sedePickerVisible,sedeOpciones,agregarSede,cancelSedeSelection};
  `);
  const scope = vue.effectScope();
  try {
    const form = scope.run(() => createForm(vue, parseRouteMessage, parseGuideMessage, fetchMock, { confirm: () => confirmReplacement }));
    form.routeMessageInput.value = `CREAR RUTA
Chofer ID: CH-12
Nombre del chofer: Juan
Peso total (kg): 100
Comentario: Prueba
CLIENTES
ID: 00123
ID: CHAIN | Sede: norte
Primera parada obligatoria: CHAIN | Sede: norte`;
    await form.createRouteFromMessage();
    assert.equal(form.errorMessage.value, '');
    assert.equal(form.paradas.value.length, 2);
    assert.equal(form.paradas.value[1].sucursal, 'Norte');
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute/preview')).length, 0);
    assert.match(form.feedback.value, /Pulsa Calcular ruta optima/);
    assert.equal(form.routeMessageImported.value, true);
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length, 0);
    assert.equal(requests.some(request => request.url.endsWith('/makeRoute/preview')), false);
    await form.submitRoute();
    const routeRequest = requests.at(-1);
    assert.ok(routeRequest.url.endsWith('/makeRoute/preview'));
    const payload = JSON.parse(routeRequest.options.body);
    assert.equal(Object.hasOwn(payload, 'loadGuide'), false);
    assert.equal(payload.driverId, 'CH-12');
    assert.equal(payload.driverName, 'Juan');
    assert.equal(payload.routeWeight, 100);
    assert.equal(payload.routeComment, 'Prueba');
    assert.equal(payload.routeType, 'closest');
    assert.equal(payload.preserveRouteOrder, false);
    assert.equal(payload.anchorStopKey, 'CHAIN|Norte');
    assert.deepEqual(payload.stops, [{ clientId: '00123' }, { clientId: 'CHAIN', sucursal: 'Norte' }]);
    const previewCount = requests.filter(request => request.url.endsWith('/makeRoute/preview')).length;
    await form.submitRoute();
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute/preview')).length, previewCount + 1);
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length, 0);
    const originalStops = form.paradas.value;
    for (const message of ['ID: SERVER_ERROR', 'TEXTO INVALIDO']) {
      form.routeMessageInput.value = message;
      await form.createRouteFromMessage();
      assert.notEqual(form.errorMessage.value, '');
      assert.equal(form.paradas.value, originalStops);
      assert.equal(form.driverId.value, 'CH-12');
      assert.equal(form.loading.value, false);
      assert.equal(requests.filter(request => request.url.endsWith('/makeRoute/preview')).length, previewCount + 1);
      assert.equal(requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length, 0);
    }
    confirmReplacement = false;
    const requestsBeforeCancel = requests.length;
    form.routeMessageInput.value = 'ID: OTHER';
    await form.createRouteFromMessage();
    assert.equal(requests.length, requestsBeforeCancel);
    assert.equal(form.paradas.value, originalStops);
    confirmReplacement = true;
    await form.createRouteFromMessage();
    assert.equal(form.driverId.value, '');
    assert.equal(form.routeWeight.value, 0);
    assert.equal(form.routeComment.value, '');
    assert.equal(form.paradas.value.length, 1);
    assert.equal(form.paradas.value[0].parada, 'OTHER');
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute/preview')).length, previewCount + 1);
    await form.submitRoute();
    assert.equal(JSON.parse(requests.at(-1).options.body).driverId, '');
    form.creationMode.value = 'guide';
    form.companyCatalog.value = [{ _id: 'A', name: 'Empresa A' }, { _id: 'B', name: 'Empresa B' }];
    form.companyIdInput.value = '';
    await vue.nextTick();
    form.routeMessageInput.value = 'CREAR RUTA\nChofer ID: CH-12\nID: 00123';
    const calculationsBeforeGuide = requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length;
    await form.createRouteFromMessage();
    assert.equal(form.errorMessage.value, '');
    assert.equal(form.paradas.value[0].companyId, '');
    assert.equal(form.paradas.value[0].orderTotal, null);
    assert.equal(form.paradas.value[0].orderDate, '');
    assert.equal(form.paradas.value[0].orderNumber, '');
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length, calculationsBeforeGuide);
    form.assignPendingGuideCompany('A');
    form.guideNumbersByCompany.A = '159';
    await form.makeRoute();
    assert.match(form.errorMessage.value, /documento/);
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length, calculationsBeforeGuide);
    form.routeMessageInput.value = `CREAR GUIAS Y RUTA
Chofer ID: CH-12
EMPRESA: Empresa A
GUIA: 1
Cliente ID: 00123
Pedido: PED-1
Fecha: 2026-10-15
Monto ($): 150.50
EMPRESA: Empresa B
GUIA: 1
Cliente ID: 00123
Pedido: PED-2
Fecha: 2026-10-15
Monto ($): 90.00`;
    await form.createRouteFromMessage();
    assert.equal(form.errorMessage.value, '');
    assert.deepEqual(form.paradas.value.map(stop => stop.companyId), ['A', 'B']);
    assert.equal(form.paradas.value[0].orderTotal, 150.5);
    assert.equal(form.paradas.value[1].orderTotal, 90);
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length, calculationsBeforeGuide);
    await form.makeRoute();
    assert.equal(form.errorMessage.value, '');
    const guidePayload = JSON.parse(requests.at(-1).options.body);
    assert.deepEqual(guidePayload.loadGuide.subGuides.map(guide => [guide.companyId, guide.number]), [['A', '1'], ['B', '1']]);
    assert.equal(guidePayload.stops.length, 1);
    const currentGuideOrders = form.paradas.value;
    form.routeMessageInput.value = 'CREAR GUIAS Y RUTA\nEMPRESA: No registrada\nGUIA: 2\nCliente ID: 00123';
    await form.createRouteFromMessage();
    assert.match(form.errorMessage.value, /no esta registrada/);
    assert.equal(form.paradas.value, currentGuideOrders);
    form.creationMode.value = 'route';
    await form.createRouteFromMessage();
    assert.match(form.errorMessage.value, /Selecciona Crear guia/);
    const missingLookupsBefore = requests.filter(request => request.url.endsWith('/getClient/MISSING')).length;
    const previewsBeforeMissingCalculation = requests.filter(request => request.url.endsWith('/makeRoute/preview')).length;
    form.routeMessageInput.value = 'CREAR RUTA\nID: MISSING\nID: OTHER\nID: MISSING | Sede: Norte\nPrimera parada obligatoria: MISSING | Sede: Norte';
    await form.createRouteFromMessage();
    assert.equal(form.errorMessage.value, '');
    assert.deepEqual(form.paradas.value.map(stop => [stop.parada, stop.name, stop.sucursal]),
      [['MISSING', 'No encontrado', ''], ['OTHER', 'Cliente', ''], ['MISSING', 'No encontrado', 'Norte']]);
    assert.equal(form.paradas.value[0].location, null);
    assert.equal(form.paradas.value[2].location, null);
    assert.equal(form.addStopStatusType.value, 'warning');
    assert.match(form.addStopStatus.value, /Clientes no encontrados: MISSING, MISSING \(Norte\)/);
    assert.match(form.addStopStatus.value, /primera parada/);
    assert.equal(requests.filter(request => request.url.endsWith('/getClient/MISSING')).length, missingLookupsBefore + 1);
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute/preview')).length, previewsBeforeMissingCalculation);
    await form.submitRoute();
    const missingPayload = JSON.parse(requests.at(-1).options.body);
    assert.equal(missingPayload.stops.length, 3);
    assert.equal(Object.hasOwn(missingPayload, 'anchorClientId'), false);
    form.creationMode.value = 'guide';
    form.routeMessageInput.value = 'CREAR GUIAS Y RUTA\nEMPRESA: Empresa A\nGUIA: 3\nCliente ID: MISSING\nPedido: PED-3\nFecha: 2026-10-15\nMonto ($): 10';
    const requestsBeforeMissingGuide = requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length;
    await form.createRouteFromMessage();
    assert.equal(form.errorMessage.value, '');
    assert.equal(form.paradas.value[0].name, 'No encontrado');
    assert.equal(form.paradas.value[0].orderNumber, 'PED-3');
    assert.equal(form.paradas.value[0].orderTotal, 10);
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute') && !request.url.endsWith('/makeRoute/preview')).length, requestsBeforeMissingGuide);
    const waitForBranchPicker = async () => {
      for (let attempt = 0; attempt < 20 && !form.sedePickerVisible.value; attempt += 1) await vue.nextTick();
      assert.equal(form.sedePickerVisible.value, true);
    };
    form.creationMode.value = 'route';
    form.routeMessageInput.value = 'CREAR RUTA\nID: CHAIN\nID: OTHER\nPrimera parada obligatoria: CHAIN';
    const branchRequestsBefore = requests.filter(request => request.url.endsWith('/makeRoute/preview')).length;
    const importWithBranch = form.createRouteFromMessage();
    await waitForBranchPicker();
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute/preview')).length, branchRequestsBefore);
    assert.equal(form.sedeOpciones.value.length, 2);
    await form.agregarSede(form.sedeOpciones.value[1]);
    await importWithBranch;
    assert.equal(form.errorMessage.value, '');
    assert.equal(form.sedePickerVisible.value, false);
    assert.deepEqual(form.paradas.value.map(stop => [stop.parada, stop.sucursal]), [['CHAIN', 'Sur'], ['OTHER', '']]);
    await form.submitRoute();
    assert.equal(JSON.parse(requests.at(-1).options.body).anchorStopKey, 'CHAIN|Sur');
    form.routeMessageInput.value = 'ID: CHAIN | Sede: Inexistente\nID: OTHER\nPrimera parada obligatoria: CHAIN | Sede: Inexistente';
    const correctedBranchImport = form.createRouteFromMessage();
    await waitForBranchPicker();
    await form.agregarSede(form.sedeOpciones.value[0]);
    await correctedBranchImport;
    assert.equal(form.errorMessage.value, '');
    assert.equal(form.paradas.value[0].sucursal, 'Norte');
    await form.submitRoute();
    assert.equal(JSON.parse(requests.at(-1).options.body).anchorStopKey, 'CHAIN|Norte');
    form.routeMessageInput.value = 'ID: OTHER | Sede: Incorrecta';
    const singleLocationImport = form.createRouteFromMessage();
    await waitForBranchPicker();
    assert.equal(form.sedeOpciones.value.length, 1);
    await form.agregarSede(form.sedeOpciones.value[0]);
    await singleLocationImport;
    assert.equal(form.errorMessage.value, '');
    assert.equal(form.paradas.value[0].sucursal, '');
    await form.submitRoute();
    assert.deepEqual(JSON.parse(requests.at(-1).options.body).stops, [{ clientId: 'OTHER' }]);
    const beforeBranchCancel = form.paradas.value;
    const requestsBeforeBranchCancel = requests.filter(request => request.url.endsWith('/makeRoute/preview')).length;
    form.routeMessageInput.value = 'ID: CHAIN | Sede: Incorrecta';
    const cancelledBranchImport = form.createRouteFromMessage();
    await waitForBranchPicker();
    form.cancelSedeSelection();
    await cancelledBranchImport;
    assert.equal(form.paradas.value, beforeBranchCancel);
    assert.equal(form.loading.value, false);
    assert.match(form.errorMessage.value, /Importacion cancelada/);
    assert.equal(requests.filter(request => request.url.endsWith('/makeRoute/preview')).length, requestsBeforeBranchCancel);
    form.creationMode.value = 'guide';
    form.routeMessageInput.value = 'CREAR GUIAS Y RUTA\nEMPRESA: Empresa A\nGUIA: 4\nCliente ID: CHAIN\nSede: Inexistente\nPedido: PED-4\nFecha: 2026-10-15\nMonto ($): 20';
    const guideBranchImport = form.createRouteFromMessage();
    await waitForBranchPicker();
    await form.agregarSede(form.sedeOpciones.value[0]);
    await guideBranchImport;
    assert.equal(form.errorMessage.value, '');
    assert.equal(form.paradas.value[0].sucursal, 'Norte');
    assert.equal(form.paradas.value[0].orderNumber, 'PED-4');
    assert.equal(form.paradas.value[0].orderTotal, 20);
    assert.equal(form.paradas.value[0].companyId, 'A');
  } finally { scope.stop(); }
});

test('Lee guias de varias empresas con numeros iguales y datos de pedido', () => {
  const result = parseGuideMessage(`CREAR GUIAS Y RUTA
Chofer ID: CH-12
EMPRESA: Empresa A
GUIA: 1
Cliente ID: 00123
Sede:
Pedido: PED-1
Fecha: 2026-10-15
Monto ($): 150.50
EMPRESA: Empresa B
GUIA: 1
Cliente ID: 00123
Sede: Norte
Pedido: PED-2
Fecha: 2026-10-15
Monto ($): 90,00`);
  assert.equal(result.driverId, 'CH-12');
  assert.equal(result.guides.length, 2);
  assert.deepEqual(result.guides.map(guide => guide.number), ['1', '1']);
  assert.equal(result.guides[0].orders[0].total, 150.5);
  assert.equal(result.guides[1].orders[0].sucursal, 'Norte');
  assert.equal(result.stops.length, 2);
});

test('No inventa datos faltantes y rechaza fechas, montos y empresas duplicadas', () => {
  const pending = parseGuideMessage('EMPRESA: Empresa A\nCliente ID: A');
  assert.equal(pending.guides[0].number, '');
  assert.equal(pending.guides[0].orders[0].total, null);
  for (const field of ['Fecha: 2026-02-30', 'Monto ($): -1', 'Monto ($): 1.234,56']) {
    assert.throws(() => parseGuideMessage(`EMPRESA: A\nCliente ID: A\n${field}`), /Linea/);
  }
  assert.throws(() => parseGuideMessage('EMPRESA: A\nCliente ID: A\nEMPRESA: a\nCliente ID: B'), /repetida/);
});