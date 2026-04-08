import fs from "node:fs";

export function createOutputPathOrExitProcess(outputPath: string) {
  if (!fs.existsSync(outputPath)) {
    try {
      fs.mkdirSync(outputPath, { recursive: true });
    } catch (_err) {
      console.error(`Could not create output directory at ${outputPath}`);
      process.exit(1);
    }
  }
}

export function writeToFileOrExitProcess(fileName: string, fileContent: string) {
  fs.writeFile(fileName, fileContent, (err) => {
    if (err) {
      console.error(`Could not write to ${fileName} (${err})`);
      process.exit(1);
    } else {
      console.log(`Successfully wrote to ${fileName}`);
    }
  });
}
