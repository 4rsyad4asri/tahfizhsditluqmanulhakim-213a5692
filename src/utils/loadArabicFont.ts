import { jsPDF } from "jspdf";

let fontBase64Cache: string | null = null;

export const loadArabicFont = async (doc: jsPDF) => {

  // LOAD FONT SEKALI SAJA
  if (!fontBase64Cache) {

    const response = await fetch(
      "/fonts/Amiri-Regular.ttf"
    );

    const fontBlob =
      await response.arrayBuffer();

    fontBase64Cache = btoa(
      new Uint8Array(fontBlob)
        .reduce(
          (data, byte) =>
            data + String.fromCharCode(byte),
          ""
        )
    );
  }

  // REGISTER KE DOC BARU
  doc.addFileToVFS(
    "Amiri-Regular.ttf",
    fontBase64Cache
  );

  doc.addFont(
    "Amiri-Regular.ttf",
    "Amiri",
    "normal"
  );
};
