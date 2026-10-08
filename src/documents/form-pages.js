import formBackgrounds from "./form-backgrounds.json";
import { escape, documentDate, imageURI, wrapLines, appendix } from "./common";
export function formPages(record) {
  const companyLogo = imageURI(record.logo),
    checks = record.checks,
    declarationAnswers = record.declarations;
  const $ = (id) => ({
    value:
      id === "tw-company"
        ? record.company
        : id === "tw-sign-name"
          ? record.signedName
          : id.startsWith("tw-weight-")
            ? record.values[id.replace("tw-", "")]
            : record.values[id.replace("tw-form-", "")] || "",
    checked: id === "tw-show-company" ? record.showCompany : record.showLogo,
  });
  const vehiclesInForm = () =>
    ["pm", "t1", "t2", "t3"].filter((k) => record.values[k]?.trim());
  const signatureIsApplied = () =>
    record.status === "Signed" &&
    record.reviewed &&
    !!imageURI(record.signature);
  function formSignatureImages(page) {
    if (!signatureIsApplied()) return "";
    const positions =
      page === 0
        ? [[66, 789, 147, 28]]
        : [
            [393, 165, 171, 26],
            [386, 775, 136, 22],
          ];
    return positions
      .map(
        ([x, y, w, h]) =>
          `<image href="${imageURI(record.signature)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`,
      )
      .join("");
  }
  const originalCompany = "SRI GURU GOBIND SINGH TRANSPORT PTY LTD";
  function formField(page, rect, value, size = 10) {
    if (value === undefined || value === null || value === "") return "";
    const origin = page === 0 ? -11.9622 : 0,
      top = page === 0 ? 853.671 : 841.92;
    const x = rect[0] - origin + 2,
      y = top - rect[3],
      w = rect[2] - rect[0] - 4,
      h = rect[3] - rect[1];
    const s = Math.min(size, h * 0.67),
      str = String(value),
      fit =
        str.length * s * 0.54 > w
          ? ` textLength="${w}" lengthAdjust="spacingAndGlyphs"`
          : "";
    return `<text x="${x}" y="${y + h / 2 + s * 0.34}" font-size="${s}"${fit}>${escape(str)}</text>`;
  }
  function brandOverlay(page) {
    const company = $("tw-company").value.trim(),
      same = company === originalCompany,
      show = $("tw-show-company").checked,
      showLogo = $("tw-show-logo").checked;
    let out = "";
    if (!same || !show) {
      const r = page === 0 ? [136, 17, 421, 34] : [0, 0, 595, 80];
      out += `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="#fff"/>`;
      if (show && company)
        out += `<text x="${page === 0 ? 346 : 376}" y="${page === 0 ? 38 : 49}" text-anchor="middle" fill="#203e72" font-size="${Math.min(page === 0 ? 15 : 16, 380 / (company.length * 0.57))}" font-weight="bold">${escape(company)}</text>`;
    }
    if (same && !show && showLogo && !companyLogo && page === 1)
      out += `<defs><clipPath id="original-logo"><rect x="80" y="20" width="76" height="51"/></clipPath></defs><image href="${formBackgrounds[page]}" width="100%" height="100%" clip-path="url(#original-logo)"/>`;
    if (companyLogo || !showLogo || !same) {
      const r = page === 0 ? [30, 5, 100, 77] : [80, 20, 76, 51];
      out += `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="#fff"/>`;
      if (showLogo && companyLogo)
        out += `<image href="${companyLogo}" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    if (page === 0 && (!same || !show)) {
      const name = show && company ? company : "the operator";
      out += `<rect x="16" y="415.5" width="532" height="25" fill="#fff"/><text x="282" y="425" text-anchor="middle" font-size="8.3">The arrival time is an estimate and is not binding on the driver.</text><text x="282" y="436" text-anchor="middle" font-size="8.3" textLength="${Math.min(510, ("Any delays affecting the ETA will be notified to " + name + ".").length * 4.2)}" lengthAdjust="spacingAndGlyphs">${escape("Any delays affecting the ETA will be notified to " + name + ".")}</text>`;
      out += `<rect x="16" y="677" width="480" height="25" fill="#fff"/><text x="17" y="687" font-size="8.5">I will report unscheduled rest, mechanical failures, hazards and incidents affecting this journey</text><text x="17" y="698" font-size="8.5">${escape("to " + name + ".")}</text>`;
      out += `<rect x="16" y="712" width="480" height="14" fill="#fff"/><text x="17" y="721" font-size="8.5" textLength="470" lengthAdjust="spacingAndGlyphs">${escape("Please return this completed document to " + name + " as soon as practical after this journey.")}</text>`;
    }
    return out;
  }
  function safeFormSvg(page) {
    const value = (k) => $("tw-form-" + k).value;
    const field = (r, v, s) => formField(page, r, v, s);
    let out = brandOverlay(page) + formSignatureImages(page);
    if (page === 0) {
      out +=
        '<rect x="306.064" y="276.635" width="18" height="18" fill="none" stroke="#000" stroke-width="0.8"/><rect x="372.77" y="275.663" width="18" height="18" fill="none" stroke="#000" stroke-width="0.8"/>';
      const inputs = [
        ["from", [83.198, 743.991, 243.278, 761.991]],
        ["to", [395.558, 743.991, 536.438, 761.991]],
        ["driver", [59.438, 715.071, 243.158, 734.391]],
        ["contact", [388.958, 715.071, 536.318, 734.391]],
        ["licence", [51.638, 684.711, 243.158, 704.031]],
        ["expiry", [376.238, 684.711, 536.318, 704.031]],
        ["pm", [84.278, 647.151, 162.758, 665.151]],
        ["t1", [164.798, 647.151, 243.278, 665.151]],
        ["t2", [245.318, 647.151, 323.798, 665.151]],
        ["t3", [325.838, 647.151, 404.318, 665.151]],
        ["accreditation", [399.038, 542.991, 484.838, 558.831]],
        ["vehicle-type", [84.278, 520.551, 162.758, 537.111]],
        ["manifest", [415.118, 520.551, 536.438, 537.111]],
        ["hours", [326.198, 487.191, 403.958, 513.591]],
        ["depart", [104.558, 461.151, 162.638, 480.471]],
      ];
      inputs.forEach(
        ([key, r]) =>
          (out += field(
            r,
            key === "expiry" ? documentDate(value(key)) : value(key),
          )),
      );
      ["steer", "drive", "1", "2", "3"].forEach(
        (k, i) =>
          (out += field(
            [84.278 + i * 80.52, 584.271, 162.758 + i * 80.52, 601.551],
            $("tw-weight-" + k).value,
          )),
      );
      const dep = value("date"),
        arrival = value("arrive"),
        arrDate = arrival.slice(0, 10),
        weekday = (v) =>
          v
            ? new Date(v + "T12:00:00Z").toLocaleDateString("en-AU", {
                timeZone: "UTC",
                weekday: "long",
                timeZone: "UTC",
              })
            : "";
      out +=
        field([180.518, 461.151, 323.678, 480.471], weekday(dep)) +
        field([348.038, 461.151, 484.718, 480.471], documentDate(dep));
      out +=
        field([104.558, 440.871, 162.638, 459.471], arrival.slice(11, 16)) +
        field([180.518, 440.871, 323.678, 459.471], weekday(arrDate)) +
        field([348.038, 440.871, 484.718, 459.471], documentDate(arrDate));
      if (value("scheme") === "Standard")
        out += field([294.102, 559.036, 312.102, 577.036], "✓", 16);
      if (value("scheme") === "BFM")
        out += field([360.808, 560.017, 378.808, 578.017], "✓", 16);
      const rows = [
        [381.591, 396.711],
        [353.271, 379.671],
        [327.951, 351.471],
        [304.071, 326.271],
        [291.831, 302.751],
        [279.591, 290.511],
        [256.431, 277.911],
        [234.711, 254.751],
        [222.471, 233.391],
        [198.591, 220.791],
        [186.351, 197.271],
        [174.111, 185.031],
        [150.951, 172.431],
      ];
      rows.forEach(
        ([a, b], i) =>
          (out += field([494, a, 532, b], declarationAnswers[i] || "", 9)),
      );
      out +=
        field([31.598, 68.631, 243.158, 90.111], $("tw-sign-name").value) +
        field([348.638, 45.471, 484.718, 66.951], documentDate(dep));
    } else {
      const inputs = [
        ["driver", [119.28, 720.72, 316.8, 740.28]],
        ["from", [390.84, 700.56, 566.04, 719.4]],
        ["pm", [119.16, 683.16, 228.24, 699.36]],
        ["t1", [229.8, 683.16, 316.92, 699.36]],
        ["t2", [119.16, 649.2, 228.24, 665.04]],
        ["t3", [229.8, 649.2, 316.92, 665.04]],
        ["odo", [453.188, 337.366, 566.846, 350.748]],
      ];
      inputs.forEach(([key, r]) => (out += field(r, value(key))));
      out += field(
        [390.84, 720.72, 566.04, 740.28],
        documentDate(value("date")) + " " + value("depart"),
      );
      const rowEdges = [
        245.3, 259.68, 273.6, 287.52, 301.56, 315.48, 329.4, 343.32, 369.36,
        395.52, 409.44, 423.36, 449.52, 463.44, 477.36, 491.28,
      ];
      const columns = {
        pm: [454, 482],
        t1: [482, 510],
        t2: [510, 538],
        t3: [538, 566],
      };
      vehiclesInForm().forEach((v) => {
        const [a, b] = columns[v];
        for (let i = 0; i < 15; i++)
          out += field(
            [
              a + 6,
              841.92 - rowEdges[i + 1] + 1,
              b - 4,
              841.92 - rowEdges[i] - 1,
            ],
            { ok: "✓", issue: "X", na: "–" }[checks[v][i]] || "",
            11,
          );
      });
      const de = [
        505.2, 544.2, 570.36, 584.28, 598.2, 612.12, 638.28, 664.44, 678.36,
      ];
      vehiclesInForm().forEach((v) => {
        const [a, b] = columns[v];
        for (let i = 0; i < 8; i++)
          out += field(
            [a + 6, 841.92 - de[i + 1] + 1, b - 4, 841.92 - de[i] - 1],
            declarationAnswers[13 + i] === "Yes"
              ? "✓"
              : declarationAnswers[13 + i] === "No"
                ? "X"
                : "",
            11,
          );
      });
      const lines = wrapLines(record.values.comments, 103);
      lines
        .slice(0, 5)
        .forEach(
          (line, i) =>
            (out += `<text x="35" y="${707 + i * 11}" font-size="9">${escape(line)}</text>`),
        );
      if (lines.length > 5)
        out += `<text x="35" y="765" font-size="8">Comments continue on attached page.</text>`;
      out += field([134.04, 45.6, 260.16, 67.2], $("tw-sign-name").value);
    }
    return `<svg class="tw-paper" viewBox="0 0 ${page === 0 ? "595.2002 841.6804" : "595.32 841.92"}" role="img" aria-label="${page === 0 ? "Safe driving plan" : "Vehicle daily checklist"} in the supplied original layout, ${signatureIsApplied() ? "signature applied" : "unsigned draft"}" xmlns="http://www.w3.org/2000/svg"><image href="${formBackgrounds[page]}" width="100%" height="100%"/><g fill="#000" font-family="Arial, sans-serif">${out}</g></svg>`;
  }
  const pages = [safeFormSvg(0), safeFormSvg(1)],
    extra = wrapLines(record.values.comments, 103).slice(5);
  for (let i = 0; i < extra.length; i += 48)
    pages.push(
      appendix(
        `Comments continued · ${record.values.driver} · ${documentDate(record.values.date)}`,
        extra.slice(i, i + 48),
      ),
    );
  return pages;
}
