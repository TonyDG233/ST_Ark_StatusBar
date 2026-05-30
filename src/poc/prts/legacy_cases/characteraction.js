case "characteraction":

				temp.n = cmd_set.name == undefined ? \"\" : cmd_set.name;
				if(temp.n == \"\") 
return -1;
				temp.tp = cmd_set.type;
				temp.px = cmd_set.xpos == undefined ? 0 : cmd_set.xpos*0.75;
				temp.py = cmd_set.ypos == undefined ? 0 : cmd_set.ypos*0.75;
				temp.fd = cmd_set.duration == undefined ? cmd_set.fadetime == undefined ? 0.25 : +cmd_set.fadetime : +cmd_set.duration;
				temp.pw = cmd_set.power == undefined ? 0 : cmd_set.power*0.75;
				temp.tm = cmd_set.times == undefined ? 1 : +cmd_set.times;
				temp.o1 = $(`#char_${temp.n}`);
				if(temp.o1.length == 0){
					fun_msg(-2,false,\"<CharacterAction>Unexcepted character length.\");
					
return -1;
				}
				timer.clear(\"trans_action\",true);
				temp.d1 = temp.o1[0].style.transform.replace(/\\s/g,\"\").match(/^matrix\\((.*)\\).*$/i);
				temp.pos = temp.d1 == null ? [1,0,0,1,0,0] : temp.d1[1].split(\",\");
				temp.pos[4] = +temp.pos[4] + temp.px;temp.pos[5] = +temp.pos[5] - temp.py;
				
switch (temp.tp) {