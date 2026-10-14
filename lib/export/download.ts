import { zipSync } from 'fflate';

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadZip(files: { name: string; blob: Blob }[], zipName: string): Promise<void> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer());
  const zipped = zipSync(entries, { level: 0 });
  downloadBlob(new Blob([zipped as BlobPart], { type: 'application/zip' }), zipName);
}
