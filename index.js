import { createWorker } from "tesseract.js";
import { PDFDocument } from "pdf-lib";
import { fromBuffer } from "pdf2pic";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RunAnalyticsInformation {
  constructor() {
    this.convertionStartTime = null;
    this.convertionEndTime = null;
    this.convertionTime = null;
    this.tesseract = {
      format: null,
      density: null,
      quality: null,
      originalWidth: null,
      originalHeight: null,
      upscaleFactor: null,
      preserveAspectRatio: null,
    };
    this.document = {
      name: null,
      pageCount: null,
      convertedImagesInformation: [],
    };
    this.recognitionStartTime = null;
    this.recognitionEndTime = null;
    this.recognitionTime = null;
    this.recognitionTxtFile = null;
    this.recognitionHtmlFile = null;
    this.recognitionImagePaths = [];
    this.recognitionFulltext = null;
    this.analysisStartTime = null;
    this.analysisEndTime = null;
    this.analysisTime = null;
    this.analysisResult = null;
  }
}

(async () => {
  // Load environment variables
  dotenv.config();

  // Show help
  const helpIndex = process.argv.findIndex((arg) => arg === "--help");
  if (helpIndex !== -1) {
    console.log(
      "Use --filename <filename> to ocr one file or --all to ocr all files."
    );
    process.exit(0);
  }

  // Get the value of the "--filename" input parameter
  const filenameIndex = process.argv.findIndex((arg) => arg === "--filename");
  const filename = filenameIndex === -1 ? "" : process.argv[filenameIndex + 1];

  // Check if the "--all" input parameter is present
  const allIndex = process.argv.findIndex((arg) => arg === "--all");
  const all = allIndex !== -1;

  if (!filename && !all) {
    console.error(
      "No statement set. Use --filename <filename> to ocr one file or --all to ocr all files."
    );
    process.exit(1);
  }

  // OCR all pdf files with tesseract
  const runAnalyticsInformations = [];

  if (all) {
    const files = fs.readdirSync("./input");
    console.log(files);
    console.log(`OCR all ${files.length} pdf files...`);
    for (const file of files) {
      if (file.endsWith(".pdf")) {
        const filename = file.replace(".pdf", "");
        const runAnalyticsInformation = new RunAnalyticsInformation();
        runAnalyticsInformations.push(runAnalyticsInformation);
        const pages = await convert(filename, runAnalyticsInformation);
        const ocrFulltext = await recognize(
          filename,
          pages,
          runAnalyticsInformation
        );
        await analyze(filename, ocrFulltext);
      }
    }
    console.log(`Successfully analyzed all ${files.length} pdf files.`);
  }

  // OCR one pdf file with tesseract
  if (filename) {
    console.log(`OCR ${filename}.pdf...`);
    const runAnalyticsInformation = new RunAnalyticsInformation();
    runAnalyticsInformations.push(runAnalyticsInformation);
    const pages = await convert(filename, runAnalyticsInformation);
    const ocrFulltext = await recognize(
      filename,
      pages,
      runAnalyticsInformation
    );
    await analyze(filename, ocrFulltext, runAnalyticsInformation);
    console.log(`Successfully analyzed ${filename}.pdf.`);
  }

  // Persist run analytics
  persistRunAnalytics(runAnalyticsInformations);

  // TODO: Analyze image with LLM
  // console.log("Analyzing recognized text with LLM...");
  // const llmResult = await analyze();
})();

