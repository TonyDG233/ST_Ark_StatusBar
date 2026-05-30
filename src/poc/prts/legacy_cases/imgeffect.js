case "imgeffect":

				temp.o1 = $('#sys_image');
				temp.o1.children().stop(true,true);
				temp.t = cmd_set.fadetime ? +cmd_set.fadetime : 0.15;
				temp.c1 = temp.o1.children('div').length;
				temp.n = (cmd_set.image && cmd_set.image.toLowerCase()) || \"\";
				if(temp.n == \"\"){
					if(temp.t > 0){
						temp.o1.children('div').fadeToExit(temp.t*1000,'linear');
						if(cmd_set.block == \"true\"){
							fun_delay(\"block\",temp.t);
							
return 2;
						}
					}
					else temp.o1.empty();
					
break;

				}
				temp.e1 = document.createElement('div');
				temp.e1 = $(temp.e1);
				temp.sx = cmd_set.xscale || cmd_set.width || 1;
				temp.sy = cmd_set.yscale || cmd_set.height || 1;
				temp.px = (cmd_set.x && cmd_set.x*0.75) || 0;
				temp.py = (cmd_set.y && cmd_set.y*0.75) || 0;
				if(imgs[temp.n] == undefined || imgs[temp.n] == \"\"){
					fun_msg(-2,false,\"<Image>Data [\"+temp.n+\"] not exist,please check the data list.\");
					
return -1;
				}
				temp.i1 = new Image();
				temp.i1.src = imgs[temp.n];
				temp.tsx = temp.i1.width*0.75;temp.tsy = temp.i1.height*0.75;
				if(cmd_set.screenadapt == \"coverall\"){
					
let w = temp.tsx / 960,h = temp.tsy / 540;
					w = Math.min(w,h);
					temp.tsx /= w,temp.tsy /= w;
				}
				temp.tpx = 480-temp.tsx/2,temp.tpy = 270-temp.tsy/2;
				temp.py = -temp.py;
				fun_msg(1,true,\"<Image>size_x=\"+temp.sx+\",size_y=\"+temp.sy+\",pos_x=\"+temp.px+\",pos_y=\"+temp.py);
				temp.e1.css({\"position\":\"absolute\",\"width\":temp.tsx,\"height\":temp.tsy,\"left\":temp.tpx,\"top\":temp.tpy,\"background-image\":\"url(\"+imgs[temp.n]+\")\",\"background-size\":temp.tsx+\"px \"+temp.tsy+\"px\",\"transform\":\"matrix(\"+temp.sx+\",0,0,\"+temp.sy+\",\"+temp.px+\",\"+temp.py+\")\"});
				temp.o1.append(temp.e1);
				temp.e1.hide().fadeIn(temp.t*1000,()=>{
					temp.o1.children('div:lt('+temp.c1+')').remove();
				});
				if(cmd_set.block == \"true\"){
					fun_delay(\"block\",temp.t);
					
return 2;
				}
				
break;