import { useState } from "react";
import { Action, Modal, download, shareFile } from "./UI";

export function Document({
  pages,
  name,
  close,
}: {
  pages: string[];
  name: string;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [zoom, setZoom] = useState(false);
  async function output(share = false) {
    setBusy(true);
    try {
      const { createPdf } = await import("../documents/pdf");
      const blob = await createPdf(pages, name);
      if (share) await shareFile(blob, name + ".pdf");
      else download(blob, name + ".pdf");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={name} onClose={close}>
      <div className="row actions">
        <Action onClick={() => setZoom(!zoom)}>
          {zoom ? "Fit page" : "Enlarge"}
        </Action>
        <Action disabled={busy} onClick={() => output()} primary>
          {busy ? "Creating PDF…" : "Download PDF"}
        </Action>
        <Action disabled={busy} onClick={() => output(true)}>
          Share PDF
        </Action>
      </div>
      <div className={"paper-scroll " + (zoom ? "zoom" : "")}>
        {pages.map((p, i) => (
          <div
            className="paper"
            key={i}
            dangerouslySetInnerHTML={{ __html: p }}
          />
        ))}
      </div>
    </Modal>
  );
}
