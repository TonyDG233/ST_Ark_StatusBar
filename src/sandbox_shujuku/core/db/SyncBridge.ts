/**
 * src/sandbox_shujuku/core/db/SyncBridge.ts
 * 
 * 数据格式兼容与同步桥 (Data Compatibility & Synchronization Bridge)
 * 
 * 职责：
 * 1. 【向下无损数据兼容】：将前 SQL 时代 (Native V1 模式) 的 JSON 矩阵（首列包含 null 或行号的 content[][] 数组）
 *    转换为符合 V2 关系型规范的表数据，并自动分配合法的唯一自增 row_id。
 * 2. 【数据加载水合】：将兼容后的 JSON 二维数组映射为 DDL 语句与 INSERT 指令，灌入 SQLite 运行时中。
 * 3. 【向后序列化兼容】：能够从 SQLite 数据库中将用户修改过的表导出为旧版的 V1 二维数组 JSON 格式。
 *    以此来保证只要新插件一安装，老玩家以往数月的存档能够被**原地自动读取、无损升级、并且完美写回**。
 */

import { SqliteEngine } from './SqliteEngine';

/** 旧版 V1/Native 格式定义的 Table 数据结构 */
export interface SheetV1 {
  name: string;
  note?: string;
  /**content[0] 为表头 (首列常为 null)，content[1+] 为数据 (首列常为 null 或无意义行号) */
  content: (string | number | null)[][];
}

export interface TableDataObjectV1 {
  mate?: {
    isolationCode?: string;
    [key: string]: any;
  };
  [sheetKey: string]: any; // 'sheet_1', 'sheet_2', etc.
}

export class SyncBridge {
  constructor(private engine: SqliteEngine) {}

  /**
   * 核心功能：从老玩家的 V1 JSON 存档包中水合加载数据到内存 SQLite 中。
   * 并在水合过程中对数据进行行标识合法化清洗、自动排查并分配 row_id 主键。
   */
  public loadFromV1Data(data: TableDataObjectV1): void {
    if (!this.engine.isReady) {
      throw new Error('SyncBridge: SQLite 引擎未就绪，请先 init()。');
    }

    const sheetKeys = Object.keys(data).filter(k => k.startsWith('sheet_'));
    console.info(`[SyncBridge] 开始解析并转换 ${sheetKeys.length} 个历史数据表...`);

    for (const key of sheetKeys) {
      const sheet = data[key] as SheetV1;
      if (!sheet || !Array.isArray(sheet.content) || sheet.content.length === 0) continue;

      try {
        this.hydrateSheetToSql(key, sheet);
      } catch (e: any) {
        console.error(`[SyncBridge] 解析历史表 ${key} (${sheet.name}) 失败:`, e);
        throw new Error(`历史表 ${sheet.name} 数据转换失败: ${e?.message || e}`);
      }
    }
  }

  /**
   * 核心功能：从 SQLite 数据库将所有数据表导出回旧版的 V1 JSON 矩阵结构。
   * 这保证了即使玩家退出、撤回或 Swipe，状态能无痕写回旧聊天文件。
   */
  public exportToV1Data(originalMate: any = {}): TableDataObjectV1 {
    this.engine.run(""); // 检查就绪
    const result: TableDataObjectV1 = { mate: originalMate };

    const tableNames = this.engine.getTableNames();
    console.info(`[SyncBridge] 正在将 SQLite 中 ${tableNames.length} 张用户表导出回 V1 JSON 矩阵...`);

    for (const tableName of tableNames) {
      try {
        const ddl = this.engine.getTableDDL(tableName);
        if (!ddl) continue;

        // 根据表名反向推导元数据
        const sheetKey = `sheet_${tableName.replace(/^tbl_/, '')}`; // 假定内部表名有前缀
        
        // 查询出该表全量数据
        const queryRes = this.engine.query(`SELECT * FROM ${tableName} ORDER BY row_id;`);
        
        const content: any[][] = [];
        
        // 1. 拼装 V1 格式的行 0 (表头)。在 V1 格式中，第 1 列固定为 null
        const headers = [null, ...queryRes.columns.filter(col => col !== 'row_id')];
        content.push(headers);

        // 2. 拼装 V1 格式的数据行。行 1+ 的第 1 列存放 row_id，其余列对应表头位置
        const colNamesNoRowId = queryRes.columns.filter(col => col !== 'row_id');
        for (const rowValues of queryRes.values) {
          const rowObj: Record<string, any> = {};
          queryRes.columns.forEach((col, idx) => {
            rowObj[col] = rowValues[idx];
          });

          const v1Row = [
            rowObj['row_id'] ?? null, // 第 1 列放 row_id 作为行标识
            ...colNamesNoRowId.map(col => rowObj[col] ?? null)
          ];
          content.push(v1Row);
        }

        result[sheetKey] = {
          name: tableName.replace(/^tbl_/, ''), // 还原表名
          content: content
        };
      } catch (e: any) {
        console.error(`[SyncBridge] 导出表 ${tableName} 失败:`, e);
      }
    }

    return result;
  }

