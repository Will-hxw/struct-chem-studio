import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const studyEvents = sqliteTable(
  "study_events",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    owner: text("owner").notNull(),
    eventId: text("event_id").notNull(),
    event: text("event").notNull(),
  },
  (t) => [
    uniqueIndex("study_owner_event").on(t.owner, t.eventId),
    index("study_owner_seq").on(t.owner, t.seq),
  ],
);
export const tutorRequests = sqliteTable(
  "tutor_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    owner: text("owner").notNull(),
    at: integer("at").notNull(),
  },
  (t) => [
    index("tutor_request_time").on(t.at),
    index("tutor_owner_time").on(t.owner, t.at),
  ],
);

export const studyDrafts = sqliteTable(
  "study_drafts",
  {
    owner: text("owner").notNull(),
    kind: text("kind").notNull(),
    version: integer("version").notNull(),
    body: text("body").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.kind] })],
);
export const chemAccounts = sqliteTable("chem_accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  salt: text("salt").notNull(),
  pw: text("pw").notNull(),
  recovery: text("recovery").notNull(),
});
export const chemSessions = sqliteTable(
  "chem_sessions",
  {
    digest: text("digest").primaryKey(),
    uid: text("uid").notNull(),
    expiry: integer("expiry").notNull(),
  },
  (t) => [
    index("chem_sessions_uid").on(t.uid),
    index("chem_sessions_expiry").on(t.expiry),
  ],
);
export const chemLimits = sqliteTable(
  "chem_limits",
  {
    bucket: text("bucket").notNull(),
    window: integer("window").notNull(),
    n: integer("n").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.window] })],
);
export const emailCodes = sqliteTable(
  "email_codes",
  {
    email: text("email").notNull(),
    purpose: text("purpose").notNull(),
    digest: text("digest").notNull(),
    sent: integer("sent").notNull(),
    tries: integer("tries").notNull(),
  },
  (t) => [primaryKey({ columns: [t.email, t.purpose] })],
);
export const gmailGrant=sqliteTable("gmail_grant",{sender:text("sender").primaryKey(),cipher:text("cipher").notNull(),iv:text("iv").notNull()});
