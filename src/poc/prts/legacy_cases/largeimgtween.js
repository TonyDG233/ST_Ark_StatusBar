case "largeimgtween":

					{
						if (cfgs.check('tween', page, i)) {
							
let pas = cfgs.tween[page][i + 1];
							for (
let [k, v] of Object.entries(pas)) {
								sets[k] = pas[k];
							}
							txts[i] = exFun.serialize(match[1], sets);
						}
					}