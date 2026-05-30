case "exit":

						temp.c1 = cmd_set.direction == \"left\" ? -1920 : 1920;
						temp.c1 = temp.c1 + (temp.n == \"left\" ? 480 : -480);
						temp.pos[4] = temp.c1;
						temp.o1.css(\"transition\",\"transform \"+temp.fd+\"s ease-in-out\");
						
break;

					default:
						fun_msg(-1,false,\"<CharacterAction>:Unknown type data:\"+temp.tp);
						
return -1;
				}
				timer.create(\"trans_action\",function(){temp.o1.css(\"transform\",\"matrix(\"+temp.pos.join(',')+\")\");},20);
				if(cmd_set.isblock == \"true\"){
					fun_delay(\"block\",temp.fd);
					
return 2;
				}
				
break;