import {
  pgTable,
  decimal,
  date,
  text,
  timestamp,
  bigserial,
  index,
} from "drizzle-orm/pg-core";

export const creditCard = pgTable(
  "credit_card",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

    cardDate: date("date"),

    remarks: text("remark"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    cardDateIdx: index("idx_credit_card_date").on(table.cardDate),

    createdAtIdx: index("idx_credit_card_created_at").on(table.createdAt),
  })
);

