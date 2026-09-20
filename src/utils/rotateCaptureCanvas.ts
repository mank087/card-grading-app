/** Rotate the original capture, so repeated preview turns never re-encode a JPEG. */
export function rotateCaptureCanvas(source: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const turns = ((quarterTurns % 4) + 4) % 4;
  const canvas = document.createElement('canvas');
  canvas.width = turns % 2 ? source.height : source.width;
  canvas.height = turns % 2 ? source.width : source.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(turns * Math.PI / 2);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}
