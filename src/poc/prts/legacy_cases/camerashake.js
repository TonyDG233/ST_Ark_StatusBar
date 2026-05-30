case "camerashake":

				temp.t = cmd_set.duration == undefined ? -1 : +cmd_set.duration;
				temp.strx = cmd_set.xstrength == undefined ? 0 : cmd_set.xstrength * 0.75;
				temp.stry = cmd_set.ystrength == undefined ? 0 : cmd_set.ystrength * 0.75;
				temp.rnd = cmd_set.randomness == undefined ? 90 : +cmd_set.randomness;
				temp.v = cmd_set.vibrato == undefined ? 30 : +cmd_set.vibrato;
				timer.clear(\"shake\");
				temp.o1 = $(\"#sys_camera\");
				temp.o1.css({left:0,top:0});
				if(cmd_set.stop == \"true\"){
					temp.o1.removeAttr(\"d-sh-n\");
					temp.o1.removeAttr(\"d-sh-t\");
					
return 1;
				}
				temp.c1 = Math.floor(1000/temp.v);
				temp.c2 = temp.t * temp.v;
				if(temp.c2 >= 0 && temp.c2<1){
					fun_msg(-1,false,\"<CameraShake>The duration is too short,use the minimum value to instead.\");
					temp.c2 = 1;
				}
				fun_msg(1,true,\"<CameraShake>duration=\"+temp.t+\",xstrength=\"+temp.strx+\",ystrength=\"+temp.stry+\",randomness=\"+temp.rnd+\",vibrato=\"+temp.v);
				temp.o1.css(\"transition-duration\",(1/temp.v).toFixed(4) + \"s\");
				temp.o1.attr({\"d-sh-n\":\"shake\",\"d-sh-t\":0});
				timer.create(\"shake\",()=>timer_shake_common(\"sys_camera\",temp.strx,temp.stry,temp.rnd,temp.c2),temp.c1,true);
				if(cmd_set.block == \"true\"){
					fun_delay(\"block\",temp.t);
					
return 2;
				}
				
break;