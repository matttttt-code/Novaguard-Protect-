declare module "node-gtts" {
  import { Readable } from "stream";
  class gTTS {
    constructor(text: string, lang: string);
    stream(): Readable;
    save(filepath: string, callback: (err: Error | null) => void): void;
  }
  export = gTTS;
}
