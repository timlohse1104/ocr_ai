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
    this.convertStartTime = null;
    this.convertEndTime = null;
    this.convertTime = null;
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
    this.recognizeStartTime = null;
    this.recognizeEndTime = null;
    this.recognizeTime = null;
    this.analyzeStartTime = null;
    this.analyzeEndTime = null;
    this.analyzeTime = null;
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
  const filename = process.argv[filenameIndex + 1];

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
    console.log(`OCR all ${files.length} pdf files...`);
    for (const file of files) {
      if (file.endsWith(".pdf")) {
        const runAnalyticsInformation = new RunAnalyticsInformation();
        runAnalyticsInformations.push(runAnalyticsInformation);
        const pages = await convert(
          file.replace(".pdf", ""),
          runAnalyticsInformation
        );
        await recognize(
          file.replace(".pdf", ""),
          pages,
          runAnalyticsInformation
        );
      }
    }
  }

  // OCR one pdf file with tesseract
  if (filename) {
    console.log(`OCR ${filename}.pdf...`);
    const runAnalyticsInformation = new RunAnalyticsInformation();
    runAnalyticsInformations.push(runAnalyticsInformation);
    const pages = await convert(filename, runAnalyticsInformation);
    await recognize(filename, pages, runAnalyticsInformation);
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
  runAnalyticsInformation.convertStartTime = convertStartTime;
  runAnalyticsInformation.convertEndTime = convertEndTime;
  runAnalyticsInformation.convertTime = convertTimeDifferenceSecond;
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

async function recognize(filename, pages) {
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
  console.log("FOO");
  for (let i = 1; i < pages; i++) {
    const imagePath = path.join(
      __dirname,
      `./output/${filename}.${i}.${format}`
    );
    const ret = await worker.recognize(imagePath);
    fs.appendFileSync(outputTxtFile, ret.data.text.replace(/\n/g, " "));
    fs.appendFileSync(outputHtmlFile, ret.data.hocr, { flag: "a+" });
  }

  const resultText = await fs.readFileSync(outputTxtFile).toString("utf8");
  console.log(`Recognition found ${resultText.split(" ").length} words.`);
  console.debug("[DEBUG] :", resultText);
  await worker.terminate();
  const recognizeEndTime = new Date();
  const recognizeTimeDifference = recognizeEndTime - recognizeStartTime;
  console.log(`Recognition took: ${recognizeTimeDifference / 1000}s.`);

  // Add analytics information
}

async function analyze() {
  const baseUrl = process.env.BASE_URL;

  console.log(
    `Analyzing text for ${filename}.pdf to find assignable properties...`
  );
  const analyzeStartTime = new Date();

  let analyzeResult;
  try {
    analyzeResult = await axios.post(`${baseUrl}/completion`);
    console.log(result.headers, result.status, result.statusText);
    return JSON.parse(result.data.content);
  } catch (error) {
    console.error("Error:", error.message);
  }

  const analyzeEndTime = new Date();
  const analyzeTimeDifference = analyzeEndTime - analyzeStartTime;
  console.log("Found:", analyzeResult.data.content);
  console.log(`Analyzing took: ${analyzeTimeDifference / 1000}s.`);
}

async function persistRunAnalytics(runAnalyticsInformations) {
  console.log("Persisting run analytics informations...", {
    runAnalyticsInformations,
  });

  const filePath = path.join(
    __dirname,
    `./output/${process.env.RUN_INFORMATIONS_FILENAME}`
  );

  const pastRunInformation = JSON.parse(fs.readFileSync(filePath).toString());

  console.log("pastRunInformation", pastRunInformation);
}
