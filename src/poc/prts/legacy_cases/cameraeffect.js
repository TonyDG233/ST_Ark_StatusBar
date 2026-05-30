case "cameraeffect":

				temp.d1 = cmd_set.effect == undefined ? \"\" : cmd_set.effect.toLowerCase();
				temp.d2 = cmd_set.amount == undefined ? 0 : cmd_set.amount;
				temp.t = cmd_set.fadetime == undefined ? -1 : +cmd_set.fadetime;
				temp.o1 = $(\"#sys_camera\");
				if(temp.t > 0){
					temp.o1.css(\"transition\",\"filter \"+temp.t+\"s linear\");
					timer.create(\"cmreff_w\",()=>{
						temp.o1.css(\"transition\",\"\");
					},temp.t*1000);
				}
				if(temp.d2 == 0){
					temp.o1.css(\"filter\",\"\");
					
break;

				}
				
switch (temp.d1) {