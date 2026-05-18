declare module "node-gtts" {
  import { Readable } from "stream";
  interface TTS {
    stream(text: string): Readable;
    save(filepath: string, text: string, callback: (err: Error | null) => void): void;
  }
  function gTTS(lang: string, debug?: boolean): TTS;
  export = gTTS;
}
