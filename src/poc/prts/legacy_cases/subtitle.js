case "subtitle":

					{
						
let text = sets.text || \"\";
						logs.name = \"\";
						if (!text) {
							if (logs.multi) {
								fun_playback(\"@pa\", logs.getRecordPara());
								logs.multiEnd();
							}
							continue;
						}
						if (m1 === \"sticker\" && !logs.multiID.endsWith(sets.id) && logs.multi) {
							fun_playback(\"@pa\", logs.getRecordPara());
							logs.multiEnd();
						}

						if (sets.multi == \"true\") {
							logs.now += text;
							logs.multiBegin(sets.id);
							continue;
						}

						logs.now = text;
						fun_playback(\"@pa\", logs.getRecordPara());
					}
					
break;