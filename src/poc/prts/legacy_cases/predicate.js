case "predicate":

					{
						if (logs.first) document.getElementById(\"playback_all_result\").append(logs.first);
						logs.deciEnd();
					}
					
break;

			}
			continue;
		}
		else if (match[4] && match[5]) {
			
let p = match[4].toObject();
			if (p == null || p.name == undefined) continue;
			if (logs.multi) {
				fun_playback(\"@pa\", logs.getRecordPara());
				logs.multiEnd();
			}
			logs.name = p.name;
			logs.now = match[5];
			fun_playback(\"@pa\", logs.getRecordPara());
		}
	}
	for (
let asset of assets) {
		queue.loadFile(asset, false);
	}
	if (logs.first) document.getElementById(\"playback_all_result\").append(logs.first);
}

function fun_format_time(t) {

	
let arr = [Math.floor(t/3600),Math.floor((t%3600)/60),Math.floor(t%60)];
	for(
let i = 0;i<arr.length;i++){
		arr[i] = arr[i]<10 ? \"0\"+arr[i].toString() : arr[i].toString();
	}
	
return `${arr[0]}:${arr[1]}:${arr[2]}`;