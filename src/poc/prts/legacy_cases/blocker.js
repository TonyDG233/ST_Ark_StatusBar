case "blocker":

				temp.t = cmd_set.fadetime == undefined ? 0.2 : cmd_set.fadetime;/* 榛樿12甯ц繃娓℃椂闂?*/
				temp.d1 = cmd_set.a == undefined ? 1 : +cmd_set.a;
				temp.d2 = cmd_set.r == undefined ? 0 : +cmd_set.r;
				temp.d3 = cmd_set.g == undefined ? 0 : +cmd_set.g;
				temp.d4 = cmd_set.b == undefined ? 0 : +cmd_set.b;
				if(temp.d1 > 1) temp.d1 = 1;/* 闂茬潃娌′簨鐨勪互闃蹭竾涓€ */
				temp.o1 = $(\"#sys_blocker\");
				if(cmd_set.image){
					temp.d1 = Math.max(0,1-temp.d1);
				}
				temp.o1.stop(true).css(\"transition\",\"background-color \"+temp.t+\"s linear\").css(\"background-color\",support.getRGBA(temp.d2,temp.d3,temp.d4,temp.d1));
				temp.o1.css(\"background-image\",cmd_set.image ? \"url('\"+imgs[cmd_set.image]+\"')\" : \"\");
				if(cmd_set.block == \"true\"){
					fun_delay(\"block\",temp.t);
					
return 2;
				}
				
break;