async function convert(filename, runAnalyticsInformation) {
  const convertStartTime = new Date();
  // Convert PDF to image

  const format = process.env.TESSERACT_FORMAT;
  const density = process.env.TESSERACT_DENSITY;
  // const width = process.env.TESSERACT_WIDTH;
  const quality = process.env.TESSERACT_QUALITY;
  console.log(`Converting ${filename}.pdf to image...`);
  const pdfBuffer = fs.readFileSync(`./input/${filename}.pdf`);
  fs.exi;
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();
  // Assume all pages have the same size
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();
  const upscaleFactor = 3;
  const preserveAspectRatio = true;
  const options = {
    density,
    quality,
    saveFilename: filename,
    savePath: "./output",
    format,
    width: width * upscaleFactor,
    height: height * upscaleFactor,
    preserveAspectRatio,
  };
  const converter = fromBuffer(pdfBuffer, options);

  for (let i = 1; i <= pageCount; i++) {
    console.log(`Converting page ${i}...`);
    const convertedImage = await converter(i);
    runAnalyticsInformation.document.convertedImagesInformation.push(
      convertedImage
    );
    console.debug(`[DEBUG] Page ${i} was converted to image.`, convertedImage);
  }

  const convertEndTime = new Date();
  const convertTimeDifferenceSecond =
    (convertEndTime - convertStartTime) / 1000;
  console.log(
    `Conversion of ${pageCount} pages took: ${convertTimeDifferenceSecond}s.`
  );

  // Add analytics information
  runAnalyticsInformation.convertionStartTime = convertStartTime;
  runAnalyticsInformation.convertionEndTime = convertEndTime;
  runAnalyticsInformation.convertionTime = convertTimeDifferenceSecond;
  runAnalyticsInformation.tesseract.format = format;
  runAnalyticsInformation.tesseract.density = density;
  runAnalyticsInformation.tesseract.quality = quality;
  runAnalyticsInformation.tesseract.originalWidth = width;
  runAnalyticsInformation.tesseract.originalHeight = height;
  runAnalyticsInformation.tesseract.upscaleFactor = upscaleFactor;
  runAnalyticsInformation.tesseract.preserveAspectRatio = preserveAspectRatio;
  runAnalyticsInformation.document.name = `${filename}.pdf`;
  runAnalyticsInformation.document.pageCount = pageCount;

  return pageCount;
}

async function recognize(filename, pages, runAnalyticsInformation) {
  const recognizeStartTime = new Date();

  // Recognize image with Tesseract
  const format = process.env.TESSERACT_FORMAT;
  console.log(`Recognizing ${filename}.${format} with Tesseract...`);
  const worker = await createWorker("deu");
  const outputTxtFile = path.join(
    __dirname,
    `./output/${filename}.ocr-recognition.txt`
  );
  const outputHtmlFile = path.join(
    __dirname,
    `./output/${filename}.ocr-recognition.html`
  );

  // Clear output files
  fs.writeFileSync(outputTxtFile, "");
  fs.writeFileSync(outputHtmlFile, "");

  // Recognize pages
  for (let i = 1; i <= pages; i++) {
    const imagePath = path.join(
      __dirname,
      `./output/${filename}.${i}.${format}`
    );
    runAnalyticsInformation.recognitionImagePaths.push(imagePath);
    const ret = await worker.recognize(imagePath);
    const recognizedFulltext = ret.data.text.replace(/\n/g, " ");
    fs.appendFileSync(outputTxtFile, recognizedFulltext);
    fs.appendFileSync(outputHtmlFile, ret.data.hocr, { flag: "a+" });
  }
  const resultText = fs.readFileSync(outputTxtFile).toString("utf8");
  console.log(`Recognition found ${resultText.split(" ").length} words.`);
  console.debug("[DEBUG] :", resultText);
  await worker.terminate();
  const recognizeEndTime = new Date();
  const recognizeTimeDifferenceSeconds =
    (recognizeEndTime - recognizeStartTime) / 1000;
  console.log(`Recognition took: ${recognizeTimeDifferenceSeconds}s.`);

  // Add analytics information
  runAnalyticsInformation.recognitionStartTime = recognizeStartTime;
  runAnalyticsInformation.recognitionEndTime = recognizeEndTime;
  runAnalyticsInformation.recognitionTime = recognizeTimeDifferenceSeconds;
  runAnalyticsInformation.recognitionTxtFile = outputTxtFile;
  runAnalyticsInformation.recognitionHtmlFile = outputHtmlFile;
  runAnalyticsInformation.recognitionFulltext = resultText;

  return resultText;
}