  /**
   * 单表水合清洗底层私有逻辑
   */
  private hydrateSheetToSql(sheetKey: string, sheet: SheetV1): void {
    const rawContent = sheet.content;
    const rawHeaders = rawContent[0];
    if (!rawHeaders || rawHeaders.length <= 1) return;

    // 1. 清洗出真正的表头列名。
    // 在旧 V1 格式中，列 0 是 null（占位符）。我们排除第一列 null，清洗为标准的英文列名。
    const cleanHeaders = rawHeaders.slice(1).map((h, i) => {
      const name = String(h ?? '').trim();
      return name ? this.sanitizeIdentifier(name) : `col_${i + 1}`;
    });

    // 2. 确定物理表名
    const tableName = `tbl_${this.sanitizeIdentifier(sheet.name || sheetKey)}`;

    // 3. 构建 SQL DDL 语句。第一列被强制定义为 row_id INTEGER PRIMARY KEY 自增主键！
    const ddlColumns = [
      'row_id INTEGER PRIMARY KEY AUTOINCREMENT',
      ...cleanHeaders.map(colName => `${colName} TEXT`) // 默认所有业务列用 TEXT 存储
    ];
    const createTableSql = `CREATE TABLE IF NOT EXISTS ${tableName} (${ddlColumns.join(', ')});`;
    this.engine.run(createTableSql);

    // 4. 清洗数据行，自动分配合法的自增 row_id，并组装 INSERT 指令
    const dataRows = rawContent.slice(1);
    const insertStatements: string[] = [];

    let currentAutoRowId = 1;
    for (const row of dataRows) {
      if (!row || row.length <= 1) continue;

      // 提取第 0 列作为 row_id。如果是 null 或非法数字，则自动用分配器生成唯一自增主键
      let rowId = Number(row[0]);
      if (row[0] === null || !Number.isFinite(rowId) || rowId <= 0) {
        rowId = currentAutoRowId;
      }
      if (rowId >= currentAutoRowId) {
        currentAutoRowId = rowId + 1;
      }

      // 提取其余业务列
      const valCells = row.slice(1);
      const columns = ['row_id', ...cleanHeaders];
      
      const valuesSql = [
        rowId,
        ...valCells.map(cell => {
          if (cell === null || cell === undefined) return 'NULL';
          // 字符串转义：双单引号
          const cleanVal = String(cell).replace(/'/g, "''");
          return `'${cleanVal}'`;
        })
      ];

      insertStatements.push(
        `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${valuesSql.join(', ')});`
      );
    }

    if (insertStatements.length > 0) {
      this.engine.runBatch(insertStatements);
    }
  }

  /**
   * 将任意中英文或不合法的表头转换为合法的 SQLite 标识符（只允许字母、数字和下划线）
   */
  private sanitizeIdentifier(input: string): string {
    const clean = input
      .trim()
      .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_') // 允许中文表名/列名，过滤掉特殊标点符号
      .replace(/^([0-9])/, '_$1'); // 避免数字开头
    return clean || 'unnamed_field';
  }
}
