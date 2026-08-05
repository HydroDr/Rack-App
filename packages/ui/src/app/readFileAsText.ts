/** Uses FileReader rather than File.prototype.text() — broader environment support for the same result (jsdom's Blob/File implementation doesn't implement .text(), FileReader is more consistently available). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read the file."));
    reader.readAsText(file);
  });
}
