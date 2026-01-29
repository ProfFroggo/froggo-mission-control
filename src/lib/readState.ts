/**
 * Read State Management - Track message read/replied status
 */

export interface ReadState {
  messageId: string;
  platform: string;
  chatId: string;
  chatName?: string;
  sender?: string;
  isRead: boolean;
  readAt?: string;
  messageTimestamp: string;
  preview?: string;
}

export interface ReadCursor {
  platform: string;
  chatId: string;
  chatName?: string;
  lastReadMessageId?: string;
  lastReadAt?: string;
  unreadCount: number;
  lastMessageTimestamp?: string;
  priorityScore?: number;
  isMuted?: boolean;
}

export interface ConversationStatus {
  chatId: string;
  platform: string;
  unreadCount: number;
  hasUnreplied: boolean;
  lastMessageTime?: string;
  lastReplyTime?: string;
}

/**
 * Fetch unread count for a specific chat
 */
export async function getUnreadCount(platform: string, chatId: string): Promise<number> {
  try {
    if (!window.clawdbot?.db?.query) {
      return 0;
    }
    
    const result = await window.clawdbot.db.query(
      `SELECT COUNT(*) as count FROM message_read_state 
       WHERE platform = ? AND chat_id = ? AND is_read = 0`,
      [platform, chatId]
    );
    
    return result.rows?.[0]?.count || 0;
  } catch (error) {
    console.error('[readState] Error fetching unread count:', error);
    return 0;
  }
}

/**
 * Fetch all unread messages grouped by chat
 */
export async function getUnreadChats(): Promise<ReadCursor[]> {
  try {
    if (!window.clawdbot?.db?.query) {
      return [];
    }
    
    const result = await window.clawdbot.db.query(
      `SELECT 
        platform,
        chat_id as chatId,
        chat_name as chatName,
        COUNT(*) as unreadCount,
        MAX(message_timestamp) as lastMessageTimestamp
      FROM message_read_state
      WHERE is_read = 0
      GROUP BY platform, chat_id
      ORDER BY lastMessageTimestamp DESC`
    );
    
    return result.rows || [];
  } catch (error) {
    console.error('[readState] Error fetching unread chats:', error);
    return [];
  }
}

/**
 * Mark a specific message as read
 */
export async function markMessageRead(platform: string, chatId: string, messageId: string): Promise<boolean> {
  try {
    if (!window.clawdbot?.db?.exec) {
      return false;
    }
    
    await window.clawdbot.db.exec(
      `UPDATE message_read_state 
       SET is_read = 1, read_at = datetime('now'), updated_at = datetime('now')
       WHERE platform = ? AND chat_id = ? AND message_id = ?`,
      [platform, chatId, messageId]
    );
    
    return true;
  } catch (error) {
    console.error('[readState] Error marking message read:', error);
    return false;
  }
}

/**
 * Mark all messages in a chat as read
 */
export async function markChatRead(platform: string, chatId: string): Promise<boolean> {
  try {
    if (!window.clawdbot?.db?.exec) {
      return false;
    }
    
    await window.clawdbot.db.exec(
      `UPDATE message_read_state 
       SET is_read = 1, read_at = datetime('now'), updated_at = datetime('now')
       WHERE platform = ? AND chat_id = ? AND is_read = 0`,
      [platform, chatId]
    );
    
    return true;
  } catch (error) {
    console.error('[readState] Error marking chat read:', error);
    return false;
  }
}

/**
 * Mark a message as unread (to flag for follow-up)
 */
export async function markMessageUnread(platform: string, chatId: string, messageId: string): Promise<boolean> {
  try {
    if (!window.clawdbot?.db?.exec) {
      return false;
    }
    
    await window.clawdbot.db.exec(
      `UPDATE message_read_state 
       SET is_read = 0, read_at = NULL, updated_at = datetime('now')
       WHERE platform = ? AND chat_id = ? AND message_id = ?`,
      [platform, chatId, messageId]
    );
    
    return true;
  } catch (error) {
    console.error('[readState] Error marking message unread:', error);
    return false;
  }
}

/**
 * Check if a conversation has been replied to
 */
export async function hasReplied(platform: string, chatId: string, sinceTimestamp?: string): Promise<boolean> {
  try {
    if (!window.clawdbot?.db?.query) {
      return false;
    }
    
    // Check if there are any outgoing messages (from assistant) after the last unread message
    const query = sinceTimestamp 
      ? `SELECT COUNT(*) as count FROM messages 
         WHERE channel = ? 
         AND session_key LIKE ? 
         AND role IN ('assistant', 'system')
         AND timestamp > ?`
      : `SELECT COUNT(*) as count FROM messages 
         WHERE channel = ? 
         AND session_key LIKE ? 
         AND role IN ('assistant', 'system')
         AND timestamp > (
           SELECT MAX(message_timestamp) 
           FROM message_read_state 
           WHERE platform = ? AND chat_id = ? AND is_read = 0
         )`;
    
    const params = sinceTimestamp 
      ? [platform, `%${chatId}%`, sinceTimestamp]
      : [platform, `%${chatId}%`, platform, chatId];
    
    const result = await window.clawdbot.db.query(query, params);
    
    return (result.rows?.[0]?.count || 0) > 0;
  } catch (error) {
    console.error('[readState] Error checking replied status:', error);
    return false;
  }
}

/**
 * Get conversation status (unread + unreplied)
 */
export async function getConversationStatus(platform: string, chatId: string): Promise<ConversationStatus> {
  try {
    const unreadCount = await getUnreadCount(platform, chatId);
    const hasUnrepliedMessages = !await hasReplied(platform, chatId);
    
    // Get last message time
    const lastMsgResult = await window.clawdbot?.db?.query(
      `SELECT MAX(message_timestamp) as lastTime 
       FROM message_read_state 
       WHERE platform = ? AND chat_id = ?`,
      [platform, chatId]
    );
    
    const lastMessageTime = lastMsgResult?.rows?.[0]?.lastTime;
    
    // Get last reply time
    const lastReplyResult = await window.clawdbot?.db?.query(
      `SELECT MAX(timestamp) as lastReply 
       FROM messages 
       WHERE channel = ? 
       AND session_key LIKE ? 
       AND role IN ('assistant', 'system')`,
      [platform, `%${chatId}%`]
    );
    
    const lastReplyTime = lastReplyResult?.rows?.[0]?.lastReply;
    
    return {
      chatId,
      platform,
      unreadCount,
      hasUnreplied: unreadCount > 0 && hasUnrepliedMessages,
      lastMessageTime,
      lastReplyTime,
    };
  } catch (error) {
    console.error('[readState] Error getting conversation status:', error);
    return {
      chatId,
      platform,
      unreadCount: 0,
      hasUnreplied: false,
    };
  }
}

/**
 * Get all conversations with their status
 */
export async function getAllConversationStatuses(): Promise<ConversationStatus[]> {
  try {
    if (!window.clawdbot?.db?.query) {
      return [];
    }
    
    // Get all unique conversations from messages
    const result = await window.clawdbot.db.query(
      `SELECT DISTINCT channel as platform, session_key 
       FROM messages 
       WHERE role = 'user' 
       ORDER BY timestamp DESC`
    );
    
    const conversations = result.rows || [];
    const statuses: ConversationStatus[] = [];
    
    for (const conv of conversations) {
      const chatId = conv.session_key.split(':').pop() || '';
      const status = await getConversationStatus(conv.platform, chatId);
      statuses.push(status);
    }
    
    return statuses;
  } catch (error) {
    console.error('[readState] Error getting all conversation statuses:', error);
    return [];
  }
}
