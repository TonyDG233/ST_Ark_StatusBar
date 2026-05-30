case "playsound":

					{
						
let auds = [];
						if (m1 === \"playmusic\" && sets.intro) auds.push(sets.intro);
						if (sets.key) auds.push(sets.key);
						for (
let aud of auds) {
							
let key = exFun.getAudioUrl(aud) || \"\";
							if (!key) continue;
							assets.add(key);
						}
					}
					
break;