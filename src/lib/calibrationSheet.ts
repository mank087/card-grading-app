/**
 * Printable calibration sheet — verifies the user's printer is at 100% scale
 * before they print labels. Browsers default to "fit to page", which silently
 * rescales output a few percent; for a 2.8" slab insert that's the difference
 * between fits and doesn't.
 */
export async function downloadCalibrationSheet(): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('DCM Label Studio — Print Calibration Sheet', 0.75, 0.9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('1. Print this page with scale set to 100% ("Actual Size" — NOT "Fit to page").', 0.75, 1.35);
  doc.text('2. Measure the shapes below with a ruler.', 0.75, 1.6);
  doc.text('3. If they match, your labels will print at the correct size.', 0.75, 1.85);

  // 1-inch square
  doc.setLineWidth(0.02);
  doc.rect(0.75, 2.3, 1, 1);
  doc.setFontSize(10);
  doc.text('This square must measure exactly 1" x 1" (2.54 cm)', 1.95, 2.85);

  // Slab label outline (2.8" x 0.8")
  doc.rect(0.75, 3.8, 2.8, 0.8);
  doc.text('This box is the exact size of a slab label: 2.8" x 0.8"', 0.75, 4.9);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Tip: hold a slab label slot over the box — the printed label will fill it edge to edge.', 0.75, 5.15);

  // 5-inch ruler
  doc.setTextColor(0);
  doc.setFontSize(10);
  const rulerY = 5.8;
  doc.setLineWidth(0.015);
  doc.line(0.75, rulerY, 5.75, rulerY);
  for (let i = 0; i <= 5; i++) {
    doc.line(0.75 + i, rulerY - 0.12, 0.75 + i, rulerY);
    doc.text(String(i), 0.72 + i, rulerY + 0.22);
  }
  doc.text('This ruler must measure exactly 5 inches', 0.75, rulerY + 0.55);

  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('If the measurements are off: in your print dialog, set Scale to 100% / Actual Size and disable', 0.75, 7.0);
  doc.text('"Fit to printable area". On macOS, uncheck "Scale to Fit". Then print this sheet again to verify.', 0.75, 7.2);

  doc.save('DCM-Print-Calibration.pdf');
}
