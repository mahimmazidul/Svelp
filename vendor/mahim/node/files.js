import { readFile, writeFile } from "node:fs/promises";
import { openMahim, parseMahimHeader } from "../reader/reader.js";
export async function readMahimFile(path, options) {
    const bytes = new Uint8Array(await readFile(path));
    return openMahim(bytes, options);
}
export async function parseMahimFileHeader(path) {
    const bytes = new Uint8Array(await readFile(path));
    return parseMahimHeader(bytes);
}
export async function writeMahimFile(path, bytes) {
    await writeFile(path, bytes);
}
