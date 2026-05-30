case "showitem":

					{
						if (cfgs.check('image', page, i)) {
							
let pas = cfgs['image'][page][i + 1];
							for (
let [k, v] of Object.entries(pas)) {
								sets[k] = pas[k];
							}
							txts[i] = exFun.serialize(match[1], sets);
						}
						
let key = sets.image ? (m1 == \"background\" ? \"bg_\" : \"\") + sets.image.toLowerCase() : \"\";
						if (!key) continue;
						if (!imgs[key]) {
							support.log(LogType.error, false, `<${m1}>Linked key [${key}] not exist.`);
							continue;
						}
						assets.add(imgs[key]);
					}
					
break;