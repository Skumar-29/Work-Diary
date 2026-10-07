import { PDFDocument } from "pdf-lib";
export async function createPdf(svgs: string[], title: string) {
  if (!svgs.length) throw Error("No pages to export.");
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("Truck Workspace");
  for (const svg of svgs) {
    const dims = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    if (!dims) throw Error("Invalid document page.");
    const w = Number(dims[1]),
      h = Number(dims[2]),
      scale = 2.4,
      canvas = document.createElement("canvas");
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    const image = new Image(),
      url = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      );
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(Error("Could not render the document."));
        image.src = url;
      });
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Document rendering is unavailable.");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/png");
      const png = await pdf.embedPng(data);
      const page = pdf.addPage(w > h ? [841.89, 595.28] : [595.28, 841.89]);
      const fit = Math.min(page.getWidth() / w, page.getHeight() / h);
      page.drawImage(png, {
        x: (page.getWidth() - w * fit) / 2,
        y: (page.getHeight() - h * fit) / 2,
        width: w * fit,
        height: h * fit,
      });
    } finally {
      URL.revokeObjectURL(url);
      canvas.width = 1;
      canvas.height = 1;
    }
  }
  return new Blob([new Uint8Array(await pdf.save())], {
    type: "application/pdf",
  });
}
