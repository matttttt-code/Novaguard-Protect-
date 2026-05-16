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
import * as sanctioninfo from "./sanctioninfo.js";
import * as infome from "./infome.js";
import * as getid from "./getid.js";
import * as botinfo from "./botinfo.js";
import * as commandlist from "./commandlist.js";
import type { ChatInputCommandInteraction, Message } from "discord.js";
import type { PrefixCommand } from "../prefix-handler.js";

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
  sanctioninfo,
  infome,
  getid,
  botinfo,
  commandlist,
];

type PrefixModule = {
  prefixName: string;
  prefixAliases?: string[];
  executeMessage: (message: Message, args: string[]) => Promise<void>;
};

const prefixModules: PrefixModule[] = [
  sanctioninfo,
  infome,
  getid,
  botinfo,
  commandlist,
];

export const prefixCommands: PrefixCommand[] = prefixModules.map((mod) => ({
  name: mod.prefixName,
  aliases: mod.prefixAliases,
  execute: (message, args) => mod.executeMessage(message, args),
}));
