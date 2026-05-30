case "largeimg":

					{
						
let imgs = sets.imagegroup ? sets.imagegroup.split('/') : [];
						for (
let img of imgs) {
							
let key = (m1.endsWith('bg') ? \"bg_\" : \"\") + img.toLowerCase();
							if (!key) continue;
							if (!imgs[key]) {
								support.log(LogType.error, false, `<${m1}>Linked key [${key}] not exist.`);
								continue;
							}
							assets.add(imgs[key]);
						}
					}
					
break;