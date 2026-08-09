/**
 * src/sandbox_shujuku/core/db/SqliteEngine.ts
 * 
 * SQLite 内存关系型数据库引擎的【无头提纯解耦版本】
 * 
 * 彻底切除了 shujuku 原版中由于 CDN、Userscript 单文件打包限制而强塞的：
 * 1. __ACU_SQLITE_ENGINE_IMPORT__ 构建期占位符
 * 2. __ACU_SQLITE_WASM_BASE64__ Wasm内联 Base64 替换等黑客手段。
 * 
 * 本实现完全兼容标准 TS/Vite/Webpack 环境：
 * - 默认采用纯 Javascript asm.js 模式 (sql-asm.js)，免去任何 WASM 加载 404 与路径配置痛苦，对 RPG 状态数据（~数千行）具备微秒级查询性能。
 * - 提供了标准的 Wasm 加载旁路，允许通过 locateFile 干净加载独立 .wasm 资源，零污染。
 */

import initSqlJs from 'sql.js'; // 导入标准 NPM 模块类型

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: string | null;
  pk: boolean;
}

export interface QueryResult {
  columns: string[];
  values: any[][];
}

export interface MutationResult {
  changes: number;
}

export interface BatchResult<T = void> {
  totalChanges: number;
  finalizeResult?: T;
}

export class SqliteEngine {
  private db: any = null;
  private sqlJs: any = null;

  /** 是否已就绪 */
  get isReady(): boolean {
    return this.db !== null;
  }

  /**
   * 初始化数据库引擎
   * @param options.mode 'asm' 为纯 JS 模式，'wasm' 为 Wasm 模式
   * @param options.locateFile (仅在 wasm 模式下需要) 返回 .wasm 文件的物理加载 URL
   */
  public async init(options: { mode?: 'asm' | 'wasm'; locateFile?: (file: string) => string } = {}): Promise<void> {
    this.dispose();

    const mode = options.mode || 'asm';
    try {
      console.info(`[SQLite_Engine] 正在以 ${mode.toUpperCase()} 模式初始化 SQLite...`);
      
      if (mode === 'asm') {
        // 1. asm.js 纯 JS 模式：直接引入 sql.js 的 asm 版，0 外部依赖，0 路径卡点
        // @ts-ignore
        const initAsm = require('sql.js/dist/sql-asm-memory-growth.js');
        this.sqlJs = await initAsm();
      } else {
        // 2. wasm 模式：采用标准 Webpack CopyWebpackPlugin 复制出的 wasm 加载路径
        const locateFile = options.locateFile || ((file: string) => `./${file}`);
        this.sqlJs = await initSqlJs({ locateFile });
      }

      this.db = new this.sqlJs.Database();
      
      // 启用外键约束
      this.db.run('PRAGMA foreign_keys = ON;');
      console.info('[SQLite_Engine] SQLite 内存数据库就绪，外键约束已启用');
    } catch (e: any) {
      console.error('[SQLite_Engine] 引擎初始化失败:', e);
      throw new Error(`SQLite 运行时初始化失败: ${e?.message || String(e)}`);
    }
  }

  /**
   * 执行 SELECT 查询并返回第一组结果（列名 + values）
   */
  public query(sql: string, params?: any[]): QueryResult {
    this.ensureDb();
    try {
      const results = this.db.exec(sql, params);
      if (results.length === 0) {
        return { columns: [], values: [] };
      }
      return {
        columns: results[0].columns,
        values: results[0].values,
      };
    } catch (e: any) {
      console.error('[SQLite_Engine] Query 失败:', sql.substring(0, 150), '| 错误:', e?.message || e);
      throw e;
    }
  }

  /**
   * 执行单条 DML 指令（INSERT, UPDATE, DELETE, CREATE 等）
   */
  public run(sql: string, params?: any[]): MutationResult {
    this.ensureDb();
    try {
      this.db.run(sql, params);
      return { changes: this.db.getRowsModified() };
    } catch (e: any) {
      console.error('[SQLite_Engine] Run 失败:', sql.substring(0, 150), '| 错误:', e?.message || e);
      throw e;
    }
  }

  /**
   * 批量原子事务执行
   * 任何一条语句失败 -> ROLLBACK 整个事务 -> 抛出包含精准行数报错
   */
  public runBatch(statements: string[]): BatchResult {
    this.ensureDb();
    if (statements.length === 0) return { totalChanges: 0 };

    let totalChanges = 0;
    this.db.run('BEGIN TRANSACTION;');
    try {
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt) continue;
        try {
          this.db.run(stmt);
          totalChanges += this.db.getRowsModified();
        } catch (e: any) {
          try {
            this.db.run('ROLLBACK;');
          } catch (_) {}
          const errMsg = e?.message || String(e);
          throw new Error(`第 ${i + 1} 条 SQL 失败: "${stmt}" → 错误详情: ${errMsg}`);
        }
      }
      this.db.run('COMMIT;');
      return { totalChanges };
    } catch (e: any) {
      if (e.message && e.message.startsWith('第 ')) throw e;
      try {
        this.db.run('ROLLBACK;');
      } catch (_) {}
      throw e;
    }
  }

  /**
   * 获取所有用户表名（排除 sqlite_ 内部表和 _acu_ 前缀的内部系统表）
   */
  public getTableNames(): string[] {
    this.ensureDb();
    const result = this.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_acu_%' ORDER BY name;"
    );
    return result.values.map(row => String(row[0]));
  }

  /**
   * 获取指定表的列属性（PRAGMA table_info）
   */
  public getTableInfo(tableName: string): ColumnInfo[] {
    this.ensureDb();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`非法表名安全拦截: ${tableName}`);
    }
    const result = this.query(`PRAGMA table_info(${tableName});`);
    return result.values.map(row => ({
      cid: Number(row[0]),
      name: String(row[1]),
      type: String(row[2]),
      notnull: row[3] === 1,
      dflt_value: row[4] != null ? String(row[4]) : null,
      pk: row[5] === 1,
    }));
  }

  /**
   * 获取建表 DDL
   */
  public getTableDDL(tableName: string): string | null {
    this.ensureDb();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`非法表名安全拦截: ${tableName}`);
    }
    const result = this.query(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name=?;",
      [tableName]
    );
    if (result.values.length === 0) return null;
    return String(result.values[0][0]);
  }

  /**
   * 导出二进制数据库快照 (Checkpoint)
   */
  public exportBinary(): Uint8Array {
    this.ensureDb();
    return this.db.export();
  }

  /**
   * 从二进制快照中重新水合（载入现场）
   */
  public async loadFromBinary(data: Uint8Array, options: { mode?: 'asm' | 'wasm'; locateFile?: (file: string) => string } = {}): Promise<void> {
    const mode = options.mode || 'asm';
    if (!this.sqlJs) {
      if (mode === 'asm') {
        // @ts-ignore
        const initAsm = require('sql.js/dist/sql-asm-memory-growth.js');
        this.sqlJs = await initAsm();
      } else {
        const locateFile = options.locateFile || ((file: string) => `./${file}`);
        this.sqlJs = await initSqlJs({ locateFile });
      }
    }
    this.dispose();
    this.db = new this.sqlJs.Database(data);
    this.db.run('PRAGMA foreign_keys = ON;');
  }

  /**
   * 销毁数据库，释放内存
   */
  public dispose(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (_) {}
      this.db = null;
    }
  }

  private ensureDb(): void {
    if (!this.db) {
      throw new Error('SqliteEngine: 数据库实例未建立。请先调用 init() 或 loadFromBinary()。');
    }
  }
}
