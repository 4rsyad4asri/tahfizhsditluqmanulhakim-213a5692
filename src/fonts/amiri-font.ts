import { jsPDF } from "jspdf";
import AmiriRegular from "./Amiri-Regular.ttf";

const font = AmiriRegular;

(jsPDF as any).API.events.push([
  "addFonts",
  function () {
    this.addFileToVFS("Amiri-Regular.ttf", font);
    this.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    this.addFont("Amiri-Regular.ttf", "Amiri", "bold");
  },
]);
