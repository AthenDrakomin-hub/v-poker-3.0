import os

BASE = '/opt/texas-platform/api-server/src'

# 1. Add csMessages to schema.ts
schema_path = os.path.join(BASE, 'db/schema.ts')
with open(schema_path, 'r', encoding='utf-8') as f:
    schema = f.read()

if 'csMessages' not in schema:
    cs_schema = '''
// Customer service messages (agent <-> cs communication)
export const csMessages = pgTable("cs_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  senderRole: text("sender_role").notNull(),
  receiverId: integer("receiver_id").notNull(),
  receiverRole: text("receiver_role").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"), // text | chip_request | chip_response
  status: text("status").notNull().default("unread"), // unread | read | processed
  relatedData: jsonb("related_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
'''
    # Insert before the last export or at the end
    schema = schema.rstrip() + '\n' + cs_schema
    with open(schema_path, 'w', encoding='utf-8') as f:
        f.write(schema)
    print('Schema added')
else:
    print('Schema already exists')

# 2. Create messages.routes.ts
routes_path = os.path.join(BASE, 'routes/messages.routes.ts')
routes_content = '''import { Router, Request, Response } from "express";
import { db } from "@/db";
import { csMessages, users } from "@/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

const router = Router();

// GET /api/messages?peerId={userId} — 获取与某人的聊天记录
router.get("/", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const peerId = Number(req.query.peerId);
  if (!peerId) {
    res.status(400).json({ error: "缺少 peerId 参数" });
    return;
  }
  const messages = await db
    .select()
    .from(csMessages)
    .where(
      or(
        and(eq(csMessages.senderId, u.id), eq(csMessages.receiverId, peerId)),
        and(eq(csMessages.senderId, peerId), eq(csMessages.receiverId, u.id))
      )
    )
    .orderBy(desc(csMessages.id))
    .limit(100);

  // Mark received messages as read
  await db
    .update(csMessages)
    .set({ status: "read" })
    .where(and(eq(csMessages.receiverId, u.id), eq(csMessages.senderId, peerId), eq(csMessages.status, "unread")));

  res.json({ messages: messages.reverse() });
});

// GET /api/messages/contacts — 获取联系人列表（有过对话的人）
router.get("/contacts", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  // Get all unique peer IDs from messages where user is sender or receiver
  const sent = await db.select({ peerId: csMessages.receiverId }).from(csMessages).where(eq(csMessages.senderId, u.id));
  const received = await db.select({ peerId: csMessages.senderId }).from(csMessages).where(eq(csMessages.receiverId, u.id));
  const peerIds = [...new Set([...sent.map(s => s.peerId), ...received.map(r => r.peerId)])];

  if (peerIds.length === 0) {
    res.json({ contacts: [] });
    return;
  }

  const contactUsers = await db.select({ id: users.id, account: users.account, nickname: users.nickname, role: users.role, avatar: users.avatar }).from(users).where(sql`${users.id} IN (${sql.join(peerIds.map(id => sql`${id}`), sql`, `)})`);

  // Get unread count and last message for each contact
  const contacts = await Promise.all(contactUsers.map(async (cu) => {
    const unreadResult = await db.select({ count: sql<number>`count(*)` }).from(csMessages).where(and(eq(csMessages.senderId, cu.id), eq(csMessages.receiverId, u.id), eq(csMessages.status, "unread")));
    const lastMsg = await db.select().from(csMessages).where(or(and(eq(csMessages.senderId, u.id), eq(csMessages.receiverId, cu.id)), and(eq(csMessages.senderId, cu.id), eq(csMessages.receiverId, u.id)))).orderBy(desc(csMessages.id)).limit(1);
    return {
      ...cu,
      unreadCount: Number(unreadResult[0]?.count || 0),
      lastMessage: lastMsg[0]?.content || '',
      lastMessageTime: lastMsg[0]?.createdAt || null,
    };
  }));

  // Sort by last message time desc
  contacts.sort((a, b) => {
    if (!a.lastMessageTime) return 1;
    if (!b.lastMessageTime) return -1;
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
  });

  res.json({ contacts });
});

// GET /api/messages/unread-count — 未读消息总数
router.get("/unread-count", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const result = await db.select({ count: sql<number>`count(*)` }).from(csMessages).where(and(eq(csMessages.receiverId, u.id), eq(csMessages.status, "unread")));
  res.json({ unreadCount: Number(result[0]?.count || 0) });
});

// POST /api/messages — 发送消息
router.post("/", async (req: Request, res: Response) => {
  const u = await getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: "未登录" });
    return;
  }
  const { receiverId, content, type, relatedData } = req.body;
  if (!receiverId || !content?.trim()) {
    res.status(400).json({ error: "缺少 receiverId 或 content" });
    return;
  }
  // Get receiver info
  const receiverRows = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, Number(receiverId))).limit(1);
  if (receiverRows.length === 0) {
    res.status(404).json({ error: "接收者不存在" });
    return;
  }
  const receiver = receiverRows[0];

  const inserted = await db.insert(csMessages).values({
    senderId: u.id,
    senderRole: u.role,
    receiverId: receiver.id,
    receiverRole: receiver.role,
    content: content.trim(),
    type: type || "text",
    relatedData: relatedData || null,
  }).returning();

  res.json({ message: inserted[0] });
});

export default router;
'''
with open(routes_path, 'w', encoding='utf-8') as f:
    f.write(routes_content)
print('Routes file created')

# 3. Register route in index.ts
index_path = os.path.join(BASE, 'index.ts')
with open(index_path, 'r', encoding='utf-8') as f:
    index = f.read()

if 'messagesRoutes' not in index:
    # Add import
    index = index.replace(
        'import walletRoutes from "./routes/wallet.routes";',
        'import walletRoutes from "./routes/wallet.routes";\nimport messagesRoutes from "./routes/messages.routes";'
    )
    # Add route registration (after wallet)
    index = index.replace(
        'app.use("/api/wallet", walletRoutes);',
        'app.use("/api/wallet", walletRoutes);\n  app.use("/api/messages", messagesRoutes);'
    )
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(index)
    print('Route registered')
else:
    print('Route already registered')

print('Done')
