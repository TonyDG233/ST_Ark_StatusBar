case "delay":

				if (!cmd_set.time) 
return -1;
				fun_delay(\"block\",cmd_set.time);
				
return 2;