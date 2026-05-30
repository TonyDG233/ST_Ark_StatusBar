case "imagerotate":

				temp.o1 = $(\"#sys_image\").children(\"div:last\");
				if(temp.o1.length == 0) 
return -1;
				temp.ang = cmd_set.angle || 0;
				temp.fd = cmd_set.fadetime || 0;
				temp.d1 = temp.o1.css(\"transform\").replace(/rotate\\(.*?\\)/g,\"\");
				temp.o1.css(\"transition\",\"transform \"+temp.fd+\"s\");
				timer.create(\"img_rot_w\",(d = temp.d1,r = temp.ang)=>{temp.o1.css(\"transform\",d + \" rotate(\"+r+\"deg)\")},20);
				if(cmd_set.block == \"true\"){
					fun_delay(\"block\",temp.fd);
					
return 2;
				}
				
break;