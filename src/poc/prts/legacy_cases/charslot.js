case "charslot":

					{
						if (cfgs.check('char', page, i)) {
							
let pas = cfgs['char'][page][i + 1];
							sets.name = pas.name || sets.name;
							if (m1 === \"character\") sets.name2 = pas.name2 || sets.name2;
							txts[i] = exFun.serialize(match[1], sets);
						}
						
let names = [];
						if (sets.name) names.push(sets.name.toLowerCase());
						if (m1 === \"character\" && sets.name2) names.push(sets.name2.toLowerCase());
						for (
let name of names) {
							
let [k, i] = exFun.charLink(name);
							if (k == -1) continue;
							
let key = exFun.charFormat(k, i);
							if (!chars[key]) {
								support.log(LogType.error, false, `<${m1}>Linked key [${key}] not exist.`);
								continue;
							}
							assets.add(chars[key]);
						}
					}
					
break;