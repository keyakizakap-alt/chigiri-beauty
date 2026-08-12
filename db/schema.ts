import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  brand: text("brand").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  volume: text("volume"),
  price: integer("price"),
  priceType: text("price_type").notNull(),
  currency: text("currency").notNull().default("JPY"),
  claimsJson: text("claims_json").notNull().default("[]"),
  ingredientHighlightsJson: text("ingredient_highlights_json").notNull().default("[]"),
  officialUrl: text("official_url").notNull(),
  sourcePublisher: text("source_publisher").notNull(),
  sourceCheckedAt: text("source_checked_at").notNull(),
  verificationStatus: text("verification_status").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const consultations = sqliteTable("consultations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  concernSummary: text("concern_summary").notNull(),
  selectedProductIdsJson: text("selected_product_ids_json").notNull().default("[]"),
  purchaseNeeded: integer("purchase_needed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const chatSessions = sqliteTable("chat_sessions", {
  ownerKey: text("owner_key").notNull(),
  id: text("id").notNull(),
  specialistId: text("specialist_id").notNull(),
  title: text("title").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.ownerKey, table.id] }),
  index("chat_sessions_owner_specialist_updated_idx").on(table.ownerKey, table.specialistId, table.updatedAt),
]);

export const deletedChatSessions = sqliteTable("deleted_chat_sessions", {
  ownerKey: text("owner_key").notNull(),
  id: text("id").notNull(),
  deletedAt: text("deleted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.ownerKey, table.id] }),
]);

export const beautyCheckIns = sqliteTable("beauty_check_ins", {
  ownerKey: text("owner_key").notNull(),
  id: text("id").notNull(),
  specialistId: text("specialist_id").notNull(),
  payloadJson: text("payload_json").notNull(),
  recordedAt: text("recorded_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.ownerKey, table.id] }),
  index("beauty_check_ins_owner_specialist_recorded_idx").on(table.ownerKey, table.specialistId, table.recordedAt),
]);

export const uploadedAssets = sqliteTable("uploaded_assets", {
  ownerKey: text("owner_key").notNull(),
  id: text("id").notNull(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.ownerKey, table.id] }),
  index("uploaded_assets_owner_created_idx").on(table.ownerKey, table.createdAt),
]);
