'use client';

import React, { useState } from 'react';
import { FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface QuotePdfRow {
  folio: string;
  customerShortName: string;
  customerName: string;
  originLabel: string;
  projectName: string;
  responsibleName: string;
  statusLabel: string;
  commercialStatusLabel: string;
  revisionsSummary: string;
  offeredAmountFormatted: string;
  awardedAmountFormatted: string;
  offeredAmountNum: number;
  awardedAmountNum: number;
}

interface ExportQuotesPdfButtonProps {
  rows: QuotePdfRow[];
  generatedBy: string;
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/images/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatMoneyMxn(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(value);
}

export function ExportQuotesPdfButton({ rows, generatedBy }: ExportQuotesPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'letter',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 279.4 mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 215.9 mm
      const marginX = 14;
      const contentWidth = pageWidth - marginX * 2;

      const today = new Date();
      const dateIso = today.toISOString().slice(0, 10);
      const dateDisplay = `${String(today.getDate()).padStart(2, '0')} / ${String(
        today.getMonth() + 1
      ).padStart(2, '0')} / ${today.getFullYear()}`;

      const logoDataUrl = await loadLogoDataUrl();

      // Cálculos ejecutivos sin duplicar revisiones históricas
      const totalOffered = rows.reduce((acc, r) => acc + (r.offeredAmountNum || 0), 0);
      const totalAwarded = rows.reduce((acc, r) => acc + (r.awardedAmountNum || 0), 0);
      const closedCount = rows.filter((r) => r.statusLabel.toLowerCase().includes('cerrad')).length;
      const activeCount = rows.length - closedCount;

      // 1. Barra superior corporativa (#0F2747 + acento #C72106)
      doc.setFillColor(15, 39, 71);
      doc.rect(0, 0, pageWidth, 4.5, 'F');
      doc.setFillColor(199, 33, 6);
      doc.rect(0, 4.5, pageWidth, 1.2, 'F');

      // 2. Logotipo original o respaldo tipográfico
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', marginX, 9, 44, 15);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 39, 71);
        doc.text('IN SIDE LOGISTIC S.A. DE C.V.', marginX, 18);
      }

      // 3. Título institucional derecho
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(199, 33, 6);
      doc.text('CONTROL DE OFERTAS Y REVISIONES  /  RESUMEN EJECUTIVO', pageWidth - marginX, 13, {
        align: 'right',
      });

      doc.setFontSize(15);
      doc.setTextColor(15, 39, 71);
      doc.text('REPORTE CONSOLIDADO DE COTIZACIONES', pageWidth - marginX, 20.5, {
        align: 'right',
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Importes vigentes tomados de la última revisión activa/presentada (sin duplicar histórico)',
        pageWidth - marginX,
        25,
        { align: 'right' }
      );

      // 4. Cuadrícula de Control Documental estilo ISL-GT-F20 (2 filas x 3 columnas)
      autoTable(doc, {
        startY: 28,
        margin: { left: marginX, right: marginX },
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
          lineColor: [203, 213, 225],
          lineWidth: 0.25,
          textColor: [15, 23, 42],
        },
        body: [
          [
            {
              content: `EMISIÓN:  ${dateDisplay}`,
              styles: { fontStyle: 'bold', fillColor: [248, 250, 252] },
            },
            {
              content: `GENERADO POR:  ${generatedBy.split('(')[0].trim()}`,
              styles: { fontStyle: 'bold', fillColor: [248, 250, 252] },
            },
            {
              content: `EXPEDIENTES:  ${rows.length} totales (${activeCount} activos / ${closedCount} cerrados)`,
              styles: { fontStyle: 'bold', fillColor: [248, 250, 252] },
            },
          ],
          [
            {
              content: `SISTEMA:  IN SIDE LOGISTIC | Gestión de Cotizaciones`,
              styles: { fillColor: [255, 255, 255] },
            },
            {
              content: `TOTAL OFERTADO VIGENTE:  ${formatMoneyMxn(totalOffered)}`,
              styles: { fontStyle: 'bold', textColor: [15, 39, 71], fillColor: [255, 255, 255] },
            },
            {
              content: `TOTAL ADJUDICADO:  ${formatMoneyMxn(totalAwarded)}`,
              styles: { fontStyle: 'bold', textColor: [6, 95, 70], fillColor: [236, 253, 245] },
            },
          ],
        ],
        columnStyles: {
          0: { cellWidth: contentWidth / 3 },
          1: { cellWidth: contentWidth / 3 },
          2: { cellWidth: contentWidth / 3 },
        },
      });

      const afterGridY =
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 45;

      // 5. Tabla principal bien estructurada
      const tableBody = rows.map((r, index) => [
        String(index + 1).padStart(2, '0'),
        r.folio,
        `${r.customerShortName}\n${r.originLabel}`,
        `${r.projectName}\nResp: ${r.responsibleName.split('(')[0].trim()}`,
        r.statusLabel,
        r.awardedAmountNum > 0
          ? `${r.commercialStatusLabel}\nAdj: ${r.awardedAmountFormatted}`
          : r.commercialStatusLabel,
        r.revisionsSummary || 'Sin revisiones',
        r.offeredAmountFormatted,
      ]);

      autoTable(doc, {
        startY: afterGridY + 5,
        margin: { left: marginX, right: marginX, bottom: 18 },
        head: [
          [
            '#',
            'Folio',
            'Cliente / Origen',
            'Proyecto y Responsable',
            'Estado',
            'Estatus Comercial',
            'Revisiones',
            'Importe Vigente',
          ],
        ],
        body:
          tableBody.length > 0
            ? tableBody
            : [['—', 'Sin expedientes registrados', '', '', '', '', '', '']],
        foot:
          tableBody.length > 0
            ? [
                [
                  '',
                  'TOTALES',
                  `${rows.length} expedientes`,
                  '',
                  '',
                  `Adjudicado: ${formatMoneyMxn(totalAwarded)}`,
                  '',
                  formatMoneyMxn(totalOffered),
                ],
              ]
            : undefined,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 39, 71],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
          cellPadding: { top: 2.8, bottom: 2.8, left: 2.5, right: 2.5 },
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 39, 71],
          fontStyle: 'bold',
          fontSize: 8.5,
          lineColor: [15, 39, 71],
          lineWidth: 0.3,
        },
        styles: {
          fontSize: 7.8,
          cellPadding: { top: 2.4, bottom: 2.4, left: 2.5, right: 2.5 },
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          valign: 'middle',
          textColor: [30, 41, 59],
          overflow: 'linebreak',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 31, fontStyle: 'bold', textColor: [15, 39, 71] },
          2: { cellWidth: 34 },
          3: { cellWidth: 66 },
          4: { cellWidth: 23, fontStyle: 'bold' },
          5: { cellWidth: 35 },
          6: { cellWidth: 26 },
          7: { cellWidth: 27.4, halign: 'right', fontStyle: 'bold' },
        },
      });

      // 6. Pie de página corporativo en todas las hojas
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(199, 33, 6);
        doc.setLineWidth(0.6);
        doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
          'IN SIDE LOGISTIC S.A. DE C.V.  |  Calle Aldama #35 Nave 2, San Lorenzo Almecatla  |  Tel. (222) 263 04 77  |  www.insidelogistic.com.mx',
          marginX,
          pageHeight - 8.5
        );

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 39, 71);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - marginX, pageHeight - 8.5, {
          align: 'right',
        });
      }

      doc.save(`IN_SIDE_LOGISTIC_Resumen_Cotizaciones_${dateIso}.pdf`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownloadPdf}
      disabled={generating}
      className="px-4 py-2 rounded-xl bg-[#C72106] hover:bg-[#A31B05] text-white text-xs font-bold uppercase tracking-wider font-titulos shadow-industrial-red inline-flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
    >
      <FileDown className="w-4 h-4" />
      <span>{generating ? 'Generando PDF...' : 'Descargar Resumen PDF'}</span>
    </button>
  );
}