async function analyze(filename, ocrFulltext, runAnalyticsInformation) {
  const baseUrl = process.env.COMPLETION_BASE_URL;

  console.log(
    `Analyzing text for ${filename}.pdf to find assignable properties...`
  );
  const analyzeStartTime = new Date();

  let analyzeResponse;
  let analyzeResult;
  try {
    const completionBody = {
      stream: false,
      n_predict: 400,
      temperature: 0.1,
      stop: ["</s>"],
      repeat_last_n: 256,
      repeat_penalty: 1.18,
      top_k: 40,
      top_p: 0.5,
      tfs_z: 1,
      typical_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
      min_p: 0.05,
      mirostat: 0,
      mirostat_tau: 5,
      mirostat_eta: 0.1,
      grammar:
        '# Grammar for subset of JSON - doesn\'t support full string or number syntax\n\nroot  ::= object\nvalue ::= object | array | string | number | boolean | "null"\n\nobject ::=\n  "{" ws (\n            string ":" ws value\n    ("," ws string ":" ws value)*\n  )? "}"\n\narray  ::=\n  "[" ws (\n            value\n    ("," ws value)*\n  )? "]"\n\nstring  ::=\n  "\\"" (\n    [^"\\\\] |\n    "\\\\" (["\\\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]) # escapes\n  )* "\\"" ws\n\n# Only plain integers and floating point numbers currently\nnumber ::= "-"? [0-9]+ ("." [0-9]+)? ws\n\nboolean ::= ("true" | "false") ws\n\n# Optional space: by convention, applied in this grammar after literal chars when allowed\nws ::= ([ \\t\\n] ws)?',
      n_probs: 0,
      prompt: `Der nachfolgende String besteht aus Wörtern, die per OCR aus einem Dokument ausgelesen wurden. Du sollst mir daraus Werte extrahieren ('Beschreibung des Wertes' - 'Schlüssel des Wertes für die Ausgabe'): 'Anbieter Name' - 'ocr:vendorName', 'Fälligkeits-Datum' - 'ocr:dueDate', 'Rechnungsdatum' - 'ocr:invoiceReceiptDate', 'Rechnungsnummer' - 'ocr:invoiceReceiptId', 'Zahlungsbedingungen' - 'ocr:paymentTerms', 'Empfänger Adresse' - 'ocr:receiverAddress', 'Nettobetrag' - 'ocr:subtotal', 'Mehrwehrtsteuer' - 'ocr:tax', 'Gesamtsumme' - 'ocr:total', 'Steuernummer' - 'ocr:taxPayerId', 'Öko Kontrollnummer' - 'ocr:oekoId', 'Anbieter Adresse' - 'ocr:vendorAddress', 'Umsatzsteuer Identifikationsnummer' - 'ocr:taxPayerUstId', 'Steuersatz' - 'ocr:taxRate', 'Lieferdatum' - 'ocr:deliveryDate', 'Telefonnummer des Anbieters' - 'ocr:vendorPhone', 'Faxnummer des Anbieters' - 'ocr:vendorFax', 'Email des Anbieters' - 'ocr:vendorEmail', 'Belegtyp' - 'ocr:invoiceReceiptType', 'Dokumentjahr' - 'ocr:invoiceReceiptYear', 'Skontosatz' - 'ocr:discountRate', 'Zahlungsziel Skonto' - 'ocr:discountDueDate', 'Zahlbetrag Skonto' - 'ocr:discountTotal', 'ID des Unternehmens des Empfängers' - 'ocr:receiverCompany', 'ocr:ibanList' - 'Liste aller erkannten IBANs', 'ocr:bicList' - 'Liste aller erkannten BICs' \n ${ocrFulltext}`,
    };
    console.log(
      `Requesting llm analysis from ${baseUrl}/completion with body`,
      completionBody
    );
    analyzeResponse = await axios.post(`${baseUrl}/completion`, completionBody);
    console.log("analyzeResponse", analyzeResponse);
    analyzeResult = JSON.parse(result.data.content);
  } catch (error) {
    console.error("Error:", error.message);
  }

  const analyzeEndTime = new Date();
  const analyzeTimeDifference = analyzeEndTime - analyzeStartTime;
  console.log(`[DEBUG] Analysis found:`, analyzeResult);
  console.log(`Analysis took: ${analyzeTimeDifference / 1000}s.`);

  // Add analytics information
  runAnalyticsInformation.analysisStartTime = analyzeStartTime;
  runAnalyticsInformation.analysisEndTime = analyzeEndTime;
  runAnalyticsInformation.analysisTime = analyzeTimeDifference;
  runAnalyticsInformation.analysisResult = analyzeResult;
}

async function persistRunAnalytics(runAnalyticsInformations) {
  console.log(
    "Persisting run analytics informations...",
    runAnalyticsInformations
  );

  const filePath = path.join(
    __dirname,
    `./analytics/${process.env.RUN_ANALYTICS_FILENAME}`
  );

  const pastRunInformation = JSON.parse(fs.readFileSync(filePath).toString());

  pastRunInformation.runs.push(...runAnalyticsInformations);

  fs.writeFileSync(filePath, JSON.stringify(pastRunInformation));
  console.log(
    `Persisted all ${runAnalyticsInformations.length} run analytics informations`
  );
  process.exit(0);
}
