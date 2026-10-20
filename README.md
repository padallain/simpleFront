# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## Crear una ruta desde un mensaje

En **Crear ruta**, abre **Crear ruta desde mensaje**, pega el texto en **Mensaje de ruta**
y pulsa **Crear ruta desde mensaje** para cargar los clientes. Luego pulsa **Calcular ruta
optima** cuando quieras generar el recorrido. Ejemplo:

```text
CREAR RUTA
Chofer ID:
Nombre del chofer:
Peso total (kg): 1200
Comentario: Entregas de la manana
CLIENTES
ID: J123456789
ID: J987654321 | Sede: Norte
Primera parada obligatoria: ninguna
```

Usa IDs y sedes registrados. Pegar el mensaje no calcula ni guarda la ruta. Al pulsar
**Calcular ruta optima**, el recorrido se muestra como previsualizacion y no se guarda
una asignacion, aunque el mensaje incluya un chofer. No se crea una guia de carga.
Para fijar la primera parada, sustituye `ninguna` por su ID y, si aplica, `| Sede: Norte`.
El importador valida todos los clientes antes de reemplazar la lista y pide confirmacion
si ya hay una ruta en pantalla.

## Crear guias desde un mensaje

Selecciona **Crear guia** y pega el mensaje en **Mensaje de ruta o guias**. Pulsa
**Cargar guias desde mensaje** para revisar los pedidos antes de pulsar **Crear guia**.
Puedes usar el mensaje `CREAR RUTA` anterior: carga los clientes y conserva chofer,
peso y comentario, pero deja pendientes numero de documento, fecha y monto de cada pedido.
Selecciona la empresa y completa su numero de guia. No se deducen numeros de guia,
placas o cantidades de bultos a partir del comentario libre.

Tambien se admite el formato completo, repitiendo el bloque de empresa para cada guia
y el bloque de cliente para cada pedido:

```text
CREAR GUIAS Y RUTA
Chofer ID: CH-12
Nombre del chofer: Juan Perez
Peso total (kg): 1200
Comentario: Entregas de la manana
Primera parada obligatoria: ninguna

EMPRESA: Nombre de empresa registrado
GUIA: 159
Cliente ID: J123456789
Sede:
Pedido: PED-100
Fecha: 2026-10-15
Monto ($): 150.50
```

Cada lista conserva su empresa y numero; el mismo numero puede usarse para empresas
distintas. Los pedidos incompletos se cargan para completar sus datos, pero no se guardan
hasta pasar la validacion habitual del formulario. El modo **Crear ruta** no acepta un
mensaje de guias para evitar descartar datos de pedidos por error.

Pruebas del importador: `node --test src/services/routeMessage.test.js`.
