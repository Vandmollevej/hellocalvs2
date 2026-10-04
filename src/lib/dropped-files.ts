// Samler filerne fra et drag and drop-slip — også når en hel mappe er trukket
// ind (admin → Logo-upload og Billed-upload). Kun til brug i browseren.

function readAllEntries(reader: FileSystemDirectoryReader) {
  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          next();
        }
      }, reject);
    next();
  });
}

async function collectFiles(entry: FileSystemEntry, out: File[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    out.push(file);
  } else if (entry.isDirectory) {
    for (const child of await readAllEntries((entry as FileSystemDirectoryEntry).createReader())) {
      await collectFiles(child, out);
    }
  }
}

// Skal kaldes direkte fra drop-hændelsen: posterne i slippet kan kun læses,
// før første `await`.
export async function readDroppedFiles(transfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(transfer.items ?? [])
    .map((item) => (item.kind === "file" ? item.webkitGetAsEntry?.() ?? null : null))
    .filter((entry): entry is FileSystemEntry => entry !== null);
  const plainFiles = Array.from(transfer.files);
  if (entries.length === 0) return plainFiles;
  const files: File[] = [];
  for (const entry of entries) await collectFiles(entry, files);
  return files;
}
