import * as kick from "./kick.js";
import * as ban from "./ban.js";
import * as unban from "./unban.js";
import * as timeout from "./timeout.js";
import * as untimeout from "./untimeout.js";
import * as warn from "./warn.js";
import * as warnings from "./warnings.js";
import * as clear from "./clear.js";
import * as userinfo from "./userinfo.js";
import * as serverinfo from "./serverinfo.js";
import * as slowmode from "./slowmode.js";
import * as lock from "./lock.js";
import * as unlock from "./unlock.js";
import * as role from "./role.js";
import * as nickname from "./nickname.js";
import type { ChatInputCommandInteraction } from "discord.js";

export interface Command {
  data: { toJSON: () => object; name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

export const commands: Command[] = [
  kick,
  ban,
  unban,
  timeout,
  untimeout,
  warn,
  warnings,
  clear,
  userinfo,
  serverinfo,
  slowmode,
  lock,
  unlock,
  role,
  nickname,
];
