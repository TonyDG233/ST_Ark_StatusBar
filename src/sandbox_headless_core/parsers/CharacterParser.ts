import { v2CharDataSchema, v2CharData } from '../types/TavernData';

export class CharacterParser {
  /**
   * 跨平台解析 V2/V3 格式的角色卡 PNG 图片 (支持 Node.js 与 浏览器/Vue 环境)
   * @param source 绝对路径 (Node-only) 或 ArrayBuffer/Uint8Array 二进制字节数据 (跨平台)
   * @returns 强类型的 v2CharData 实体
   */
  public static parsePng(source: string | ArrayBuffer | Uint8Array): v2CharData {
    let bytes: Uint8Array;

    if (typeof source === 'string') {
      // Node.js 文件路径解析
      if (typeof window !== 'undefined') {
        throw new Error('在浏览器环境下不能通过文件路径直接解析 PNG，请传入 ArrayBuffer 或 Uint8Array！');
      }
      // 使用 eval('require') 绕过 Webpack 浏览器打包分析，防范编译飘红
      const fsNode = eval('require')('fs');
      const buffer = fsNode.readFileSync(source);
      bytes = new Uint8Array(buffer);
    } else if (source instanceof ArrayBuffer) {
      bytes = new Uint8Array(source);
    } else if (source instanceof Uint8Array) {
      bytes = source;
    } else {
      throw new Error('解析失败：不支持的源数据格式。');
    }

    // 检查 PNG 格式文件头 (89 50 4E 47 0D 0A 1A 0A)
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
      throw new Error('解析失败：不是合法的 PNG 文件。');
    }

    let offset = 8;
    let charaDataStr = '';

    // 遍历 PNG 的数据块 (Chunks)
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) break;

      // 读取 Chunk 长度 (4字节 Big Endian)
      const length = (bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
      
      // 读取 Chunk 类型 (4字节 ASCII)
      const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);

      if (type === 'tEXt') {
        const dataOffset = offset + 8;
        if (dataOffset + length > bytes.length) break;

        // tEXt 数据块结构：Keyword (null-terminated) + Text String
        let nullSeparator = -1;
        for (let i = 0; i < length; i++) {
          if (bytes[dataOffset + i] === 0) {
            nullSeparator = i;
            break;
          }
        }

        if (nullSeparator !== -1) {
          let keyword = '';
          for (let i = 0; i < nullSeparator; i++) {
            keyword += String.fromCharCode(bytes[dataOffset + i]);
          }

          if (keyword === 'chara') {
            // 提取 Base64 数据串
            const textBytes = bytes.subarray(dataOffset + nullSeparator + 1, dataOffset + length);
            charaDataStr = new TextDecoder('utf-8').decode(textBytes);
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

    // Base64 解码
    let decodedStr = '';
    try {
      decodedStr = atob(charaDataStr);
    } catch (e) {
      if (typeof Buffer !== 'undefined') {
        decodedStr = Buffer.from(charaDataStr, 'base64').toString('utf8');
      } else {
        throw new Error('Base64 解码失败，数据可能已损坏。');
      }
    }

    // 重新用 utf-8 解码解码后的 Base64 字节串 (防止 atob 乱码中文)
    try {
      const decodedBytes = new Uint8Array(decodedStr.split('').map(c => c.charCodeAt(0)));
      decodedStr = new TextDecoder('utf-8').decode(decodedBytes);
    } catch (e) {}

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
