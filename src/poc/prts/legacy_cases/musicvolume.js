case "musicvolume":

			case \"soundvolume\":
				temp.cmd = match[1].toLowerCase();
				if(cmd_set.volume == undefined){
					fun_msg(-2,false,\"<\"+match[1]+\">Can't find the volume parameter.\");
					
return -1;
				}
				temp.ch = temp.cmd == \"musicvolume\" ? \"sys_music\" : (cmd_set.channel && \"audio_\" + cmd_set.channel) || \"\";
				if(temp.ch == \"\") 
return -1;
				temp.o1 = document.getElementById(temp.ch);
				if(temp.o1 == null) 
return -1;
				temp.o1.fade(cmd_set.fadetime,cmd_set.volume*0.5);
				
break;