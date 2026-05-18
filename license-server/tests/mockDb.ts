import type { DbClient, DbError, DbQuery } from "../src/types.ts";

export class MockDb implements DbClient {
  tables = new Map<string, any[]>();
  constructor() {
    this.tables.set("licenses", []);
    this.tables.set("activation_log", []);
    this.tables.set("webhook_log", []);
  }
  from(table: string): DbQuery {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return new Query(this, table) as unknown as DbQuery;
  }
}

class Query implements PromiseLike<{ data: unknown; error: DbError | null }> {
  private filters: Array<{ column: string; value: unknown }> = [];
  private mode: "select" | "insert" | "update" = "select";
  private values: any;
  private orderBy: { column: string; ascending: boolean } | undefined;

  constructor(private db: MockDb, private table: string) {}
  select(): this { this.mode = this.mode === "insert" || this.mode === "update" ? this.mode : "select"; return this; }
  insert(values: unknown): this { this.mode = "insert"; this.values = values; return this; }
  update(values: unknown): this { this.mode = "update"; this.values = values; return this; }
  eq(column: string, value: unknown): this { this.filters.push({ column, value }); return this; }
  order(column: string, options?: { ascending?: boolean }): this { this.orderBy = { column, ascending: options?.ascending ?? true }; return this; }

  async maybeSingle<T>(): Promise<{ data: T | null; error: DbError | null }> {
    const result = await this.execute();
    const rows = result.data as any[];
    return { data: rows[0] as T ?? null, error: result.error };
  }

  async single<T>(): Promise<{ data: T | null; error: DbError | null }> {
    const result = await this.execute();
    const rows = result.data as any[];
    if (!rows[0]) return { data: null, error: { message: "No rows" } };
    return { data: rows[0] as T, error: result.error };
  }

  then<TResult1 = { data: unknown; error: DbError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: DbError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: unknown; error: DbError | null }> {
    const rows = this.db.tables.get(this.table)!;
    if (this.mode === "insert") {
      const input = Array.isArray(this.values) ? this.values : [this.values];
      const inserted = input.map((row) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }));
      rows.push(...inserted);
      return { data: inserted, error: null };
    }
    if (this.mode === "update") {
      const matched = this.applyFilters(rows);
      for (const row of matched) Object.assign(row, this.values);
      return { data: matched, error: null };
    }
    let selected = this.applyFilters(rows).map((row) => ({ ...row }));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      selected = selected.sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")) * (ascending ? 1 : -1));
    }
    return { data: selected, error: null };
  }

  private applyFilters(rows: any[]): any[] {
    return rows.filter((row) => this.filters.every((filter) => row[filter.column] === filter.value));
  }
}
