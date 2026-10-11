import type { Group, GroupMessage } from "@pi-bot/protocol";
import { randomUUID } from "node:crypto";

export function createGroup(spec: {
  name: string;
  members: string[];
  turnOrder?: string[];
}): Group {
  return {
    id: randomUUID(),
    name: spec.name,
    members: spec.members,
    turnOrder: spec.turnOrder ?? spec.members,
    currentTurn: 0,
    created: Date.now(),
  };
}

export function addMember(group: Group, botId: string): Group {
  if (group.members.includes(botId)) {
    return group;
  }

  return {
    ...group,
    members: [...group.members, botId],
    turnOrder: [...group.turnOrder, botId],
  };
}

export function removeMember(group: Group, botId: string): Group {
  return {
    ...group,
    members: group.members.filter((id) => id !== botId),
    turnOrder: group.turnOrder.filter((id) => id !== botId),
  };
}

export function getNextBot(group: Group): string | undefined {
  if (group.turnOrder.length === 0) return undefined;
  
  const nextIndex = group.currentTurn % group.turnOrder.length;
  return group.turnOrder[nextIndex];
}

export function advanceTurn(group: Group): Group {
  return {
    ...group,
    currentTurn: group.currentTurn + 1,
  };
}

export interface ParsedMessage {
  content: string;
  mentions: string[];
  pass: boolean;
}

export function parseGroupMessage(content: string, _group: Group): ParsedMessage {
  const mentionPattern = /@(\w+)/g;
  const mentions: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(content)) !== null) {
    if (match[1]) {
      mentions.push(match[1]);
    }
  }

  const pass = /\[PASS\]/i.test(content);

  return {
    content,
    mentions,
    pass,
  };
}

export function resolveMentions(mentions: string[], members: Array<{ id: string; name: string }>): string[] {
  const resolved: string[] = [];

  for (const mention of mentions) {
    const bot = members.find((m) => 
      m.name.toLowerCase() === mention.toLowerCase() ||
      m.id === mention
    );
    
    if (bot?.id) {
      resolved.push(bot.id);
    }
  }

  return resolved;
}

export function createGroupMessage(spec: {
  groupId: string;
  botId: string;
  botName: string;
  content: string;
  mentions?: string[];
}): GroupMessage {
  return {
    id: randomUUID(),
    groupId: spec.groupId,
    botId: spec.botId,
    botName: spec.botName,
    content: spec.content,
    mentions: spec.mentions ?? [],
    timestamp: Date.now(),
  };
}

export function shouldBotRespond(message: ParsedMessage, botName: string, isCurrentTurn: boolean): boolean {
  if (message.mentions.length > 0) {
    return message.mentions.some((m) => m.toLowerCase() === botName.toLowerCase());
  }

  return isCurrentTurn && !message.pass;
}
