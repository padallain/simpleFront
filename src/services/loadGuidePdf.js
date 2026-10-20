import { jsPDF } from 'jspdf';

export function summarizeLoadGuide(guide) {
  const orders = guide.orders || [];
  const totalAmount = orders.reduce((sum, order) => sum + Math.round(((Number(order.total) || 0) + Number.EPSILON) * 100), 0) / 100;
  return { orders, totalAmount };
}

const format = (value, decimals = 3) => Number(value || 0).toLocaleString('es-VE', { maximumFractionDigits: decimals, minimumFractionDigits: decimals === 2 ? 2 : 0 });
const dateLabel = (value) => String(value || '').split('-').reverse().join('/');

export function createLoadGuidePdf(guide, route = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const guideLists = guide.subGuides?.length ? guide.subGuides : [guide];
  const { totalAmount } = summarizeLoadGuide(guide);
  const margin = 12;
  const width = 186;
  const bottom = 278;
  let cursor = margin;
  const newPage = () => { doc.addPage(); cursor = margin; };
  const ensure = (height) => { if (cursor + height > bottom) newPage(); };
  const text = (value, { bold = false, size = 9, gap = 3, color = [20, 20, 20] } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lineHeight = size * 0.45;
    const lines = doc.splitTextToSize(String(value || ''), width);
    for (const line of lines) {
      ensure(lineHeight);
      doc.text(line, margin, cursor + lineHeight);
      cursor += lineHeight;
    }
    cursor += gap;
  };
  const table = (headers, widths, rows, totalRow) => {
    const drawRow = (cells, header = false, total = false) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', header || total ? 'bold' : 'normal');
      const lines = cells.map((cell, index) => doc.splitTextToSize(String(cell ?? ''), widths[index] - 4));
      const maxLines = Math.max(...lines.map((cell) => cell.length));
      let offset = 0;
      while (offset < maxLines) {
        const minimumHeight = Math.min(maxLines - offset, 3) * 3.6 + 4;
        if (cursor + minimumHeight > bottom) {
          newPage();
          if (!header) drawRow(headers, true);
        }
        const count = Math.min(maxLines - offset, Math.floor((bottom - cursor - 4) / 3.6));
        const height = count * 3.6 + 4;
        let left = margin;
        doc.setFontSize(8);
        doc.setFont('helvetica', header || total ? 'bold' : 'normal');
        doc.setTextColor(...(header ? [255, 255, 255] : [20, 20, 20]));
        cells.forEach((cell, index) => {
          doc.setDrawColor(165, 175, 185);
          doc.setFillColor(...(header ? [32, 57, 94] : total ? [222, 229, 238] : [255, 255, 255]));
          doc.rect(left, cursor, widths[index], height, 'FD');
          doc.text(lines[index].slice(offset, offset + count), left + 2, cursor + 4.5);
          left += widths[index];
        });
        cursor += height;
        offset += count;
      }
    };
    ensure(20);
    drawRow(headers, true);
    rows.forEach((row) => drawRow(row));
    if (totalRow) drawRow(totalRow, false, true);
    cursor += 4;
  };
  text('GUIA DE CARGA', { bold: true, size: 16, gap: 6 });
  text(`Ruta: ${route.routeLabel || guide.number || route.routeId || ''}`, { bold: true });
  text(`Fecha: ${dateLabel(guide.date)}    Pedidos: ${orders.length}`);
  text(`Chofer: ${route.driverName || route.driverId || ''}`);
  text(`Peso total: ${format(route.totalWeight)} kg`);
  for (const companyGuide of guideLists) {
    const { orders, totalAmount: companyTotal } = summarizeLoadGuide(companyGuide);
    const companyName = companyGuide.companyName || orders[0]?.companyName || orders[0]?.company || 'Sin empresa registrada';
    text(`${companyName} | GUIA ${companyGuide.number || guide.number || ''}`, { bold: true, size: 11, gap: 2 });
    table(['#', 'COD. CLIENTE', 'CLIENTE', 'EMPRESA', 'DOCUMENTO', 'FECHA PEDIDO', 'MONTO $'],
      [8, 22, 43, 30, 31, 25, 27],
      orders.map((order, index) => [index + 1, order.clientId, order.clientName || order.clientId, order.companyName || order.company || companyName, order.orderNumber, dateLabel(order.date) || '-', format(order.total, 2)]),
      ['', '', 'TOTAL DE LA GUIA', '', '', '', format(companyTotal, 2)]);
  }
  if (route.routeComment) text(`Observaciones: ${route.routeComment}`);
  ensure(26);
  cursor += 8;
  table(['Despachado por', `Chofer: ${route.driverName || route.driverId || ''}`, 'Recibido / Revisado'], [62, 62, 62], [['________________', '________________', '________________']]);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(`${dateLabel(guide.date)} | Total pedidos $ ${format(totalAmount, 2)}`, margin, 288);
    doc.text(`Pagina ${page} / ${pages}`, 198, 288, { align: 'right' });
  }
  return doc;
}

export function downloadLoadGuide(guide, route) {
  const guideNumber = guide.subGuides?.map(item => item.number).filter(Boolean).join('-') || guide.number || route.routeId || 'ruta';
  const filename = `guia-carga-${guideNumber}-${guide.date}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  createLoadGuidePdf(guide, route).save(`${filename}.pdf`);
}