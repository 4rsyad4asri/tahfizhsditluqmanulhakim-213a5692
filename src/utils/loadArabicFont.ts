import { jsPDF } from "jspdf";

let loaded = false;

export const loadArabicFont = async (doc: jsPDF) => {
  if (loaded) return;

  const response = await fetch("/fonts/Amiri-Regular.ttf");

  const fontBlob = await response.arrayBuffer();

  const fontBase64 = btoa(
    new Uint8Array(fontBlob)
      .reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  doc.addFileToVFS(
    "Amiri-Regular.ttf",
    fontBase64
  );

  doc.addFont(
    "Amiri-Regular.ttf",
    "Amiri",
    "normal"
  );

  loaded = true;
};
