import { jsPDF } from "jspdf";
import amiriFont from "./Amiri-Regular.ttf?base64";

jsPDF.API.events.push([
  "addFonts",
  function () {

    this.addFileToVFS(
      "Amiri-Regular.ttf",
      amiriFont
    );

    this.addFont(
      "Amiri-Regular.ttf",
      "Amiri",
      "normal"
    );

    this.addFont(
      "Amiri-Regular.ttf",
      "Amiri",
      "bold"
    );
  },
]);
