case "multiline":

					{
						if (!sets.name) 
							continue;

						if (!logs.multi){
							logs.now = \"\";
						}

						logs.name = sets.name;
						logs.now += match[5];
						if (sets.end == \"true\") {
							fun_playback(\"@pa\", logs.getRecordPara());
							logs.multiEnd();
						}
						else {
							logs.multiBegin();
						}
					}
					
break;