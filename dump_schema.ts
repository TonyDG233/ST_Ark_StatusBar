/* eslint-disable */
// @ts-nocheck
import _ from 'lodash';
import fs from 'node:fs';
import path from 'node:path';
import z from 'zod';

fs.globSync('src/**/schema.ts').forEach(async schema_file => {
  try {
    globalThis._ = _;
    globalThis.z = z;
<<<<<<< HEAD
    const module = await import(path.resolve(import.meta.dirname, schema_file));
=======
    const module = await import(
      (process.platform === 'win32' ? 'file://' : '') + path.resolve(import.meta.dirname, schema_file)
    );
>>>>>>> 7bdcf6686f559c588cd3e4b41cdfc5e6dd270e6f
    if (_.has(module, 'Schema')) {
      const schema = _.get(module, 'Schema');
      if (_.isFunction(schema)) {
        schema = schema();
      }
      fs.writeFileSync(
        path.join(path.dirname(schema_file), 'schema.json'),
        JSON.stringify(z.toJSONSchema(schema, { io: 'input', reused: 'ref' }), null, 2),
      );
    }
  } catch (e) {
    console.error(`生成 '${schema_file}' 对应的 schema.json 失败: ${e}`);
  }
});
