import { type MahimReader } from "../reader/reader.js";
import type { MahimHeader } from "../format/header.js";
import type { OpenOptions } from "../reader/reader.js";
export declare function readMahimFile(path: string, options?: OpenOptions): Promise<MahimReader>;
export declare function parseMahimFileHeader(path: string): Promise<MahimHeader>;
export declare function writeMahimFile(path: string, bytes: Uint8Array): Promise<void>;
