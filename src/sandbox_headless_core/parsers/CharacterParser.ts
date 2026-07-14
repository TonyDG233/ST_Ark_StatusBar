import * as fs from 'fs';
import { v2CharDataSchema, v2CharData } from '../types/TavernData';

export class CharacterParser {
  /**
   * 解析 V2 格式的角色卡 PNG 图片
   * @param filePath PNG 图片的绝对路径
   * @returns 强类型的 v2CharData 实体
   */
  public static parsePng(filePath: string): v2CharData {
    const buffer = fs.readFileSync(filePath);

    // 检查 PNG 格式文件头 (89 50 4E 47 0D 0A 1A 0A)
    if (buffer.readUInt32BE(0) !== 0x89504E47) {
      throw new Error('解析失败：不是合法的 PNG 文件。');
    }

    let offset = 8;
    let charaDataStr = '';

    // 遍历 PNG 的数据块 (Chunks)
    while (offset < buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      
      if (type === 'tEXt') {
        // tEXt 数据块结构：Keyword (null-terminated) + Text String
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        const nullSeparator = data.indexOf(0);
        
        if (nullSeparator !== -1) {
          const keyword = data.toString('ascii', 0, nullSeparator);
          if (keyword === 'chara') {
            // 酒馆的 V2 标准将角色卡 JSON 字符串做 Base64 编码后存在 chara 关键字下
            charaDataStr = data.toString('utf8', nullSeparator + 1);
            break;
          }
        }
      }
      
      // 跳到下一个 Chunk：length(4) + type(4) + data(length) + crc(4)
      offset += 8 + length + 4;
    }

    if (!charaDataStr) {
      throw new Error('解析失败：未在 PNG 中找到 [chara] tEXt 数据块，该图片可能不是酒馆角色卡。');
    }

    // V2 角色卡数据是 Base64 编码的
    let decodedStr = '';
    try {
      decodedStr = Buffer.from(charaDataStr, 'base64').toString('utf8');
    } catch (e) {
      throw new Error('Base64 解码失败，数据可能已损坏。');
    }

    // 解析 JSON
    let rawJson: any;
    try {
      rawJson = JSON.parse(decodedStr);
    } catch (e) {
      throw new Error('JSON 解析失败，角色卡数据格式异常。');
    }

    // 适配 V2/V3 外层 Wrapper ({"spec": "chara_card_v2", "data": { ... }})
    let cardData = rawJson;
    if (rawJson.spec === 'chara_card_v2' || rawJson.spec === 'chara_card_v3') {
       cardData = rawJson.data;
    } else if (rawJson.data !== undefined) {
       cardData = rawJson.data;
    }

    // 返回 Zod 校验后的强类型实体
    return v2CharDataSchema.parse(cardData);
  }
}
